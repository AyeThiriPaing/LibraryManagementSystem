import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';

interface AdminDashboardProps {
  session: { name: string; email: string };
  handleLogout: () => void;
}

import { ManageBooks } from './ManageBooks';
import { ManageCategories } from './ManageCategories';
import { ManageBorrowing } from './ManageBorrowing';
import { ManageReports } from './ManageReports';

export function AdminDashboard({ session, handleLogout }: AdminDashboardProps) {
  const [view, setView] = useState<'main' | 'books' | 'categories' | 'borrowing' | 'reports'>('main');
  const [stats, setStats] = useState({
    totalBooks: 0,
    categories: 0,
    borrowedCount: 0,
    availableCount: 0
  });
  const [recentBooks, setRecentBooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (view === 'main') fetchDashboardData();
  }, [view]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      const totalBooksRes = await supabase.from('library_books').select('*', { count: 'exact', head: true });
      const statsCategoriesRes = await supabase.from('library_categories').select('*', { count: 'exact', head: true });
      const activeLoansRes = await supabase.from('library_loans').select('id', { count: 'exact', head: true }).eq('status', 'Active');
      const allBooksRes = await supabase.from('library_books').select('available_copies');
      
      const recentBooksRes = await supabase
        .from('library_books')
        .select('title, author, cover_url, created_at')
        .order('created_at', { ascending: false })
        .limit(3);

      if (totalBooksRes.error) throw totalBooksRes.error;

      const availableCount = allBooksRes.data?.reduce((acc, book) => acc + (book.available_copies || 0), 0) || 0;

      setStats({
        totalBooks: totalBooksRes.count || 0,
        categories: statsCategoriesRes.count || 0,
        borrowedCount: activeLoansRes.count || 0,
        availableCount
      });
      setRecentBooks(recentBooksRes.data || []);
    } catch (err: any) {
      console.error('Error fetching dashboard data:', err);
      setError('Connection slow or failed. Please check your network or refresh.');
    } finally {
      setLoading(false);
    }
  };

  if (view === 'books') return <ManageBooks onBack={() => setView('main')} />;
  if (view === 'categories') return <ManageCategories onBack={() => setView('main')} />;
  if (view === 'borrowing') return <ManageBorrowing onBack={() => setView('main')} />;
  if (view === 'reports') return <ManageReports onBack={() => setView('main')} />;

  return (
    <div style={{ minHeight: '100vh', padding: '40px', backgroundColor: '#FAF3E0', fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif", color: '#3E2C23' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
        <div>
          <motion.h1 initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} style={{ margin: 0, fontSize: '2.5rem', fontWeight: 800, background: 'linear-gradient(to right, #8B5E3C, #F59E0B)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Library's Admin Portal
          </motion.h1>
          <p style={{ margin: '8px 0 0', color: '#8B5E3C', fontSize: '1.1rem', fontWeight: 500 }}>Welcome back, <strong style={{color: '#3E2C23'}}>{session.name}</strong></p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={handleLogout} style={{ padding: '12px 24px', borderRadius: '12px', border: 'none', backgroundColor: '#8B5E3C', color: '#FAF3E0', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 10px rgba(139, 94, 60, 0.2)' }}>
            Log out
          </button>
        </div>
      </div>

      {error && (
        <div style={{ backgroundColor: '#fee2e2', border: '1px solid #ef4444', color: '#991b1b', padding: '16px', borderRadius: '16px', marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>⚠️ {error}</span>
          <button onClick={fetchDashboardData} style={{ background: 'none', border: 'none', color: '#b91c1c', textDecoration: 'underline', cursor: 'pointer', fontWeight: 600 }}>Retry Now</button>
        </div>
      )}

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px', marginBottom: '40px' }}>
        <StatCard title="Total Books" value={stats.totalBooks} icon="📚" color="#8B5E3C" />
        <StatCard title="Categories" value={stats.categories} icon="📂" color="#D4A373" />
        <StatCard title="Borrowed" value={stats.borrowedCount} icon="🕒" color="#F59E0B" />
        <StatCard title="Available Copies" value={stats.availableCount} icon="✅" color="#5a3d27" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '32px' }}>
        {/* Navigation Cards */}
        <section>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '20px', color: '#8B5E3C', fontWeight: 700 }}>Management Controls</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
            <NavCard 
              title="Manage Books" 
              description="Catalog, add or edit books" 
              icon={<i className="fa-solid fa-book"></i>} 
              color="#7D5A50" 
              onClick={() => setView('books')} 
            />
            <NavCard 
              title="Categories" 
              description="Organize library genres" 
              icon={<i className="fa-solid fa-folder"></i>} 
              color="#606C38" 
              onClick={() => setView('categories')} 
            />
            <NavCard 
              title="Borrow Items" 
              description="Track loans and returns" 
              icon={<i className="fa-solid fa-hand-holding-hand"></i>} 
              color="#BC6C25" 
              onClick={() => setView('borrowing')} 
            />
            <NavCard title="Reports" description="Generate library insights" icon={<i className="fa-solid fa-chart-simple"></i>} color="#B8860B" onClick={() => setView('reports')} />
          </div>
        </section>

        {/* Recently Added Books */}
        <section>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '20px', color: '#8B5E3C', fontWeight: 700 }}>Recently Added</h2>
          <div style={{ position: 'relative', backgroundColor: '#FFFFFF', borderRadius: '24px', padding: '24px', border: '1px solid #e5e7eb', boxShadow: '0 10px 30px rgba(139, 94, 60, 0.08)', minHeight: '200px' }}>
            {loading ? (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255, 255, 255, 0.7)', borderRadius: '24px', zIndex: 5 }}>
                <div style={{ width: '30px', height: '30px', border: '3px solid rgba(139, 94, 60, 0.1)', borderTopColor: '#8B5E3C', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
              </div>
            ) : null}

            {recentBooks.length > 0 ? (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {recentBooks.map((book, idx) => (
                  <motion.li 
                    key={idx}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    style={{ padding: '16px 0', borderBottom: idx === recentBooks.length - 1 ? 'none' : '1px solid #f3f4f6', display: 'flex', gap: '16px', alignItems: 'center' }}
                  >
                    {/* Thumbnail */}
                    <div style={{ width: '45px', height: '65px', borderRadius: '8px', backgroundColor: '#FAF3E0', overflow: 'hidden', flexShrink: 0, border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {book.cover_url ? (
                        <img src={book.cover_url} alt="cover" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <span style={{ fontSize: '1.2rem' }}>📖</span>
                      )}
                    </div>
                    {/* Details */}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, color: '#3E2C23', fontSize: '0.95rem' }}>{book.title}</div>
                      <div style={{ fontSize: '0.8rem', color: '#8B5E3C' }}>by {book.author}</div>
                      <div style={{ fontSize: '0.7rem', color: '#D4A373', marginTop: '4px', fontWeight: 700 }}>
                        📅 {new Date(book.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                    </div>
                  </motion.li>
                ))}
              </ul>
            ) : (
              !loading && <p style={{ color: '#D4A373', textAlign: 'center' }}>No books found in the catalog.</p>
            )}
          </div>
        </section>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

function StatCard({ title, value, icon, color }: { title: string, value: number, icon: string, color: string }) {
  return (
    <motion.div 
      whileHover={{ y: -5 }}
      style={{ backgroundColor: '#FFFFFF', padding: '24px', borderRadius: '24px', border: '1px solid #e5e7eb', boxShadow: '0 10px 30px rgba(139, 94, 60, 0.05)', position: 'relative', overflow: 'hidden' }}
    >
      <div style={{ fontSize: '2.4rem', position: 'absolute', right: '-10px', bottom: '-10px', opacity: 0.1, transform: 'rotate(-15deg)', color: color }}>{icon}</div>
      <div style={{ fontSize: '0.9rem', color: '#8B5E3C', fontWeight: 700, marginBottom: '8px' }}>{title}</div>
      <div style={{ fontSize: '2rem', fontWeight: 800, color: '#3E2C23' }}>{value}</div>
      <div style={{ height: '4px', width: '40px', backgroundColor: color, marginTop: '12px', borderRadius: '2px' }} />
    </motion.div>
  );
}

function NavCard({ title, description, icon, color, onClick }: { title: string, description: string, icon: any, color: string, onClick?: () => void }) {
  return (
    <motion.div 
      whileHover={{ scale: 1.02, backgroundColor: '#3E2C23' }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      style={{ backgroundColor: color, padding: '24px', borderRadius: '20px', cursor: 'pointer', display: 'flex', gap: '16px', alignItems: 'center', transition: 'all 0.3s' }}
    >
      <div style={{ fontSize: '2.2rem', background: 'rgba(255, 255, 255, 0.25)', width: '65px', height: '65px', display: 'flex', justifyContent: 'center', alignItems: 'center', borderRadius: '18px', color: '#FFFFFF', boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.1)' }}>{icon}</div>
      <div>
        <div style={{ fontWeight: 800, color: 'white', fontSize: '1.2rem' }}>{title}</div>
        <div style={{ fontSize: '0.85rem', color: 'rgba(250,243,224,0.8)', marginTop: '4px' }}>{description}</div>
      </div>
    </motion.div>
  );
}
