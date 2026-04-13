'use client';

import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export default function RefundPolicy() {
  return (
    <div className="page-wrapper">
      <Navbar />
      
      <main style={{ paddingTop: '120px', paddingBottom: '5rem' }}>
        <div className="container">
          <div className="card" style={{ padding: '3rem', maxWidth: '900px', margin: '0 auto' }}>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.5rem', fontWeight: 800, marginBottom: '1.5rem', background: 'var(--gradient-emerald)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Refund & Cancellation Policy
            </h1>
            <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>Last Updated: April 13, 2026</p>

            <div className="legal-content" style={{ lineHeight: '1.8', color: 'var(--text-primary)' }}>
              <section style={{ marginBottom: '2rem' }}>
                <h3 style={{ marginBottom: '1rem', color: 'var(--emerald-400)' }}>1. Cancellation by User</h3>
                <p>Cancellations made more than 24 hours before the slot time are eligible for a 90% refund (10% platform fee applies). Cancellations made within 24 hours of the slot time are non-refundable.</p>
              </section>

              <section style={{ marginBottom: '2rem' }}>
                <h3 style={{ marginBottom: '1rem', color: 'var(--emerald-400)' }}>2. Cancellation by Venue</h3>
                <p>If the turf owner cancels the booking due to maintenance, weather, or other unforeseen reasons, a 100% refund will be processed back to your original payment method automatically.</p>
              </section>

              <section style={{ marginBottom: '2rem' }}>
                <h3 style={{ marginBottom: '1rem', color: 'var(--emerald-400)' }}>3. Refund Timeline</h3>
                <p>Once a refund is processed, it typically takes 5-7 business days to reflect in your bank account, depending on your bank's policies. All refunds are handled via Razorpay.</p>
              </section>

              <section style={{ marginBottom: '2rem' }}>
                <h3 style={{ marginBottom: '1rem', color: 'var(--emerald-400)' }}>4. No-Show Policy</h3>
                <p>If you fail to arrive for your booked slot without prior cancellation, the booking will be marked as a "No-Show" and no refund will be issued.</p>
              </section>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
