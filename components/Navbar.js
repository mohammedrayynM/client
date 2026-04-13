'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="navbar" id="main-navbar">
      <div className="container">
        <Link href="/" className="navbar-logo">
          <div className="logo-icon">🏟️</div>
          Book<span className="accent">My</span>Arena
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
        </ul>

        <div className="navbar-actions">
          <Link href="/turfs" className="btn btn-primary btn-sm" style={{ 
            padding: '8px 16px', 
            fontSize: '0.75rem',
            borderRadius: '50px',
            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
          }}>
            Book Now
          </Link>
        </div>
      </div>
    </nav>
  );
}
