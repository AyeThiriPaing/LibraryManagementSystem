import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';

interface ManageReportsProps {
  onBack: () => void;
}

export function ManageReports({ onBack }: ManageReportsProps) {
  const [stats, setStats] = useState({
    monthlyBorrows: 0,
    registeredUsers: 0,
    unregisteredUsers: 0
  });
  const [topCategories, setTopCategories] = useState<any[]>([]);
  const [topBooks, setTopBooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReportData();
  }, []);

  const fetchReportData = async () => {
    try {
      setLoading(true);
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

      const [monthlyRes, regRes, guestLoansRes, allLoansRes] = await Promise.all([
        supabase.from('library_loans').select('id', { count: 'exact', head: true }).gte('loan_date', oneMonthAgo.toISOString()),
        supabase.from('library_auth').select('id', { count: 'exact', head: true }).eq('user_type', 'User'),
        supabase.from('library_loans').select('borrower_name, national_id').is('user_id', null),
        supabase.from('library_loans').select('book_id, library_books(title, library_categories(name))')
      ]);

      const uniqueGuests = new Set(guestLoansRes.data?.map(l => l.national_id || l.borrower_name));

      setStats({
        monthlyBorrows: monthlyRes.count || 0,
        registeredUsers: regRes.count || 0,
        unregisteredUsers: uniqueGuests.size
      });

      if (allLoansRes.data) {
        const bookMap: Record<string, number> = {};
        const catMap: Record<string, number> = {};

        allLoansRes.data.forEach((loan: any) => {
          if (!loan.library_books) return;
          const bTitle = loan.library_books.title;
          const cName = loan.library_books.library_categories?.name || 'Uncategorized';
          bookMap[bTitle] = (bookMap[bTitle] || 0) + 1;
          catMap[cName] = (catMap[cName] || 0) + 1;
        });

        const sortAndSlice = (obj: Record<string, number>) => 
          Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count }));

        setTopBooks(sortAndSlice(bookMap));
        setTopCategories(sortAndSlice(catMap));
      }
    } catch (err) {
      console.error('Report Error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', padding: '40px', backgroundColor: '#FAF3E0', color: '#3E2C23', fontFamily: "'Outfit', 'Inter', sans-serif" }}>
      {/* Premium Header Container */}
      <div style={{ maxWidth: '1200px', margin: '0 auto', position: 'relative' }}>
        
        {/* Navigation - Top Left */}
        <motion.button 
          whileHover={{ scale: 1.1, backgroundColor: '#3E2C23', color: '#FAF3E0' }}
          whileTap={{ scale: 0.9 }}
          onClick={onBack} 
          style={{ position: 'absolute', left: 0, top: 0, width: '56px', height: '56px', borderRadius: '50%', border: 'none', background: '#FFFFFF', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', boxShadow: '0 10px 25px rgba(62, 44, 35, 0.1)', color: '#3E2C23', fontSize: '1.2rem', zIndex: 10, transition: 'all 0.3s' }}
        >
          ←
        </motion.button>

        <div style={{ textAlign: 'center', marginBottom: '64px', paddingTop: '10px' }}>
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
             <h4 style={{ margin: '0 0 12px', color: '#8B5E3C', letterSpacing: '4px', textTransform: 'uppercase', fontSize: '0.8rem', fontWeight: 800 }}>System Intelligence</h4>
             <h1 style={{ margin: 0, fontSize: '3.5rem', fontWeight: 900, background: 'linear-gradient(to bottom, #3E2C23, #8B5E3C)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Library Statistics</h1>
          </motion.div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}>
            <div className="premium-loader"></div>
          </div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
            
            {/* KPI Highlights - Glass Design */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '32px', marginBottom: '48px' }}>
               <KPIGard title="Performance" label="Monthly Borrows" value={stats.monthlyBorrows} icon="📈" gradient="linear-gradient(135deg, #8B5E3C, #3E2C23)" />
               <KPIGard title="Community" label="Registered Members" value={stats.registeredUsers} icon="👥" gradient="linear-gradient(135deg, #D4A373, #8B5E3C)" />
               <KPIGard title="Reach" label="Guest Borrowers" value={stats.unregisteredUsers} icon="🌐" gradient="linear-gradient(135deg, #3E2C23, #1A1A1A)" />
            </div>

            {/* Analytics Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
              <DataList title="Favorite Categories" items={topCategories} type="cat" />
              <DataList title="Top Loaned Books" items={topBooks} type="book" />
            </div>

          </motion.div>
        )}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;700;900&display=swap');
        .premium-loader { width: 48px; height: 48px; border: 5px solid #FAF3E0; border-top-color: #8B5E3C; border-radius: 50%; animation: spin 1s infinite linear; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

function KPIGard({ title, label, value, icon, gradient }: any) {
  return (
    <motion.div 
      whileHover={{ y: -10, boxShadow: '0 20px 40px rgba(62, 44, 35, 0.15)' }}
      style={{ background: '#FFFFFF', padding: '40px', borderRadius: '32px', position: 'relative', overflow: 'hidden', border: '1px solid rgba(139, 94, 60, 0.15)', boxShadow: '0 10px 30px rgba(139, 94, 60, 0.05)' }}
    >
      <div style={{ position: 'absolute', right: '-15px', bottom: '-15px', fontSize: '6rem', opacity: 0.05, transform: 'rotate(-15deg)' }}>{icon}</div>
      <div style={{ fontSize: '0.75rem', fontWeight: 900, color: '#D4A373', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '8px' }}>{title}</div>
      <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#8B5E3C', marginBottom: '16px' }}>{label}</div>
      <div style={{ fontSize: '3rem', fontWeight: 900, color: '#3E2C23' }}>{value}</div>
      <div style={{ width: '40px', height: '4px', background: gradient, borderRadius: '2px', marginTop: '16px' }} />
    </motion.div>
  );
}

function DataList({ title, items, type }: any) {
  return (
    <motion.div 
      initial={{ x: type === 'cat' ? -20 : 20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      style={{ backgroundColor: '#FFFFFF', padding: '40px', borderRadius: '40px', border: '1px solid #D4A373', boxShadow: '0 15px 45px rgba(139, 94, 60, 0.08)' }}
    >
      <h3 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#3E2C23', marginBottom: '32px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ color: '#F59E0B' }}>
          {type === 'cat' ? <i className="fa-solid fa-star"></i> : <i className="fa-solid fa-book-open-reader"></i>}
        </span> 
        {title}
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {items.map((item: any, idx: number) => (
          <motion.div 
            key={idx}
            whileHover={{ x: 8 }}
            style={{ display: 'flex', alignItems: 'center', padding: '20px', backgroundColor: idx === 0 ? '#FAF3E0' : 'rgba(250, 243, 224, 0.4)', borderRadius: '24px', border: idx === 0 ? '1px solid #D4A373' : '1px solid rgba(212, 163, 115, 0.1)', transition: 'all 0.3s' }}
          >
            <div style={{ width: '36px', height: '36px', borderRadius: '12px', background: idx === 0 ? '#F59E0B' : '#E5E7EB', display: 'flex', justifyContent: 'center', alignItems: 'center', color: idx === 0 ? 'white' : '#8B5E3C', fontWeight: 900, fontSize: '0.9rem', marginRight: '16px' }}>
              {idx + 1}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, color: '#3E2C23', fontSize: '1rem' }}>{item.name}</div>
              <div style={{ fontSize: '0.75rem', color: '#8B5E3C', marginTop: '4px', fontWeight: 600 }}>{type === 'cat' ? 'CATEGORICAL POPULARITY' : 'MOST LOANED CATALOG ITEM'}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 900, fontSize: '1.2rem', color: '#8B5E3C' }}>{item.count}</div>
              <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 800, color: '#D4A373' }}>Loans</div>
            </div>
          </motion.div>
        ))}
        {items.length === 0 && <p style={{ textAlign: 'center', color: '#D4A373', padding: '20px' }}>No activity data found yet.</p>}
      </div>
    </motion.div>
  );
}
