import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';

interface ManageBorrowingProps {
  onBack: () => void;
}

export function ManageBorrowing({ onBack }: ManageBorrowingProps) {
  const [loans, setLoans] = useState<any[]>([]);
  const [books, setBooks] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [editingLoanId, setEditingLoanId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Filtering state
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Overdue'>('All');
  
  // Return Confirmation Modal State
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [loanToReturn, setLoanToReturn] = useState<any>(null);

  // Form State
  const [selectedBookId, setSelectedBookId] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [guestName, setGuestName] = useState('');
  const [guestNationalId, setGuestNationalId] = useState('');
  const [borrowerPhone, setBorrowerPhone] = useState('');
  
  // Automatically calculated dates
  const [loanDate, setLoanDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7); // Exactly 1 week
    return d.toISOString().split('T')[0];
  });
  
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: loansData, error: loansError } = await supabase
        .from('library_loans')
        .select(`
          *,
          library_books(title, available_copies),
          library_auth(name, national_id, user_type)
        `)
        .order('loan_date', { ascending: false });

      if (loansError) throw loansError;

      const { data: booksData, error: booksError } = await supabase
        .from('library_books')
        .select('id, title, available_copies')
        .order('title');

      if (booksError) throw booksError;

      const { data: usersData, error: usersError } = await supabase
        .from('library_auth')
        .select('id, name, national_id, user_type')
        .eq('user_type', 'User') // Only show regular users, no admins
        .order('name');

      if (usersError) throw usersError;

      setLoans(loansData || []);
      setBooks(booksData || []);
      setUsers(usersData || []);
    } catch (err: any) {
      console.error('Error fetching borrowing data:', err);
      setError('Could not load borrowing data.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedBookId('');
    setSelectedUserId('');
    setGuestName('');
    setGuestNationalId('');
    setBorrowerPhone('');
    setLoanDate(new Date().toISOString().split('T')[0]);
    setDueDate(() => {
      const d = new Date();
      d.setDate(d.getDate() + 7);
      return d.toISOString().split('T')[0];
    });
    setEditingLoanId(null);
    setShowForm(false);
    setError(null);
  };

  const handleIssueBook = async (e: React.FormEvent) => {
    e.preventDefault();
    
    let borrowerName = '';
    let finalNationalId = '';
    let borrowerId: string | null = null;

    if (!selectedBookId || !selectedUserId || !borrowerPhone.trim()) {
      setError('Please fill all required fields.');
      return;
    }

    if (selectedUserId === 'OTHERS') {
      if (!guestName.trim() || !guestNationalId.trim()) {
        setError('Please provide guest name and national ID.');
        return;
      }
      
      const isRegistered = users.some(u => u.national_id === guestNationalId.trim());
      if (isRegistered) {
        setError('This National ID belongs to a registered borrower. Please select them from the list instead.');
        return;
      }

      borrowerName = guestName.trim();
      finalNationalId = guestNationalId.trim();
      borrowerId = null;
    } else {
      const selectedUser = users.find(u => u.id === selectedUserId);
      if (!selectedUser) {
        setError('Selected user not found.');
        return;
      }
      borrowerName = selectedUser.name;
      finalNationalId = selectedUser.national_id;
      borrowerId = selectedUserId;
    }

    try {
      setLoading(true);
      setError(null);

      if (!editingLoanId) {
        const now = new Date().toISOString();

        const { data: overdueBooks, error: overdueError } = await supabase
          .from('library_loans')
          .select('id')
          .eq('national_id', finalNationalId)
          .eq('status', 'Active')
          .lt('due_date', now);

        if (overdueError) throw overdueError;
        if (overdueBooks && overdueBooks.length > 0) {
          throw new Error("Borrower has unreturned overdue books. They cannot borrow more until these are returned!");
        }

        const lastWeek = new Date();
        lastWeek.setDate(lastWeek.getDate() - 7);
        
        const { count, error: countError } = await supabase
          .from('library_loans')
          .select('*', { count: 'exact', head: true })
          .eq('national_id', finalNationalId)
          .eq('status', 'Active')
          .gte('loan_date', lastWeek.toISOString());

        if (countError) throw countError;
        if (count && count >= 2) {
          throw new Error("This borrower has already reached their limit of 2 active books per week.");
        }
      }

      const loanPayload = {
        book_id: selectedBookId,
        user_id: borrowerId,
        borrower_name: borrowerId ? null : borrowerName,
        borrower_phone: borrowerPhone.trim(),
        national_id: finalNationalId,
        loan_date: loanDate,
        due_date: dueDate,
        status: 'Active'
      };

      if (editingLoanId) {
        const { error: updateError } = await supabase
          .from('library_loans')
          .update(loanPayload)
          .eq('id', editingLoanId);
        
        if (updateError) throw updateError;
      } else {
        const { error: loanError } = await supabase
          .from('library_loans')
          .insert([loanPayload]);

        if (loanError) throw loanError;

        const book = books.find(b => b.id === selectedBookId);
        if (book) {
          await supabase
            .from('library_books')
            .update({ available_copies: (book.available_copies || 0) - 1 })
            .eq('id', selectedBookId);
        }
      }

      resetForm();
      fetchData();
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Operation failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteLoan = async (loan: any) => {
    if (!confirm(`Are you sure you want to delete this borrowing record for "${loan.library_books?.title}"?`)) return;

    try {
      setLoading(true);
      
      if (loan.status === 'Active') {
        const { data: bookData } = await supabase
          .from('library_books')
          .select('available_copies')
          .eq('id', loan.book_id)
          .single();
        
        if (bookData) {
          await supabase
            .from('library_books')
            .update({ available_copies: (bookData.available_copies || 0) + 1 })
            .eq('id', loan.book_id);
        }
      }

      const { error: deleteError } = await supabase
        .from('library_loans')
        .delete()
        .eq('id', loan.id);

      if (deleteError) throw deleteError;
      fetchData();
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err: any) {
      setError('Failed to delete record.');
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (loan: any) => {
    setSelectedBookId(loan.book_id);
    if (loan.user_id) {
       setSelectedUserId(loan.user_id);
    } else {
       setSelectedUserId('OTHERS');
       setGuestName(loan.borrower_name || '');
       setGuestNationalId(loan.national_id || '');
    }
    setBorrowerPhone(loan.borrower_phone || '');
    setLoanDate(new Date(loan.loan_date).toISOString().split('T')[0]);
    setDueDate(new Date(loan.due_date).toISOString().split('T')[0]);
    setEditingLoanId(loan.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const confirmReturn = async () => {
    if (!loanToReturn) return;
    try {
      setLoading(true);
      const { error: loanError } = await supabase
        .from('library_loans')
        .update({ status: 'Returned', return_date: new Date().toISOString() })
        .eq('id', loanToReturn.id);

      if (loanError) throw loanError;

      const { data: bookData } = await supabase
        .from('library_books')
        .select('available_copies')
        .eq('id', loanToReturn.book_id)
        .single();

      if (bookData) {
        await supabase
          .from('library_books')
          .update({ available_copies: (bookData.available_copies || 0) + 1 })
          .eq('id', loanToReturn.book_id);
      }

      setShowReturnModal(false);
      setLoanToReturn(null);
      fetchData();
      
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err: any) {
      setError('Failed to process return.');
    } finally {
      setLoading(false);
    }
  };

  const applySearchAndFilter = (list: any[]) => {
     return list.filter(loan => {
        const nameToSearch = loan.library_auth?.name || loan.borrower_name || '';
        const matchesSearch = 
           nameToSearch.toLowerCase().includes(searchTerm.toLowerCase()) ||
           loan.national_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
           loan.borrower_phone?.toLowerCase().includes(searchTerm.toLowerCase());
        
        if (!matchesSearch) return false;

        if (!showHistory) {
           if (loan.status !== 'Active') return false;
           const isOverdue = new Date(loan.due_date) < new Date();
           if (statusFilter === 'Active') return !isOverdue;
           if (statusFilter === 'Overdue') return isOverdue;
        }

        return true;
     });
  };

  const filteredActiveLoans = applySearchAndFilter(loans.filter(l => l.status === 'Active'));
  const filteredReturnedHistory = applySearchAndFilter(loans.filter(l => l.status === 'Returned'));

  return (
    <div style={{ minHeight: '100vh', padding: '40px', backgroundColor: '#FAF3E0', color: '#3E2C23', fontFamily: 'sans-serif' }}>
      
      <AnimatePresence>
        {showReturnModal && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(62, 44, 35, 0.4)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              style={{ backgroundColor: '#FFFFFF', width: '100%', maxWidth: '450px', borderRadius: '32px', padding: '40px', border: '1px solid #D4A373', boxShadow: '0 25px 60px rgba(139, 94, 60, 0.25)', textAlign: 'center' }}
            >
              <div style={{ fontSize: '3.5rem', marginBottom: '20px' }}>🔄</div>
              <h3 style={{ fontSize: '1.6rem', marginBottom: '12px', color: '#3E2C23', fontWeight: 800 }}>Confirm Return</h3>
              <p style={{ color: '#8B5E3C', marginBottom: '32px', lineHeight: 1.6, fontWeight: 500 }}>
                Are you sure <strong style={{color: '#8B5E3C'}}>{loanToReturn?.library_auth?.name || loanToReturn?.borrower_name}</strong> has returned the book <strong style={{color: '#8B5E3C'}}>"{loanToReturn?.library_books?.title}"</strong>?
              </p>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={() => setShowReturnModal(false)} style={{ flex: 1, padding: '16px', borderRadius: '16px', border: '1px solid #D4A373', backgroundColor: '#FAF3E0', color: '#8B5E3C', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
                <button onClick={confirmReturn} disabled={loading} style={{ flex: 1, padding: '16px', borderRadius: '16px', border: 'none', backgroundColor: '#8B5E3C', color: 'white', fontWeight: 800, cursor: 'pointer' }}>Confirm Return</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSuccess && (
          <motion.div 
            initial={{ opacity: 0, y: -50 }} animate={{ opacity: 1, y: 20 }} exit={{ opacity: 0, y: -50 }}
            style={{ position: 'fixed', top: 0, left: '50%', x: '-50%', backgroundColor: '#065f46', color: 'white', padding: '12px 32px', borderRadius: '50px', zIndex: 2000, boxShadow: '0 10px 25px rgba(0,0,0,0.2)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}
          >
            <span>✅</span> Operation Successful!
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
        <button onClick={onBack} style={{ backgroundColor: 'transparent', border: 'none', color: '#8B5E3C', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
          ← Back to Dashboard
        </button>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            onClick={() => { setShowHistory(!showHistory); setShowForm(false); setEditingLoanId(null); }}
            style={{ backgroundColor: '#FFFFFF', color: '#8B5E3C', padding: '14px 28px', borderRadius: '16px', border: '1px solid #D4A373', fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 10px rgba(139, 94, 60, 0.05)' }}
          >
            {showHistory ? (
              <>
                <i className="fa-solid fa-user-check" style={{ marginRight: '8px' }}></i>
                View Active Loans
              </>
            ) : (
              <>
                <i className="fa-solid fa-clock-rotate-left" style={{ marginRight: '8px' }}></i>
                View Returned History
              </>
            )}
          </button>
          <button 
            onClick={() => { if(showForm) resetForm(); else setShowForm(true); setShowHistory(false); }}
            style={{ backgroundColor: showForm ? '#D4A373' : '#8B5E3C', color: 'white', padding: '14px 28px', borderRadius: '16px', border: 'none', fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 10px 20px rgba(139, 94, 60, 0.1)' }}
          >
            {showForm ? 'Cancel' : '+ Fill Borrow Form'}
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {showForm && (
          <motion.div 
            key="borrow-form"
            initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            style={{ backgroundColor: '#FFFFFF', padding: '32px', borderRadius: '24px', marginBottom: '40px', border: '1px solid #D4A373', boxShadow: '0 10px 40px rgba(139, 94, 60, 0.08)' }}
          >
            <h2 style={{ marginBottom: '24px', color: '#8B5E3C', fontWeight: 800 }}>
              {editingLoanId ? 'Edit Borrowing Record' : 'Issue New Book to Borrower'}
            </h2>
            {error && <div style={{ color: '#991b1b', marginBottom: '20px', fontSize: '0.9rem', backgroundColor: '#fee2e2', padding: '12px', borderRadius: '12px', border: '1px solid #f87171' }}>{error}</div>}
            
            <form onSubmit={handleIssueBook} style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px' }}>
              <div style={inputGroupStyle}>
                <label style={labelStyle}>Select Available Book</label>
                <select value={selectedBookId} onChange={e => setSelectedBookId(e.target.value)} style={inputStyle} required>
                  <option value="">-- Choose Book Title --</option>
                  {books.map(book => (
                    <option key={book.id} value={book.id} disabled={book.available_copies <= 0 && book.id !== selectedBookId}>
                      {book.title} ({book.available_copies} left)
                    </option>
                  ))}
                </select>
              </div>

              <div style={inputGroupStyle}>
                <label style={labelStyle}>Select Borrower</label>
                <select value={selectedUserId} onChange={e => setSelectedUserId(e.target.value)} style={inputStyle} required>
                  <option value="">Choose Registered User</option>
                  {users.map(user => (
                    <option key={user.id} value={user.id}>{user.name} (ID: {user.national_id})</option>
                  ))}
                  <option value="OTHERS" style={{ color: '#8B5E3C', fontWeight: 700 }}>Others (Unregistered Guest)</option>
                </select>
              </div>

              <AnimatePresence>
                {selectedUserId === 'OTHERS' && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                    style={{ gridColumn: 'span 2', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', overflow: 'hidden' }}
                  >
                     <div style={inputGroupStyle}>
                        <label style={labelStyle}>Guest Full Name</label>
                        <input type="text" placeholder="Enter full name" value={guestName} onChange={e => setGuestName(e.target.value)} style={inputStyle} required />
                     </div>
                     <div style={inputGroupStyle}>
                        <label style={labelStyle}>Guest National ID</label>
                        <input type="text" placeholder="Enter national ID" value={guestNationalId} onChange={e => setGuestNationalId(e.target.value)} style={inputStyle} required />
                     </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div style={inputGroupStyle}>
                <label style={labelStyle}>Borrower Contact Number</label>
                <input type="tel" placeholder="Ex: 07x-xxx-xxxx" value={borrowerPhone} onChange={e => setBorrowerPhone(e.target.value)} style={inputStyle} required />
              </div>

              <div style={inputGroupStyle}>
                <label style={labelStyle}>Borrowed Date (Auto)</label>
                <input type="date" value={loanDate} style={{...inputStyle, backgroundColor: '#f3f4f6'}} readOnly />
              </div>

              <div style={inputGroupStyle}>
                <label style={labelStyle}>Due Date (Auto - 1 Week)</label>
                <input type="date" value={dueDate} style={{...inputStyle, backgroundColor: '#f3f4f6'}} readOnly />
              </div>

              <button type="submit" disabled={loading} style={{ gridColumn: 'span 2', padding: '16px', borderRadius: '16px', border: 'none', backgroundColor: '#8B5E3C', color: 'white', fontWeight: 800, cursor: 'pointer', boxShadow: '0 8px 20px rgba(139, 94, 60, 0.2)', marginTop: '10px' }}>
                {loading ? 'Processing...' : (editingLoanId ? 'Update Record' : 'Create Borrowing Record')}
              </button>
            </form>
          </motion.div>
        )}

        {!showForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div style={{ marginBottom: '24px', display: 'flex', gap: '16px', alignItems: 'center' }}>
               <div style={{ position: 'relative', flex: 1 }}>
                   <span style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#8B5E3C', pointerEvents: 'none' }}>
                     <i className="fa-solid fa-magnifying-glass"></i>
                   </span>
                  <input 
                    type="text" 
                    placeholder="Search by Name, ID, or Phone..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ width: '600px', padding: '14px 14px 14px 48px', borderRadius: '16px', border: '2px solid #D4A373', backgroundColor: '#FFFFFF', color: '#3E2C23', fontSize: '1rem', outline: 'none', boxShadow: '0 4px 12px rgba(139, 94, 60, 0.05)' }}
                  />
                  {searchTerm && (
                    <button onClick={() => setSearchTerm('')} style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#D4A373', cursor: 'pointer', fontWeight: 800 }}>✕</button>
                  )}
               </div>
            </div>

            {!showHistory ? (
              <section key="active-loans">
                <h2 style={{ marginBottom: '24px', color: '#8B5E3C', fontWeight: 800 }}>Circulation & Active Loans</h2>
                <div style={tableContainerStyle}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#8B5E3C' }}>
                        <th style={thStyle}>Borrower</th>
                        <th style={thStyle}>Phone Number</th>
                        <th style={thStyle}>National ID</th>
                        <th style={thStyle}>Book Title</th>
                        <th style={thStyle}>Borrowed Date</th>
                        <th style={thStyle}>Due Date</th>
                        <th style={thStyle}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span>Status</span>
                            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: '#FAF3E0', border: '1px solid rgba(250,243,224,0.3)', borderRadius: '8px', padding: '4px 8px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', outline: 'none' }}>
                              <option style={{color: '#3E2C23'}} value="All">All</option>
                              <option style={{color: '#3E2C23'}} value="Active">Active</option>
                              <option style={{color: '#3E2C23'}} value="Overdue">Overdue</option>
                            </select>
                          </div>
                        </th>
                        <th style={thStyle}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredActiveLoans.map((loan, idx) => {
                        const isOverdue = new Date(loan.due_date) < new Date();
                        return (
                          <tr key={loan.id} style={{ borderBottom: idx === filteredActiveLoans.length - 1 ? 'none' : '1px solid #f3f4f6' }}>
                            <td style={{...tdStyle, fontWeight: 700}}>{loan.library_auth?.name || loan.borrower_name}</td>
                            <td style={{...tdStyle, color: '#8B5E3C', fontWeight: 600}}>{loan.borrower_phone}</td>
                            <td style={{...tdStyle, color: '#3E2C23'}}>{loan.national_id}</td>
                            <td style={tdStyle}>{loan.library_books?.title}</td>
                            <td style={tdStyle}>{new Date(loan.loan_date).toLocaleDateString()}</td>
                            <td style={{...tdStyle, color: isOverdue ? '#b91c1c' : 'inherit', fontWeight: isOverdue ? 700 : 500}}>{new Date(loan.due_date).toLocaleDateString()}</td>
                            <td style={tdStyle}>
                              <span style={{ backgroundColor: isOverdue ? '#fee2e2' : '#fef3c7', color: isOverdue ? '#b91c1c' : '#92400e', padding: '6px 14px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center' }}>
                                {isOverdue ? <><i className="fa-solid fa-circle-exclamation" style={{ marginRight: '6px' }}></i> OVERDUE</> : <><i className="fa-solid fa-user-check" style={{ marginRight: '6px' }}></i> ACTIVE</>}
                              </span>
                            </td>
                            <td style={tdStyle}>
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <button onClick={() => { setLoanToReturn(loan); setShowReturnModal(true); }} style={{ backgroundColor: '#8B5E3C', color: 'white', border: 'none', padding: '8px 12px', borderRadius: '10px', cursor: 'pointer', fontWeight: 700, fontSize: '0.75rem' }}>Return</button>
                                <button onClick={() => handleEditClick(loan)} style={{ backgroundColor: '#FAF3E0', color: '#8B5E3C', border: '1px solid #D4A373', padding: '8px 12px', borderRadius: '10px', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem' }}><i className="fa-regular fa-pen-to-square"></i></button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : (
              <section key="returned-history">
                <h2 style={{ marginBottom: '24px', color: '#D4A373', fontWeight: 800 }}>Returned History</h2>
                <div style={{...tableContainerStyle, border: '1px solid #D4A373'}}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#D4A373' }}>
                        <th style={thStyle}>Borrower</th>
                        <th style={thStyle}>Phone Number</th>
                        <th style={thStyle}>National ID</th>
                        <th style={thStyle}>Book Title</th>
                        <th style={thStyle}>Borrowed Date</th>
                        <th style={thStyle}>Return Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredReturnedHistory.map((loan, idx) => (
                        <tr key={loan.id} style={{ borderBottom: idx === filteredReturnedHistory.length - 1 ? 'none' : '1px solid #f3f4f6' }}>
                          <td style={{...tdStyle, fontWeight: 700}}>{loan.library_auth?.name || loan.borrower_name}</td>
                          <td style={{...tdStyle, color: '#8B5E3C', fontWeight: 600}}>{loan.borrower_phone}</td>
                          <td style={{...tdStyle, color: '#3E2C23'}}>{loan.national_id}</td>
                          <td style={tdStyle}>{loan.library_books?.title}</td>
                          <td style={tdStyle}>{new Date(loan.loan_date).toLocaleDateString()}</td>
                          <td style={tdStyle}>{new Date(loan.return_date).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const tableContainerStyle = { backgroundColor: '#FFFFFF', border: '1px solid #D4A373', borderRadius: '32px', overflow: 'hidden', boxShadow: '0 15px 35px rgba(139, 94, 60, 0.05)' };
const inputGroupStyle = { display: 'flex', flexDirection: 'column' as const, gap: '8px' };
const labelStyle = { fontSize: '0.85rem', color: '#8B5E3C', fontWeight: 700, marginLeft: '4px' };
const inputStyle = { padding: '14px', borderRadius: '16px', border: '2px solid #FAF3E0', backgroundColor: '#FAF3E0', color: '#3E2C23', fontSize: '1rem', outline: 'none', fontWeight: 500 };
const thStyle = { padding: '18px 32px', color: '#FAF3E0', fontWeight: 800, fontSize: '0.9rem' };
const tdStyle = { padding: '20px 32px', color: '#3E2C23', fontSize: '0.95rem' };
