import { motion } from 'framer-motion';
import { ArrowRight, Star, Search } from 'lucide-react';
import bgImage from '../assets/library_bg.png';

const Hero = () => {
  return (
    <div style={{ position: 'relative', minHeight: '80vh', display: 'flex', alignItems: 'center', padding: '0 5%' }}>
      {/* Background Image with Overlay */}
      <div style={{ 
        position: 'absolute', 
        top: 0, 
        left: 0, 
        right: 0, 
        bottom: 0, 
        backgroundImage: `url(${bgImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        opacity: 0.1,
        maskImage: 'linear-gradient(to bottom, black, transparent)',
        zIndex: -1
      }} />

      <div style={{ maxWidth: '800px' }}>
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '100px', backgroundColor: 'var(--glass-bg)', border: '1px solid var(--glass-border)', marginBottom: '24px' }}>
            <Star size={16} color="var(--primary)" fill="var(--primary)" />
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>TRUSTED BY 10,000+ READERS</span>
          </div>

          <h1 style={{ fontSize: '4.5rem', lineHeight: '105%', fontWeight: 700, marginBottom: '24px', letterSpacing: '-1px' }}>
            Elevate Your <span className="text-gradient">Reading</span> Experience
          </h1>
          
          <p style={{ fontSize: '1.25rem', color: 'var(--text-secondary)', marginBottom: '40px', lineHeight: '160%', maxWidth: '600px' }}>
            LuminaLib is the world's most sophisticated library management system. Seamlessly manage your collection, track loans, and discover your next favorite read with our AI-driven discovery engine.
          </p>

          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" style={{ padding: '16px 32px', fontSize: '1.1rem' }}>
              Explore Collection <ArrowRight size={20} />
            </button>
            <button className="btn btn-secondary" style={{ padding: '16px 32px', fontSize: '1.1rem' }}>
              <Search size={20} /> Search Books
            </button>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4, duration: 0.8 }}
          style={{ marginTop: '64px', display: 'flex', gap: '40px' }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)' }}>50k+</span>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Books Available</span>
          </div>
          <div style={{ width: '1px', backgroundColor: 'var(--glass-border)' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)' }}>12k+</span>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Active Members</span>
          </div>
          <div style={{ width: '1px', backgroundColor: 'var(--glass-border)' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)' }}>99%</span>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>User Satisfaction</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Hero;
