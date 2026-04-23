import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';

interface ManageCategoriesProps {
  onBack: () => void;
}

export function ManageCategories({ onBack }: ManageCategoriesProps) {
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Custom Modal State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<any>(null);

  // Form State
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      // Fetching categories and counting books per category
      const { data, error: fetchError } = await supabase
        .from('library_categories')
        .select(`
          *,
          library_books(count)
        `)
        .order('name');
      
      if (fetchError) throw fetchError;
      
      // Transform data to make book_count easier to access
      const transformedData = data?.map(cat => ({
        ...cat,
        book_count: cat.library_books?.[0]?.count || 0
      })) || [];

      setCategories(transformedData);
    } catch (err: any) {
      console.error('Error fetching categories:', err);
      setError('Could not load categories.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setName('');
    setEditingId(null);
    setShowForm(false);
    setError(null);
  };

  const handleEditClick = (cat: any) => {
    setName(cat.name);
    setEditingId(cat.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      setLoading(true);
      setError(null);
      if (editingId) {
        const { error: updateError } = await supabase
          .from('library_categories')
          .update({ name: name.trim() })
          .eq('id', editingId);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('library_categories')
          .insert([{ name: name.trim() }]);
        if (insertError) throw insertError;
      }

      resetForm();
      fetchCategories();
    } catch (err: any) {
      if (err.code === '23505' || err.message?.includes('duplicate') || err.message?.includes('unique constraint')) {
        setError("Your created category name is already existed. You cannot create duplicated");
      } else {
        setError(err.message || 'Operation failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setLoading(true);
      const { error: deleteError } = await supabase
        .from('library_categories')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;
      fetchCategories();
      setShowDeleteModal(false);
      setCategoryToDelete(null);
    } catch (err: any) {
      setError(err.message || 'Failed to delete category.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', padding: '40px', backgroundColor: '#FAF3E0', color: '#3E2C23', fontFamily: 'sans-serif' }}>
      
      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(62, 44, 35, 0.4)', backdropFilter: 'blur(10px)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              style={{ backgroundColor: '#FFFFFF', width: '100%', maxWidth: '400px', borderRadius: '32px', padding: '40px', border: '1px solid #D4A373', boxShadow: '0 25px 60px rgba(139, 94, 60, 0.2)', textAlign: 'center' }}
            >
              <div style={{ fontSize: '3.5rem', marginBottom: '20px' }}>{categoryToDelete?.book_count > 0 ? '🚫' : '📁'}</div>
              <h3 style={{ fontSize: '1.6rem', marginBottom: '12px', color: '#3E2C23', fontWeight: 800 }}>
                {categoryToDelete?.book_count > 0 ? 'Cannot Delete' : 'Remove Category?'}
              </h3>
              
              <p style={{ color: '#8B5E3C', marginBottom: '32px', lineHeight: 1.6, fontWeight: 500 }}>
                {categoryToDelete?.book_count > 0 ? (
                  <>The category <strong style={{color: '#b91c1c'}}>"{categoryToDelete?.name}"</strong> already has books, you can't delete it. Please move or remove the books first.</>
                ) : (
                  <>Are you sure you want to delete <strong style={{color: '#8B5E3C'}}>"{categoryToDelete?.name}"</strong>? This action cannot be undone.</>
                )}
              </p>
              
              <div style={{ display: 'flex', gap: '12px' }}>
                <button 
                  onClick={() => setShowDeleteModal(false)}
                  style={{ flex: 1, padding: '16px', borderRadius: '16px', border: '1px solid #D4A373', backgroundColor: '#FAF3E0', color: '#8B5E3C', fontWeight: 700, cursor: 'pointer' }}
                >
                  {categoryToDelete?.book_count > 0 ? 'Close' : 'Cancel'}
                </button>
                {categoryToDelete?.book_count === 0 && (
                  <button 
                    onClick={() => handleDelete(categoryToDelete.id)}
                    disabled={loading}
                    style={{ flex: 1, padding: '16px', borderRadius: '16px', border: 'none', backgroundColor: '#8B5E3C', color: 'white', fontWeight: 800, cursor: 'pointer' }}
                  >
                    {loading ? '...' : 'Remove'}
                  </button>
                )}
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
          style={{ backgroundColor: showForm ? '#D4A373' : '#8B5E3C', color: 'white', padding: '14px 28px', borderRadius: '16px', border: 'none', fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 10px 20px rgba(139, 94, 60, 0.1)' }}
        >
          {showForm ? 'Cancel Operation' : '+ Add Category'}
        </button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            style={{ backgroundColor: '#FFFFFF', padding: '32px', borderRadius: '24px', marginBottom: '40px', border: '1px solid #D4A373', boxShadow: '0 10px 40px rgba(139, 94, 60, 0.08)' }}
          >
            <h2 style={{ marginBottom: '24px', color: '#8B5E3C', fontWeight: 800 }}>
              {editingId ? 'Edit Categories Name' : 'Create New Library Category'}
            </h2>
            {error && <div style={{ color: '#991b1b', marginBottom: '20px', fontSize: '0.9rem', backgroundColor: '#fee2e2', padding: '12px', borderRadius: '12px', border: '1px solid #f87171' }}>{error}</div>}
            
            <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '16px' }}>
              <input 
                placeholder="Ex: Mystery, History, Science Fiction" 
                value={name} 
                onChange={e => setName(e.target.value)} 
                style={{ flex: 1, padding: '16px', borderRadius: '16px', border: '2px solid #FAF3E0', backgroundColor: '#FAF3E0', color: '#3E2C23', fontSize: '1rem', outline: 'none', fontWeight: 500 }} 
                required 
              />
              <button type="submit" disabled={loading} style={{ padding: '0 32px', borderRadius: '16px', border: 'none', backgroundColor: '#8B5E3C', color: 'white', fontWeight: 800, cursor: 'pointer', boxShadow: '0 8px 20px rgba(139, 94, 60, 0.2)' }}>
                {loading ? 'Working...' : (editingId ? 'Save Changes' : 'Create Category')}
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <h2 style={{ marginBottom: '24px', color: '#8B5E3C', fontWeight: 800 }}>Library's Category Catalog</h2>
      <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #D4A373', borderRadius: '32px', overflow: 'hidden', boxShadow: '0 15px 35px rgba(139, 94, 60, 0.05)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ backgroundColor: '#8B5E3C' }}>
              <th style={thStyle}>Categories Name</th>
              <th style={thStyle}>Books in Categories</th>
              <th style={thStyle}>Date Created</th>
              <th style={thStyle}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((cat, idx) => (
              <tr key={cat.id} style={{ borderBottom: idx === categories.length - 1 ? 'none' : '1px solid #f3f4f6', transition: 'background-color 0.2s' }}>
                <td style={{...tdStyle, fontWeight: 700, fontSize: '1.1rem'}}>{cat.name}</td>
                <td style={tdStyle}>
                  <span style={{ backgroundColor: '#FAF3E0', color: '#8B5E3C', border: '1px solid #D4A373', padding: '6px 14px', borderRadius: '20px', fontWeight: 800, fontSize: '0.9rem' }}>
                    {cat.book_count} {cat.book_count === 1 ? 'Book' : 'Books'}
                  </span>
                </td>
                <td style={tdStyle}>
                  <div style={{ color: '#D4A373', fontWeight: 600 }}>
                    {new Date(cat.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </div>
                </td>
                <td style={tdStyle}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                      onClick={() => handleEditClick(cat)}
                      style={{ backgroundColor: '#FFFFFF', color: '#8B5E3C', border: '1px solid #D4A373', padding: '8px 16px', borderRadius: '12px', cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem' }}
                    >
                      <i className="fa-regular fa-pen-to-square" style={{ marginRight: '6px' }}></i> Edit
                    </button>
                    <button 
                      onClick={() => { setCategoryToDelete(cat); setShowDeleteModal(true); }}
                      style={{ backgroundColor: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5', padding: '8px 16px', borderRadius: '12px', cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem' }}
                    >
                      <i className="fa-regular fa-trash-can" style={{ marginRight: '6px' }}></i> Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {categories.length === 0 && !loading && (
          <div style={{ padding: '60px', textAlign: 'center', color: '#D4A373' }}>
            {/* <div style={{ fontSize: '3rem', marginBottom: '16px' }}>📭</div> */}
            <p style={{ fontSize: '1.2rem', fontWeight: 600 }}>No categories found. Start by adding one!</p>
          </div>
        )}
        {loading && <div style={{ padding: '40px', textAlign: 'center', color: '#8B5E3C', fontWeight: 600 }}>Synchronizing catalog...</div>}
      </div>
    </div>
  );
}

const thStyle = { padding: '20px 32px', color: '#FAF3E0', fontWeight: 800, fontSize: '1rem' };
const tdStyle = { padding: '24px 32px', color: '#3E2C23' };
