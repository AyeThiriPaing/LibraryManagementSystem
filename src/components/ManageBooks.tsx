import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';

interface ManageBooksProps {
  onBack: () => void;
}

export function ManageBooks({ onBack }: ManageBooksProps) {
  const [books, setBooks] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingBookId, setEditingBookId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // New state for custom Delete Modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [bookToDelete, setBookToDelete] = useState<any>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [totalCopies, setTotalCopies] = useState(1);
  const [coverUrl, setCoverUrl] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [booksRes, catsRes] = await Promise.all([
        supabase.from('library_books').select('*, library_categories(name)').order('created_at', { ascending: false }),
        supabase.from('library_categories').select('*').order('name')
      ]);
      setBooks(booksRes.data || []);
      setCategories(catsRes.data || []);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setAuthor('');
    setCategoryId('');
    setTotalCopies(1);
    setCoverUrl('');
    setEditingBookId(null);
    setShowForm(false);
    setError(null);
  };

  const handleEditClick = (book: any) => {
    setTitle(book.title);
    setAuthor(book.author);
    setCategoryId(book.category_id || '');
    setTotalCopies(book.total_copies);
    setCoverUrl(book.cover_url || '');
    setEditingBookId(book.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      setError(null);

      if (!event.target.files || event.target.files.length === 0) {
        throw new Error('You must select an image to upload.');
      }

      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `book-covers/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('book-covers')
        .upload(filePath, file);

      if (uploadError) {
        if (uploadError.message.includes('bucket not found')) {
          throw new Error('Please create a "book-covers" bucket in your Supabase Storage and set it to public.');
        }
        throw uploadError;
      }

      const { data } = supabase.storage.from('book-covers').getPublicUrl(filePath);
      setCoverUrl(data.publicUrl);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryId) {
      setError('Please select a category.');
      return;
    }

    try {
      setLoading(true);
      const bookData = {
        title,
        author,
        category_id: categoryId,
        total_copies: totalCopies,
        available_copies: totalCopies,
        cover_url: coverUrl 
      };

      if (editingBookId) {
        const { error: updateError } = await supabase
          .from('library_books')
          .update(bookData)
          .eq('id', editingBookId);
        
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('library_books')
          .insert([bookData]);
        
        if (insertError) throw insertError;
      }

      resetForm();
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Operation failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBook = async (id: string) => {
    try {
      setLoading(true);
      const { error: deleteError } = await supabase
        .from('library_books')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;
      fetchData();
      setShowDeleteModal(false);
      setBookToDelete(null);
    } catch (err: any) {
      setError(err.message || 'Failed to delete book.');
    } finally {
      setLoading(false);
    }
  };

  const triggerDeleteConfirm = (book: any) => {
    setBookToDelete(book);
    setShowDeleteModal(true);
  };

  const filteredBooks = books.filter(book => 
     book.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
     book.author.toLowerCase().includes(searchTerm.toLowerCase()) ||
     book.library_categories?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{ minHeight: '100vh', padding: '40px', backgroundColor: '#FAF3E0', color: '#3E2C23', fontFamily: 'sans-serif' }}>
      
      {/* Delete Confirmation Modal Overlay */}
      <AnimatePresence>
        {showDeleteModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(62, 44, 35, 0.4)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              style={{ backgroundColor: '#FFFFFF', width: '100%', maxWidth: '450px', borderRadius: '24px', padding: '32px', border: '1px solid #D4A373', boxShadow: '0 25px 50px -12px rgba(139, 94, 60, 0.3)', textAlign: 'center' }}
            >
              <div style={{ fontSize: '3rem', marginBottom: '16px' }}>⚠️</div>
              <h3 style={{ fontSize: '1.5rem', marginBottom: '12px', color: '#3E2C23', fontWeight: 800 }}>Delete Book?</h3>
              <p style={{ color: '#8B5E3C', marginBottom: '32px', lineHeight: 1.6, fontWeight: 500 }}>Are you sure you want to delete <strong style={{color: '#8B5E3C'}}>"{bookToDelete?.title}"</strong>? This action cannot be undone.</p>
              
              <div style={{ display: 'flex', gap: '12px' }}>
                <button 
                  onClick={() => setShowDeleteModal(false)}
                  style={{ flex: 1, padding: '14px', borderRadius: '12px', border: '1px solid #D4A373', backgroundColor: '#FAF3E0', color: '#8B5E3C', fontWeight: 700, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button 
                  onClick={() => handleDeleteBook(bookToDelete.id)}
                  disabled={loading}
                  style={{ flex: 1, padding: '14px', borderRadius: '12px', border: 'none', backgroundColor: '#8B5E3C', color: 'white', fontWeight: 800, cursor: 'pointer' }}
                >
                  {loading ? 'Deleting...' : 'Yes, Delete'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
        <button onClick={onBack} style={{ backgroundColor: 'transparent', border: 'none', color: '#8B5E3C', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
          ← Back to Dashboard
        </button>
        <button 
          onClick={() => { if(showForm) resetForm(); else setShowForm(true); }}
          style={{ backgroundColor: showForm ? '#D4A373' : '#8B5E3C', color: 'white', padding: '12px 24px', borderRadius: '12px', border: 'none', fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 10px rgba(139, 94, 60, 0.2)' }}
        >
          {showForm ? 'Cancel' : '+ Add New Book'}
        </button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            style={{ backgroundColor: '#FFFFFF', padding: '32px', borderRadius: '24px', marginBottom: '40px', border: '1px solid #D4A373', boxShadow: '0 10px 40px rgba(139, 94, 60, 0.1)' }}
          >
            <h2 style={{ marginBottom: '24px', color: '#8B5E3C', fontWeight: 800 }}>
              {editingBookId ? '📝 Edit Book Details' : 'Add New Book to Collection'}
            </h2>
            {error && <div style={{ color: '#991b1b', marginBottom: '16px', fontSize: '0.85rem', backgroundColor: '#fee2e2', padding: '10px', borderRadius: '8px', border: '1px solid #f87171' }}>{error}</div>}
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 250px', gap: '32px' }}>
              <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <input placeholder="Book Title" value={title} onChange={e => setTitle(e.target.value)} style={inputStyle} required />
                <input placeholder="Author Name" value={author} onChange={e => setAuthor(e.target.value)} style={inputStyle} required />
                
                <select value={categoryId} onChange={e => setCategoryId(e.target.value)} style={inputStyle} required>
                  <option value="">-- Choose Category --</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>

                <input type="number" placeholder="Total Copies" value={totalCopies} onChange={e => setTotalCopies(parseInt(e.target.value))} style={inputStyle} min="1" required />
                
                <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '0.85rem', color: '#8B5E3C', fontWeight: 700 }}>Book Cover Image</label>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <input 
                      placeholder="Paste Image URL"
                      value={coverUrl} 
                      onChange={e => setCoverUrl(e.target.value)} 
                      style={{...inputStyle, flex: 1}} 
                    />
                    <div style={{ position: 'relative' }}>
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={handleFileUpload} 
                        disabled={uploading}
                        style={{ opacity: 0, position: 'absolute', inset: 0, cursor: 'pointer' }} 
                      />
                      <button type="button" style={{ height: '100%', padding: '0 20px', borderRadius: '12px', border: '1px solid #D4A373', backgroundColor: '#FAF3E0', color: '#8B5E3C', fontWeight: 700, pointerEvents: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {uploading ? (
                          <><i className="fa-solid fa-spinner fa-spin"></i> Uploading...</>
                        ) : (
                          <><i className="fa-solid fa-upload"></i> Upload File</>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                <button type="submit" disabled={loading || uploading} style={{ gridColumn: 'span 2', padding: '14px', borderRadius: '12px', border: 'none', backgroundColor: editingBookId ? '#F59E0B' : '#8B5E3C', color: 'white', fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 14px rgba(139, 94, 60, 0.2)' }}>
                  {loading ? 'Processing...' : (editingBookId ? 'Update Book Information' : 'Add Book to Database')}
                </button>
              </form>

              {/* Cover Preview */}
              <div style={{ backgroundColor: '#FAF3E0', borderRadius: '16px', border: '1px solid #D4A373', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '10px', color: '#8B5E3C', textAlign: 'center' }}>
                {coverUrl ? (
                  <img src={coverUrl} alt="Cover Preview" style={{ maxWidth: '100%', maxHeight: '300px', borderRadius: '8px', objectFit: 'contain' }} onError={(e: any) => e.target.style.display = 'none'} />
                ) : (
                  <div>
                    <i className="fa-regular fa-image" style={{ fontSize: '3rem', marginBottom: '16px', opacity: 0.7 }}></i>
                    <div style={{ fontSize: '0.9rem', fontWeight: 700, letterSpacing: '0.5px' }}>Cover Preview Area</div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ color: '#8B5E3C', fontWeight: 800, margin: 0 }}>Existing Collection</h2>
        
        {/* Search Bar */}
        <div style={{ position: 'relative', width: '600px', marginRight:'70px' }}>
          <span style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#8B5E3C', pointerEvents: 'none' }}>
            <i className="fa-solid fa-magnifying-glass"></i>
          </span>
          <input 
            type="text" 
            placeholder="Search by Title, Author, or Category..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ 
              width: '100%', 
              padding: '14px 14px 14px 48px', 
              borderRadius: '16px', 
              border: '2px solid #D4A373', 
              backgroundColor: '#FFFFFF', 
              color: '#3E2C23', 
              fontSize: '1rem', 
              outline: 'none',
              boxShadow: '0 4px 12px rgba(139, 94, 60, 0.05)'
            }}
          />
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm('')}
              style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#D4A373', cursor: 'pointer', fontWeight: 800 }}
            >✕</button>
          )}
        </div>
      </div>

      <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #D4A373', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 10px 30px rgba(139, 94, 60, 0.05)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ backgroundColor: '#8B5E3C' }}>
              <th style={thStyle}>Cover</th>
              <th style={thStyle}>Title</th>
              <th style={thStyle}>Author</th>
              <th style={thStyle}>Category</th>
              <th style={thStyle}>Stock</th>
              <th style={thStyle}>Uploaded Date</th>
              <th style={thStyle}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredBooks.map((book, idx) => (
              <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6', transition: 'background-color 0.2s' }}>
                <td style={tdStyle}>
                  {book.cover_url ? (
                    <img src={book.cover_url} alt="cover" style={{ width: '40px', height: '60px', borderRadius: '4px', objectFit: 'cover', border: '1px solid #D4A373' }} />
                  ) : (
                    <div style={{ width: '40px', height: '60px', backgroundColor: '#FAF3E0', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', border: '1px solid #D4A373' }}>📖</div>
                  )}
                </td>
                <td style={{...tdStyle, fontWeight: 700}}>{book.title}</td>
                <td style={tdStyle}>{book.author}</td>
                <td style={tdStyle}>
                  <span style={{ backgroundColor: '#FAF3E0', color: '#8B5E3C', padding: '4px 10px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600 }}>
                    {book.library_categories?.name || 'Uncategorized'}
                  </span>
                </td>
                <td style={tdStyle}>{book.available_copies} / {book.total_copies}</td>
                <td style={tdStyle}>
                  <div style={{ fontSize: '0.85rem', color: '#D4A373', fontWeight: 600 }}>
                    {new Date(book.created_at).toLocaleDateString('en-GB')}
                  </div>
                </td>
                <td style={tdStyle}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                      onClick={() => handleEditClick(book)}
                      style={{ backgroundColor: '#FFFFFF', color: '#8B5E3C', border: '1px solid #D4A373', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700 }}
                    >
                      <i className="fa-regular fa-pen-to-square" style={{ marginRight: '6px' }}></i> Edit
                    </button>
                    <button 
                      onClick={() => triggerDeleteConfirm(book)}
                      style={{ backgroundColor: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700 }}
                    >
                      <i className="fa-regular fa-trash-can" style={{ marginRight: '6px' }}></i> Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredBooks.length === 0 && (
          <div style={{ padding: '80px', textAlign: 'center', color: '#D4A373' }}>
        
            <p style={{ fontWeight: 600, fontSize: '1.1rem' }}>No books match your search criteria.</p>
          </div>
        )}
      </div>
    </div>
  );
}

const inputStyle = {
  padding: '14px',
  borderRadius: '12px',
  border: '1px solid #D4A373',
  backgroundColor: '#FFFFFF',
  color: '#3E2C23',
  fontSize: '1rem',
  outline: 'none',
  fontWeight: 500
};

const thStyle = { padding: '16px 24px', color: '#FAF3E0', fontWeight: 800, fontSize: '0.9rem' };
const tdStyle = { padding: '16px 24px', color: '#3E2C23', fontSize: '0.95rem' };
