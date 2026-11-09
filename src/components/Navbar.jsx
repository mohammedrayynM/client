
import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useNavigate as useRouter } from 'react-router-dom';
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
      try {
        setUser(JSON.parse(userData));
      } catch { setUser(null); }
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('userToken');
    localStorage.removeItem('userData');
    setUser(null);
    router('/login');
  };

  // Close menu when clicking outside
  useEffect(() => {
    if (menuOpen) {
      const handler = (e) => {
        if (!e.target.closest('.navbar-links') && !e.target.closest('.nav-toggle')) {
          setMenuOpen(false);
        }
      };
      const handleKeyDown = (e) => {
        if (e.key === 'Escape') setMenuOpen(false);
      };
      document.addEventListener('click', handler);
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('click', handler);
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [menuOpen]);

  return (
    <nav className="navbar" id="main-navbar">
      <div className="container">
        <Link to="/" className="navbar-logo" style={{ display: 'flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }}>
          <img src="/images/logo.png" alt="Book Arena Logo" loading="eager" decoding="async" style={{ height: '38px', width: 'auto', borderRadius: '8px' }} />
          <span style={{ fontWeight: 800, fontSize: '1.1rem' }}>Book <span className="accent">Arena</span></span>
        </Link>

        <button
          className="nav-toggle"
          onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
          aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={menuOpen}
          aria-controls="primary-navigation"
        >
          <span style={menuOpen ? { transform: 'rotate(45deg) translate(5px, 5px)' } : {}}></span>
          <span style={menuOpen ? { opacity: 0 } : {}}></span>
          <span style={menuOpen ? { transform: 'rotate(-45deg) translate(5px, -5px)' } : {}}></span>
        </button>

        <ul className={`navbar-links ${menuOpen ? 'open' : ''}`} id="primary-navigation">
          <li><Link to="/" onClick={() => setMenuOpen(false)}>Home</Link></li>
          <li><Link to="/turfs" onClick={() => setMenuOpen(false)}>Browse Turfs</Link></li>
          <li><Link to="/activities" onClick={() => setMenuOpen(false)}>Amusement Parks</Link></li>
          <li><Link to="/tournaments" onClick={() => setMenuOpen(false)}>Tournaments</Link></li>
          <li><Link to="/find-players" onClick={() => setMenuOpen(false)}>Find Players</Link></li>
          <li><Link to="/blog" onClick={() => setMenuOpen(false)}>Blog</Link></li>
          <li><Link to="/about" onClick={() => setMenuOpen(false)}>About</Link></li>
          <li><Link to="/contact" onClick={() => setMenuOpen(false)}>Contact</Link></li>
          {user && (
            <>
              <li><Link to="/profile" onClick={() => setMenuOpen(false)}>My Bookings</Link></li>
              
              {/* Mobile-only Account Section inside menu */}
              <li className="mobile-only mobile-account-section">
                <div className="mobile-account-card">
                  <div className="mobile-account-info">
                    {user.profile_pic ? (
                      <img src={user.profile_pic} alt={user.name} className="mobile-account-pic" loading="lazy" decoding="async" />
                    ) : (
                      <div className="mobile-account-avatar">
                        {user.name?.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div className="mobile-account-name">{user.name}</div>
                      <div className="mobile-account-email">{user.email}</div>
                    </div>
                  </div>
                  <button 
                    onClick={() => { handleLogout(); setMenuOpen(false); }} 
                    className="mobile-logout-btn"
                  >
                    🚪 Logout
                  </button>
                </div>
              </li>
            </>
          )}
          {!user && (
            <li className="mobile-only" style={{ marginTop: 'auto', paddingTop: '1rem' }}>
              <Link to="/login" onClick={() => setMenuOpen(false)} className="btn btn-primary" style={{ width: '100%', textAlign: 'center', borderRadius: '50px' }}>
                Login / Register
              </Link>
            </li>
          )}
        </ul>

        <LocationBar compact={true} />

        {/* Desktop-only Account button */}
        <div className="navbar-actions desktop-only">
          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Link to="/profile" className="btn btn-primary user-profile-btn" style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px',
                padding: '6px 12px',
                borderRadius: '50px'
              }}>
                {user.profile_pic ? (
                  <img src={user.profile_pic} alt={user.name} loading="lazy" decoding="async" style={{ width: '20px', height: '20px', borderRadius: '50%' }} />
                ) : (
                  <span style={{ fontSize: '1rem' }}>👤</span>
                )}
                <span className="user-name-nav" style={{ fontWeight: 700, fontSize: '0.85rem' }}>{user.name.split(' ')[0]}</span>
              </Link>
              <button 
                onClick={handleLogout}
                className="btn btn-secondary btn-sm" 
                style={{ borderRadius: '50px', padding: '6px 14px' }}
              >
                Logout
              </button>
            </div>
          ) : (
            <Link to="/login" className="btn btn-primary btn-sm" style={{ 
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
