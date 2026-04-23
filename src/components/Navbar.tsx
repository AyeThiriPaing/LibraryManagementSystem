import React from 'react';
import { Menu, X, Library } from 'lucide-react';

const Navbar = () => {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <nav className="glass-card" style={{ 
      margin: '1rem', 
      padding: '0.75rem 1.5rem', 
      position: 'sticky', 
      top: '1rem', 
      zIndex: 50,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderRadius: '16px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <div style={{ 
          background: 'linear-gradient(135deg, var(--primary), var(--accent))',
          padding: '8px',
          borderRadius: '10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Library size={24} color="white" />
        </div>
        <span style={{ 
          fontSize: '1.25rem', 
          fontWeight: 700, 
          fontFamily: 'Space Grotesk',
          letterSpacing: '-0.5px'
        }}>
          Lumina<span style={{ color: 'var(--primary)' }}>Lib</span>
        </span>
      </div>

      {/* Desktop Menu */}
      <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }} className="desktop-menu">
        <a href="#" className="nav-link" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontWeight: 500 }}>Books</a>
        <a href="#" className="nav-link" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontWeight: 500 }}>Categories</a>
        <a href="#" className="nav-link" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontWeight: 500 }}>About</a>
        <button className="btn btn-primary">Get Started</button>
      </div>

      {/* Mobile Toggle */}
      <div className="mobile-toggle" style={{ display: 'none' }} onClick={() => setIsOpen(!isOpen)}>
        {isOpen ? <X /> : <Menu />}
      </div>
    </nav>
  );
};

export default Navbar;
