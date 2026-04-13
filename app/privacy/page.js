'use client';

import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export default function PrivacyPolicy() {
  return (
    <div className="page-wrapper">
      <Navbar />
      
      <main style={{ paddingTop: '120px', paddingBottom: '5rem' }}>
        <div className="container">
          <div className="card" style={{ padding: '3rem', maxWidth: '900px', margin: '0 auto' }}>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.5rem', fontWeight: 800, marginBottom: '1.5rem', background: 'var(--gradient-emerald)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Privacy Policy
            </h1>
            <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>Last Updated: April 13, 2026</p>

            <div className="legal-content" style={{ lineHeight: '1.8', color: 'var(--text-primary)' }}>
              <section style={{ marginBottom: '2rem' }}>
                <h3 style={{ marginBottom: '1rem', color: 'var(--emerald-400)' }}>1. Information We Collect</h3>
                <p>We collect information you provide directly to us when you create an account, book a turf, or communicate with us. This includes your name, email address, phone number, and payment information (processed securely via Razorpay).</p>
              </section>

              <section style={{ marginBottom: '2rem' }}>
                <h3 style={{ marginBottom: '1rem', color: 'var(--emerald-400)' }}>2. How We Use Your Information</h3>
                <p>We use the information we collect to:</p>
                <ul style={{ paddingLeft: '1.5rem', listStyleType: 'disc' }}>
                  <li>Process your bookings and payments.</li>
                  <li>Send you booking confirmations and updates.</li>
                  <li>Communicate with you about our services and offers.</li>
                  <li>Improve our platform and user experience.</li>
                </ul>
              </section>

              <section style={{ marginBottom: '2rem' }}>
                <h3 style={{ marginBottom: '1rem', color: 'var(--emerald-400)' }}>3. Information Sharing</h3>
                <p>We share your name and contact details with the Turf Owner you are booking with to facilitate your game. We do not sell your personal information to third parties.</p>
              </section>

              <section style={{ marginBottom: '2rem' }}>
                <h3 style={{ marginBottom: '1rem', color: 'var(--emerald-400)' }}>4. Security</h3>
                <p>We take reasonable measures to help protect information about you from loss, theft, misuse and unauthorized access. All financial transactions are processed through Razorpay's secure, encrypted systems.</p>
              </section>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
