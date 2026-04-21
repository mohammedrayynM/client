import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="footer" id="footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand">
            <div className="logo" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <img src="/images/logo.png" alt="Book Arena Logo" style={{ height: '45px', width: 'auto', borderRadius: '8px' }} />
              <span>Book <span style={{ color: 'var(--emerald-400)' }}>Arena</span></span>
            </div>
            <p>
              Your one-stop platform for booking sports turfs. 
              Play your favorite sport, anytime, anywhere.
            </p>
          </div>

          <div className="footer-col">
            <h4>Quick Links</h4>
            <ul>
              <li><Link href="/turfs">Browse Turfs</Link></li>
              <li><Link href="/owner/register">List Your Turf</Link></li>
              <li><Link href="/owner/login">Owner Login</Link></li>
            </ul>
          </div>

          <div className="footer-col">
            <h4>Sports</h4>
            <ul>
              <li><Link href="/turfs?sport=cricket">Cricket</Link></li>
              <li><Link href="/turfs?sport=football">Football</Link></li>
              <li><Link href="/turfs?sport=badminton">Badminton</Link></li>
              <li><Link href="/turfs?sport=tennis">Tennis</Link></li>
            </ul>
          </div>

          <div className="footer-col">
            <h4>Support</h4>
            <ul>
              <li><Link href="/contact">Contact Us</Link></li>
              <li><Link href="/about">About Us</Link></li>
              <li><Link href="/terms">Terms & Conditions</Link></li>
              <li><Link href="/privacy">Privacy Policy</Link></li>
              <li><Link href="/refund">Refund Policy</Link></li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <p>© {new Date().getFullYear()} BookArena. All rights reserved.</p>
          <p>Made with 💚 for sports lovers</p>
        </div>
      </div>
    </footer>
  );
}
