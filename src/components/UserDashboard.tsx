import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';

interface UserDashboardProps {
  session: { name: string; email: string };
  handleLogout: () => void;
}

export function UserDashboard({ session, handleLogout }: UserDashboardProps) {
  const [books, setBooks] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);
  
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [activeView, setActiveView] = useState<'catalogue' | 'borrowed' | 'favourites'>('catalogue');
  const [myLoans, setMyLoans] = useState<any[]>([]);
  
  // Account Specific State (Saved to Database)
  const [userId, setUserId] = useState<string | null>(null);
  const [favouriteIds, setFavouriteIds] = useState<string[]>([]);
  const [userInteractions, setUserInteractions] = useState<Record<string, 'like' | 'dislike' | null>>({});
  const [globalCounts, setGlobalCounts] = useState<Record<string, { likes: number, dislikes: number }>>({});
  
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const checkOverflow = () => {
    if (containerRef.current) {
      const { scrollHeight, clientHeight } = containerRef.current;
      setIsOverflowing(scrollHeight > clientHeight + 5); 
    }
  };

  useLayoutEffect(() => {
    checkOverflow();
    window.addEventListener('resize', checkOverflow);
    return () => window.removeEventListener('resize', checkOverflow);
  }, [categories, activeView]);

  useEffect(() => {
    initializeApp();
    
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowProfileDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const initializeApp = async () => {
    try {
      setLoading(true);

      // 1. Fetch current User ID from library_auth
      const { data: userData } = await supabase
        .from('library_auth')
        .select('id')
        .eq('email', session.email)
        .single();
      
      const currentUid = userData?.id;
      if (currentUid) setUserId(currentUid);

      // 2. Fetch Books and Categories
      await fetchCatalogueData();
      
      // 3. Fetch Personal Data (Loans & Favourites)
      if (currentUid) {
        await Promise.all([
          fetchMyLoans(currentUid),
          fetchUserFavourites(currentUid),
          fetchGlobalInteractions(currentUid)
        ]);
      } else {
        await fetchGlobalInteractions();
      }

    } catch (err) {
      console.error('Initialization error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCatalogueData = async () => {
    const [booksRes, catsRes] = await Promise.all([
      supabase.from('library_books').select('*, library_categories(name)').order('title'),
      supabase.from('library_categories').select('*').order('name')
    ]);
    setBooks(booksRes.data || []);
    setCategories(catsRes.data || []);
  };

  const fetchMyLoans = async (uid: string) => {
    const { data } = await supabase
      .from('library_loans')
      .select('*, library_books(title, cover_url)')
      .eq('user_id', uid)
      .eq('status', 'Active');
    setMyLoans(data || []);
  };

  const fetchUserFavourites = async (uid: string) => {
    const { data } = await supabase
      .from('library_favourites')
      .select('book_id')
      .eq('user_id', uid);
    
    setFavouriteIds(data?.map(f => f.book_id) || []);
  };

  const fetchGlobalInteractions = async (uid?: string) => {
    try {
      // Fetch Total Counts from community
      const { data: allActions } = await supabase.from('library_interactions').select('book_id, type');
      const counts: Record<string, { likes: number, dislikes: number }> = {};
      allActions?.forEach(item => {
        if (!counts[item.book_id]) counts[item.book_id] = { likes: 0, dislikes: 0 };
        if (item.type === 'like') counts[item.book_id].likes++;
        else counts[item.book_id].dislikes++;
      });
      setGlobalCounts(counts);

      // Fetch what THIS user specifically did
      if (uid) {
        const { data: myActions } = await supabase
          .from('library_interactions')
          .select('book_id, type')
          .eq('user_id', uid);
        
        const myMap: Record<string, 'like' | 'dislike' | null> = {};
        myActions?.forEach(item => {
          myMap[item.book_id] = item.type as 'like' | 'dislike';
        });
        setUserInteractions(myMap);
      }
    } catch (err) { console.error('Error fetching interactions:', err); }
  };

  const toggleFavourite = async (bookId: string) => {
    if (!userId) return;
    const isFav = favouriteIds.includes(bookId);
    
    try {
      if (isFav) {
        // Remove from Database
        await supabase.from('library_favourites').delete().eq('book_id', bookId).eq('user_id', userId);
        setFavouriteIds(prev => prev.filter(id => id !== bookId));
      } else {
        // Save to Database
        await supabase.from('library_favourites').insert({ book_id: bookId, user_id: userId });
        setFavouriteIds(prev => [...prev, bookId]);
      }
    } catch (err) { console.error('Error syncing favourites:', err); }
  };

  const toggleInteraction = async (bookId: string, type: 'like' | 'dislike') => {
    if (!userId) return;
    const current = userInteractions[bookId];
    
    try {
      if (current === type) {
        // Remove action
        await supabase.from('library_interactions').delete().eq('book_id', bookId).eq('user_id', userId);
        setUserInteractions(prev => ({ ...prev, [bookId]: null }));
      } else {
        // Update or Insert action
        await supabase.from('library_interactions').upsert({ book_id: bookId, user_id: userId, type }, { onConflict: 'book_id,user_id' });
        setUserInteractions(prev => ({ ...prev, [bookId]: type }));
      }
      // Re-fetch counts for everyone
      await fetchGlobalInteractions(userId);
    } catch (err) { console.error('Error syncing interaction:', err); }
  };

  const filteredBooks = books.filter(book => {
    const matchesSearch = book.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         book.author.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || book.library_categories?.name === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#FAF3E0', fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif", color: '#3E2C23' }}>
      <style>{`
        @media (max-width: 1023px) {
          .portal-header { padding: 16px 24px !important; }
          .portal-search { margin: 0 20px !important; }
          .portal-main { padding: 24px !important; }
          .portal-book-grid { grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)) !important; gap: 16px !important; }
          .portal-loan-grid { grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)) !important; }
          .portal-fav-grid { grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)) !important; gap: 16px !important; }
        }
        @media (max-width: 639px) {
          .portal-header { padding: 14px 16px !important; flex-wrap: wrap !important; }
          .portal-logo { flex: 1 !important; order: 1; }
          .portal-logo h1 { font-size: 1.2rem !important; }
          .portal-search { flex: 0 0 100% !important; max-width: 100% !important; margin: 10px 0 0 !important; order: 3; }
          .portal-actions { flex: 0 0 auto !important; order: 2; }
          .portal-main { padding: 16px !important; }
          .portal-book-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 12px !important; }
          .portal-loan-grid { grid-template-columns: 1fr !important; }
          .portal-fav-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 12px !important; }
          .portal-section-title { font-size: 1.4rem !important; }
        }
      `}</style>
      {/* Header Section */}
      <header className="portal-header" style={{ padding: '20px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFFFFF', boxShadow: '0 4px 20px rgba(139, 94, 60, 0.05)', position: 'sticky', top: 0, zIndex: 100 }}>
        <div className="portal-logo" style={{ flex: '0 0 240px', cursor: 'pointer' }} onClick={() => setActiveView('catalogue')}>
          <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800, color: '#8B5E3C' }}>Members Portal</h1>
          <p style={{ margin: '2px 0 0', color: '#A67C52', fontSize: '0.85rem', fontWeight: 600 }}>Welcome back, {session.name}</p>
        </div>

        <div className="portal-search" style={{ flex: 1, maxWidth: '600px', margin: '0 40px', position: 'relative' }}>
          <span style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#8B5E3C', pointerEvents: 'none' }}>
            <i className="fa-solid fa-magnifying-glass"></i>
          </span>
          <input type="text" placeholder="Search by book title or author..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={searchInputStyle} />
        </div>

        <div className="portal-actions" style={{ flex: '0 0 240px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '20px', position: 'relative' }}>
          <div ref={dropdownRef} style={{ position: 'relative' }}>
            <motion.div whileTap={{ scale: 0.95 }} onClick={() => setShowProfileDropdown(!showProfileDropdown)} style={avatarStyle}>
              {session.name.charAt(0).toUpperCase()}
            </motion.div>
            <AnimatePresence>
              {showProfileDropdown && (
                <motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }} style={dropdownMenuStyle}>
                  <div style={{ padding: '16px', borderBottom: '1px solid #FAF3E0', marginBottom: '8px' }}>
                    <div style={{ fontSize: '1rem', fontWeight: 800, color: '#3E2C23' }}>{session.name}</div>
                    <div style={{ fontSize: '0.8rem', color: '#8B5E3C' }}>{session.email}</div>
                  </div>
                  <DropdownItem icon="📖" label="My Borrowed Books" onClick={() => { setActiveView('borrowed'); setShowProfileDropdown(false); }} />
                  <DropdownItem icon="❤️" label="My Favourites" onClick={() => { setActiveView('favourites'); setShowProfileDropdown(false); }} />
                  <div style={{ borderTop: '1px solid #FAF3E0', marginTop: '8px', paddingTop: '8px' }}>
                    <DropdownItem icon="↩️" label="Logout" color="#991B1B" onClick={handleLogout} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      <main className="portal-main" style={{ padding: '40px' }}>
        <AnimatePresence mode="wait">
          {activeView === 'catalogue' && (
            <motion.div key="catalogue" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
              <section style={{ marginBottom: '40px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', flexWrap: 'wrap' }}>
                  <div ref={containerRef} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', flex: 1, maxHeight: showAllCategories ? 'none' : '46px', overflow: 'hidden', transition: 'max-height 0.3s ease' }}>
                    <CategoryChip label="All" active={selectedCategory === 'All'} onClick={() => setSelectedCategory('All')} />
                    {categories.map((cat) => (
                      <CategoryChip key={cat.id} label={cat.name} active={selectedCategory === cat.name} onClick={() => setSelectedCategory(cat.name)} />
                    ))}
                  </div>
                  {(isOverflowing || showAllCategories) && (
                    <button onClick={() => setShowAllCategories(!showAllCategories)} style={seeMoreButtonStyle}>{showAllCategories ? 'See Less ↑' : 'See More ↓'}</button>
                  )}
                </div>
              </section>

              <section>
                <h2 style={{ fontSize: '1.4rem', color: '#3E2C23', fontWeight: 700, marginBottom: '24px' }}>
                  {selectedCategory === 'All' ? 'All Available Books' : `${selectedCategory} Books`}
                  <span style={{ marginLeft: '12px', fontSize: '0.9rem', color: '#A67C52', fontWeight: 500 }}>({filteredBooks.length} items found)</span>
                </h2>

                {loading ? (
                  <div style={loadingContainerStyle}><motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} style={spinnerStyle} /></div>
                ) : (
                  <div className="portal-book-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '24px' }}>
                    {filteredBooks.map((book) => (
                      <BookCard 
                        key={book.id} book={book} 
                        isFavourite={favouriteIds.includes(book.id)}
                        onToggleFavourite={() => toggleFavourite(book.id)}
                        interaction={userInteractions[book.id]}
                        counts={globalCounts[book.id] || { likes: 0, dislikes: 0 }}
                        onToggleLike={() => toggleInteraction(book.id, 'like')}
                        onToggleDislike={() => toggleInteraction(book.id, 'dislike')}
                      />
                    ))}
                  </div>
                )}
                {!loading && filteredBooks.length === 0 && <EmptyState message="No books found matching your search." />}
              </section>
            </motion.div>
          )}

          {activeView === 'borrowed' && (
            <motion.div key="borrowed" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
              <button onClick={() => setActiveView('catalogue')} style={backButtonStyle}>← Back to Catalogue</button>
              <h2 className="portal-section-title" style={{ fontSize: '2rem', fontWeight: 800, color: '#8B5E3C', marginBottom: '8px' }}>My Borrowed Books</h2>
              {myLoans.length > 0 ? (
                <div className="portal-loan-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' }}>
                  {myLoans.map((loan) => <LoanCard key={loan.id} loan={loan} />)}
                </div>
              ) : ( <EmptyState message="You haven't borrowed any books yet." /> )}
            </motion.div>
          )}

          {activeView === 'favourites' && (
            <motion.div key="favourites" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
              <button onClick={() => setActiveView('catalogue')} style={backButtonStyle}>← Back to Catalogue</button>
              <h2 className="portal-section-title" style={{ fontSize: '2rem', fontWeight: 800, color: '#8B5E3C', marginBottom: '8px' }}>My Favourites</h2>
              {books.filter(b => favouriteIds.includes(b.id)).length > 0 ? (
                <div className="portal-fav-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '24px' }}>
                  {books.filter(b => favouriteIds.includes(b.id)).map((book) => (
                    <BookCard 
                      key={book.id} book={book} isFavourite={true}
                      onToggleFavourite={() => toggleFavourite(book.id)}
                      interaction={userInteractions[book.id]}
                      counts={globalCounts[book.id] || { likes: 0, dislikes: 0 }}
                      onToggleLike={() => toggleInteraction(book.id, 'like')}
                      onToggleDislike={() => toggleInteraction(book.id, 'dislike')}
                    />
                  ))}
                </div>
              ) : ( <EmptyState message="Your favourites list is currently empty." icon="⭐" /> )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

// Sub-components
function DropdownItem({ icon, label, onClick, color = '#3E2C23' }: any) {
  return (
    <motion.div whileHover={{ backgroundColor: '#FAF3E0', x: 5 }} onClick={onClick} style={{ padding: '12px 16px', borderRadius: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', color, fontWeight: 600, fontSize: '0.95rem', transition: 'all 0.2s' }}>
      <span style={{ fontSize: '1.2rem' }}>{icon}</span>{label}
    </motion.div>
  );
}

function LoanCard({ loan }: { loan: any }) {
  const isOverdue = new Date(loan.due_date) < new Date();
  return (
    <motion.div whileHover={{ y: -5 }} style={{ display: 'flex', gap: '20px', padding: '24px', borderRadius: '24px', border: '1px solid #FAF3E0', backgroundColor: '#FFFFFF', boxShadow: '0 4px 15px rgba(62, 44, 35, 0.05)' }}>
      <div style={{ width: '80px', height: '110px', backgroundColor: '#FAF3E0', borderRadius: '12px', overflow: 'hidden', flexShrink: 0, boxShadow: '0 4px 10px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {loan.library_books?.cover_url ? <img src={loan.library_books.cover_url} alt="cover" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '2rem' }}>📖</span>}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 800, color: '#3E2C23', fontSize: '1.1rem', marginBottom: '8px', lineHeight: 1.3 }}>{loan.library_books?.title}</div>
        <div style={{ fontSize: '0.9rem', color: '#8B5E3C', marginBottom: '12px' }}>Due: <strong>{new Date(loan.due_date).toLocaleDateString()}</strong></div>
        <div style={{ display: 'inline-flex', alignItems: 'center', padding: '6px 12px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 800, backgroundColor: isOverdue ? '#fee2e2' : '#d1fae5', color: isOverdue ? '#991b1b' : '#065f46' }}>
          {isOverdue ? <><i className="fa-solid fa-circle-exclamation" style={{ marginRight: '6px' }}></i> OVERDUE</> : <><i className="fa-solid fa-user-check" style={{ marginRight: '6px' }}></i> ACTIVE LOAN</>}
        </div>
      </div>
    </motion.div>
  );
}

function EmptyState({ message, icon = '📚' }: any) {
  return (
    <div style={{ textAlign: 'center', padding: '80px 40px', backgroundColor: '#FFFFFF', borderRadius: '32px', border: '1px solid #FAF3E0', boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
      <div style={{ fontSize: '4rem', marginBottom: '24px' }}>{icon}</div>
      <h3 style={{ color: '#3E2C23', marginBottom: '8px', fontWeight: 800 }}>Nothing to show</h3>
      <p style={{ color: '#8B5E3C', fontWeight: 500 }}>{message}</p>
    </div>
  );
}

function CategoryChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ padding: '10px 24px', borderRadius: '25px', border: 'none', backgroundColor: active ? '#8B5E3C' : '#FFFFFF', color: active ? '#FFFFFF' : '#8B5E3C', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: active ? '0 4px 12px rgba(139, 94, 60, 0.2)' : '0 2px 6px rgba(0,0,0,0.05)', transition: 'all 0.2s', fontSize: '0.9rem' }}>{label}</button>
  );
}

function BookCard({ book, isFavourite, onToggleFavourite, interaction, counts, onToggleLike, onToggleDislike }: any) {
  const isAvailable = book.available_copies > 0;
  return (
    <motion.div layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -8 }} style={{ backgroundColor: '#FFFFFF', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 10px 25px rgba(139, 94, 60, 0.08)', border: '1px solid #F3F4F6', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <div style={{ height: '320px', backgroundColor: '#FAF3E0', position: 'relative', overflow: 'hidden' }}>
        {book.cover_url ? <img src={book.cover_url} alt={book.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '4rem' }}>📖</div>}
        <div style={{ position: 'absolute', top: '16px', right: '16px', padding: '6px 12px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 800, backgroundColor: isAvailable ? '#D1FAE5' : '#FEE2E2', color: isAvailable ? '#065F46' : '#991B1B', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}>{isAvailable ? 'AVAILABLE' : 'OUT OF STOCK'}</div>
        <motion.button  whileTap={{ scale: 0.8 }} onClick={(e) => { e.stopPropagation(); onToggleFavourite(); }} style={{ position: 'absolute', bottom: '16px', right: '16px', width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#FFFFFF', border: 'none', boxShadow: '0 4px 10px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '1.2rem' }}>
          {isFavourite ? '❤️' : '🤍'}
        </motion.button>
      </div>
      <div style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: '0.75rem', color: '#D4A373', fontWeight: 800, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '1px' }}>{book.library_categories?.name || 'General'}</div>
        <h3 style={{ margin: '0 0 8px 0', fontSize: '1.05rem', fontWeight: 800, color: '#3E2C23', lineHeight: 1.3 }}>{book.title}</h3>
        <p style={{ margin: 0, fontSize: '0.85rem', color: '#8B5E3C', fontWeight: 600 }}>by {book.author}</p>
        <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid #FAF3E0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <motion.button whileTap={{ scale: 0.9 }} onClick={onToggleLike} style={{ ...interactionButtonStyle, width: 'auto', padding: '0 12px', color: interaction === 'like' ? '#3B82F6' : '#D1D5DB', backgroundColor: interaction === 'like' ? '#EFF6FF' : 'transparent' }}>
              <i className={interaction === 'like' ? "fa-solid fa-thumbs-up" : "fa-regular fa-thumbs-up"}></i>
              <span style={{ fontSize: '0.85rem', marginLeft: '6px', fontWeight: 700 }}>{counts.likes}</span>
            </motion.button>
            <motion.button whileTap={{ scale: 0.9 }} onClick={onToggleDislike} style={{ ...interactionButtonStyle, width: 'auto', padding: '0 12px', color: interaction === 'dislike' ? '#EF4444' : '#D1D5DB', backgroundColor: interaction === 'dislike' ? '#FEF2F2' : 'transparent' }}>
              <i className={interaction === 'dislike' ? "fa-solid fa-thumbs-down" : "fa-regular fa-thumbs-down"}></i>
              <span style={{ fontSize: '0.85rem', marginLeft: '6px', fontWeight: 700 }}>{counts.dislikes}</span>
            </motion.button>
          </div>
          <div style={{ fontSize: '0.8rem', color: '#A67C52', fontWeight: 600 }}><strong>{book.available_copies}</strong> left</div>
        </div>
      </div>
    </motion.div>
  );
}

// Styles
const dropdownMenuStyle: any = { position: 'absolute', top: '60px', right: 0, width: '280px', backgroundColor: '#FFFFFF', borderRadius: '24px', boxShadow: '0 20px 50px rgba(62, 44, 35, 0.2)', border: '1px solid #FAF3E0', padding: '12px', zIndex: 1000 };
const seeMoreButtonStyle: any = { padding: '10px 20px', borderRadius: '25px', border: '1px dashed #8B5E3C', backgroundColor: 'transparent', color: '#8B5E3C', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px', height: '42px' };
const backButtonStyle: any = { display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 0', border: 'none', background: 'none', color: '#8B5E3C', cursor: 'pointer', fontWeight: 700, marginBottom: '20px', fontSize: '0.95rem' };
const loadingContainerStyle: any = { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' };
const spinnerStyle: any = { width: '40px', height: '40px', border: '4px solid #F3F4F6', borderTopColor: '#8B5E3C', borderRadius: '50%' };
const interactionButtonStyle: any = { border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', width: '40px', height: '40px', borderRadius: '12px' };
const searchInputStyle: any = { width: '100%', padding: '12px 14px 12px 48px', borderRadius: '12px', border: '2px solid #F3F4F6', backgroundColor: '#F9FAFB', fontSize: '0.95rem', outline: 'none', transition: 'all 0.2s', color: '#3E2C23' };
const avatarStyle: any = { width: '45px', height: '45px', backgroundColor: '#8B5E3C', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF', fontWeight: 800, cursor: 'pointer', fontSize: '1.1rem', boxShadow: '0 4px 12px rgba(139, 94, 60, 0.2)' };
