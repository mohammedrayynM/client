'use client';

import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export default function AboutUs() {
  return (
    <div className="page-wrapper">
      <Navbar />
      
      <main style={{ paddingTop: '120px', paddingBottom: '5rem' }}>
        <div className="container">
          <div className="grid-2" style={{ alignItems: 'center', marginBottom: '4rem' }}>
            <div>
              <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '3.5rem', fontWeight: 900, marginBottom: '1.5rem', lineHeight: '1.1' }}>
                Join the <span style={{ color: 'var(--emerald-400)' }}>Revolution</span> of Turf Booking.
              </h1>
              <p style={{ fontSize: '1.2rem', color: 'var(--text-muted)', marginBottom: '2rem' }}>
                Book Arena was born out of a simple passion: making sports accessible to everyone. We've built the ultimate platform to connect athletes with the best venues in the city.
              </p>
              <div style={{ display: 'flex', gap: '2rem' }}>
                <div>
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--emerald-400)' }}>50+</div>
                  <div style={{ color: 'var(--text-muted)' }}>Partner Turfs</div>
                </div>
                <div>
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--emerald-400)' }}>10k+</div>
                  <div style={{ color: 'var(--text-muted)' }}>Total Bookings</div>
                </div>
                <div>
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--emerald-400)' }}>4.9/5</div>
                  <div style={{ color: 'var(--text-muted)' }}>User Rating</div>
                </div>
              </div>
            </div>
            <div className="card" style={{ padding: '1rem', background: 'var(--gradient-emerald)', borderRadius: '24px' }}>
              <img src="https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&q=80&w=1000" 
                   alt="Stadium" style={{ width: '100%', borderRadius: '18px', display: 'block' }} />
            </div>
          </div>

          <div className="grid-3" style={{ gap: '2rem' }}>
            <div className="card" style={{ padding: '2rem' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🎯</div>
              <h3 style={{ marginBottom: '1rem' }}>Our Mission</h3>
              <p style={{ color: 'var(--text-muted)' }}>To simplify the process of discovering and booking sports facilities, empowering local communities to stay active and healthy.</p>
            </div>
            <div className="card" style={{ padding: '2rem' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>⚡</div>
              <h3 style={{ marginBottom: '1rem' }}>Instant Bookings</h3>
              <p style={{ color: 'var(--text-muted)' }}>No more phone calls. Our real-time engine ensures you get the slot you want, confirmed instantly with secure payments.</p>
            </div>
            <div className="card" style={{ padding: '2rem' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🤝</div>
              <h3 style={{ marginBottom: '1rem' }}>Turf Partnerships</h3>
              <p style={{ color: 'var(--text-muted)' }}>We provide turf owners with professional management tools to grow their business and maximize their revenue.</p>
            </div>
          </div>

          <div className="card" style={{ marginTop: '4rem', padding: '3rem', textAlign: 'center', background: 'var(--gradient-dark)' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', marginBottom: '1.5rem' }}>Want to reach us?</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', maxWidth: '600px', margin: '0 auto 2rem' }}>
              For support, partnerships, or any other inquiries, feel free to contact us directly.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '3rem', flexWrap: 'wrap' }}>
              <div>
                <div style={{ color: 'var(--emerald-400)', fontWeight: 700 }}>Email</div>
                <div>mohamnedrayyan97@gmail.com</div>
              </div>
              <div>
                <div style={{ color: 'var(--emerald-400)', fontWeight: 700 }}>Phone</div>
                <div>+91 89034 95256</div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
