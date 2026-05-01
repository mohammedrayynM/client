'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import LocationBar from './LocationBar';

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState(null);
  const router = useRouter();

  useEffect(() => {
    // Check if user is logged in
    const token = localStorage.getItem('userToken');
    const userData = localStorage.getItem('userData');
    if (token && userData) {
      setUser(JSON.parse(userData));
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('userToken');
    localStorage.removeItem('userData');
    setUser(null);
    router.push('/login');
  };

  return (
    <nav className="navbar" id="main-navbar">
      <div className="container">
        <Link href="/" className="navbar-logo" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
          <img src="/images/logo.png" alt="Book Arena Logo" style={{ height: '45px', width: 'auto', borderRadius: '8px' }} />
          <span>Book <span className="accent">Arena</span></span>
        </Link>

        <button className="nav-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu">
          <span></span>
          <span></span>
          <span></span>
        </button>

        <ul className={`navbar-links ${menuOpen ? 'open' : ''}`}>
          <li><Link href="/" onClick={() => setMenuOpen(false)}>Home</Link></li>
          <li><Link href="/turfs" onClick={() => setMenuOpen(false)}>Browse Turfs</Link></li>
          <li><Link href="/about" onClick={() => setMenuOpen(false)}>About</Link></li>
          <li><Link href="/contact" onClick={() => setMenuOpen(false)}>Contact</Link></li>
          {user && <li><Link href="/profile" onClick={() => setMenuOpen(false)}>My Bookings</Link></li>}
        </ul>

        <LocationBar compact={true} />

        <div className="navbar-actions">
          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Link href="/profile" className="btn btn-primary user-profile-btn" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {user.profile_pic ? (
                  <img src={user.profile_pic} alt={user.name} style={{ width: '24px', height: '24px', borderRadius: '50%' }} />
                ) : (
                  <span>👋</span>
                )}
                <span>Hello, {user.name.split(' ')[0]}</span>
              </Link>
              <button 
                onClick={handleLogout}
                className="btn btn-secondary btn-sm logout-btn" 
              >
                Logout
              </button>
            </div>
          ) : (
            <Link href="/login" className="btn btn-primary btn-sm" style={{ 
              padding: '8px 16px', 
              fontSize: '0.75rem',
              borderRadius: '50px',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
            }}>
              Login / Register
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
