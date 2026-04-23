import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import bcrypt from 'bcryptjs';
import { supabase } from './lib/supabase';

import { AdminDashboard } from './components/AdminDashboard';
import { UserDashboard } from './components/UserDashboard';

function App() {
  const [session, setSession] = useState<{ email: string; name: string; userType: string } | null>(null);
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const savedEmail = localStorage.getItem('user_email');
    const savedName = localStorage.getItem('user_name');
    const savedType = localStorage.getItem('user_type');
    if (savedEmail && savedName && savedType) {
      setSession({ email: savedEmail, name: savedName, userType: savedType });
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data: user, error: fetchError } = await supabase
        .from('library_auth')
        .select('*')
        .eq('email', email)
        .single();

      if (fetchError || !user) throw new Error("User doesn't exist.");

      const match = await bcrypt.compare(password, user.password_hash);
      if (!match) throw new Error("Incorrect password.");

      localStorage.setItem('user_email', user.email);
      localStorage.setItem('user_name', user.name);
      localStorage.setItem('user_type', user.user_type);
      setSession({ email: user.email, name: user.name, userType: user.user_type });
    } catch (err: any) {
      setError(err.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!isLogin && !nationalId.trim()) {
      setError("Please fill in your National ID.");
      setLoading(false);
      return;
    }

    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const { error: registerError } = await supabase
        .from('library_auth')
        .insert([{ 
          name, 
          email, 
          password_hash: hashedPassword, 
          national_id: nationalId.trim(),
          user_type: 'User' 
        }]);

      if (registerError) throw registerError;

      setIsLogin(true);
      setError(null);
      setName('');
      setPassword('');
      setNationalId('');
    } catch (err: any) {
      if (err.code === '23505' || err.message?.includes('duplicate') || err.message?.includes('national_id')) {
        setError("national_id already existed, cannot create the account");
      } else {
        setError(err.message || 'Registration failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('user_email');
    localStorage.removeItem('user_name');
    localStorage.removeItem('user_type');
    setSession(null);
  };

  if (!session) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#FAF3E0', fontFamily: 'sans-serif' }}>
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          style={{ background: '#FFFFFF', padding: '48px', borderRadius: '32px', boxShadow: '0 25px 60px rgba(139, 94, 60, 0.15)', width: isLogin ? '400px' : '700px', border: '1px solid #D4A373', transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)' }}
        >
          <AnimatePresence mode="wait">
            <motion.div 
              key={isLogin ? 'login' : 'register'}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <h1 style={{ textAlign: 'center', margin: '0 0 12px', color: '#8B5E3C', fontSize: '2.2rem', fontWeight: 800 }}>
                {isLogin ? 'Welcome Back' : 'Create Account'}
              </h1>
              <p style={{ textAlign: 'center', marginBottom: '40px', color: '#D4A373', fontWeight: 500 }}>
                {isLogin ? 'Sign in to access your library account' : 'Register to manage your borrowed books'}
              </p>
            </motion.div>
          </AnimatePresence>
          
          {error && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }} 
              animate={{ opacity: 1, height: 'auto' }} 
              style={{ color: '#991b1b', marginBottom: '20px', fontSize: '0.9rem', backgroundColor: '#fee2e2', padding: '12px', borderRadius: '12px', textAlign: 'center', border: '1px solid #f87171', fontWeight: 600 }}
            >
              {error}
            </motion.div>
          )}

          <form onSubmit={isLogin ? handleLogin : handleRegister} style={{ display: 'grid', gridTemplateColumns: isLogin ? '1fr' : '1fr 1fr', gap: '20px' }}>
            {!isLogin && (
              <>
                <div style={inputGroupStyle}>
                  <label style={labelStyle}>Full Name</label>
                  <input 
                    type="text" 
                    placeholder="Paing" 
                    value={name} 
                    onChange={(e) => setName(e.target.value)} 
                    style={inputStyle} 
                    required 
                  />
                </div>
                <div style={inputGroupStyle}>
                  <label style={labelStyle}>National ID Number</label>
                  <input 
                    type="text" 
                    placeholder="Ex: 12/ABC(N)123456" 
                    value={nationalId} 
                    onChange={(e) => setNationalId(e.target.value)} 
                    style={inputStyle} 
                    required 
                  />
                </div>
              </>
            )}
            <div style={inputGroupStyle}>
              <label style={labelStyle}>Email Address</label>
              <input 
                type="email" 
                placeholder="paing@example.com" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                style={inputStyle} 
                required 
              />
            </div>
            <div style={inputGroupStyle}>
              <label style={labelStyle}>Password</label>
              <input 
                type="password" 
                placeholder="••••••••" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                style={inputStyle} 
                required 
              />
            </div>
            <motion.button 
              whileHover={{ scale: 1.02, backgroundColor: '#3E2C23' }}
              whileTap={{ scale: 0.98 }}
              type="submit" 
              disabled={loading}
              style={{ 
                padding: '16px', 
                borderRadius: '16px', 
                border: 'none', 
                backgroundColor: loading ? '#D4A373' : '#8B5E3C', 
                color: 'white', 
                fontWeight: 700, 
                cursor: loading ? 'not-allowed' : 'pointer', 
                fontSize: '1.1rem', 
                marginTop: '15px',
                boxShadow: '0 10px 20px rgba(139, 94, 60, 0.2)',
                transition: 'all 0.3s',
                gridColumn: isLogin ? 'span 1' : 'span 2'
              }}
            >
              {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Sign Up')}
            </motion.button>
          </form>

          <p style={{ textAlign: 'center', marginTop: '32px', fontSize: '1rem', color: '#D4A373', fontWeight: 500 }}>
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <span onClick={() => { setIsLogin(!isLogin); setError(null); }} style={{ color: '#8B5E3C', cursor: 'pointer', fontWeight: 800, textDecoration: 'underline' }}>
              {isLogin ? 'Register Now' : 'Login Here'}
            </span>
          </p>
        </motion.div>
      </div>
    );
  }

  if (session.userType === 'Admin') {
    return <AdminDashboard session={session} handleLogout={handleLogout} />;
  }
  return <UserDashboard session={session} handleLogout={handleLogout} />;
}

const inputGroupStyle = {
  display: 'flex',
  flexDirection: 'column' as const,
  gap: '8px'
};

const labelStyle = {
  fontSize: '0.85rem',
  fontWeight: 700,
  color: '#8B5E3C',
  marginLeft: '4px'
};

const inputStyle = { 
  padding: '16px', 
  borderRadius: '16px', 
  border: '2px solid #FAF3E0', 
  backgroundColor: '#FAF3E0', 
  color: '#3E2C23', 
  fontSize: '1rem', 
  outline: 'none',
  transition: 'all 0.3s',
  fontWeight: 500
};

export default App;
