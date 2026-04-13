'use client';

import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export default function TermsConditions() {
  return (
    <div className="page-wrapper">
      <Navbar />
      
      <main style={{ paddingTop: '120px', paddingBottom: '5rem' }}>
        <div className="container">
          <div className="card" style={{ padding: '3rem', maxWidth: '900px', margin: '0 auto' }}>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.5rem', fontWeight: 800, marginBottom: '1.5rem', background: 'var(--gradient-emerald)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Terms & Conditions
            </h1>
            <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>Last Updated: April 13, 2026</p>

            <div className="legal-content" style={{ lineHeight: '1.8', color: 'var(--text-primary)' }}>
              <p style={{ marginBottom: '1.5rem' }}>By using BookMyArena, you agree to comply with and be bound by the following terms and conditions.</p>

              <section style={{ marginBottom: '2rem' }}>
                <h3 style={{ marginBottom: '1rem', color: 'var(--emerald-400)' }}>1. Booking and Payments</h3>
                <p>All bookings must be paid for in full through our integrated payment gateway (Razorpay). A booking is considered confirmed only after successful payment verification.</p>
              </section>

              <section style={{ marginBottom: '2rem' }}>
                <h3 style={{ marginBottom: '1rem', color: 'var(--emerald-400)' }}>2. User Responsibilities</h3>
                <p>Users must provide accurate information when booking. Users are responsible for reaching the venue on time. Any damage to the turf or facilities caused by the user or their group will be the user's responsibility.</p>
              </section>

              <section style={{ marginBottom: '2rem' }}>
                <h3 style={{ marginBottom: '1rem', color: 'var(--emerald-400)' }}>3. Availability</h3>
                <p>We strive to ensure all slots shown are available, but in rare cases of technical errors or venue maintenance, we reserve the right to cancel a booking and provide a full refund.</p>
              </section>

              <section style={{ marginBottom: '2rem' }}>
                <h3 style={{ marginBottom: '1rem', color: 'var(--emerald-400)' }}>4. Platform Fees</h3>
                <p>BookMyArena charges a small platform service fee on every transaction to maintain the platform and provide support. This fee is non-refundable unless specified otherwise.</p>
              </section>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
