
import { useEffect } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { setPageMeta } from '@/lib/seo';

export default function RefundPolicy() {
  useEffect(() => {
    setPageMeta({
      title: 'Refund & Cancellation Policy — Book Arena',
      description: 'Read Book Arena’s refund and cancellation policy including timelines, no-show rules, and venue cancellations.',
      keywords: 'refund policy, cancellation policy, book arena refunds, turf booking refunds',
      canonicalUrl: 'https://bookarena.in/refund'
    });
  }, []);

  return (
    <div className="page-wrapper">
      <Navbar />
      
      <main style={{ paddingTop: '120px', paddingBottom: '5rem' }}>
        <div className="container">
          <div className="card" style={{ padding: '3rem', maxWidth: '900px', margin: '0 auto' }}>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.5rem', fontWeight: 800, marginBottom: '1.5rem', background: 'var(--gradient-emerald)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Refund & Cancellation Policy
            </h1>
            <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>Last Updated: October 18, 2026</p>

            <div className="legal-content" style={{ lineHeight: '1.8', color: 'var(--text-primary)' }}>
              <section style={{ marginBottom: '2rem' }}>
                <h2 style={{ marginBottom: '1rem', color: 'var(--emerald-400)' }}>1. Cancellation by User</h2>
                <p>You can cancel a booking online up to 8 hours before the slot starts (exactly 8 hours before is still allowed). Cancellations made at least 8 hours before the slot starts receive a refund of 90% of the amount paid for the slot; 10% is retained. Within 8 hours of the slot start, bookings cannot be cancelled online. The cutoff is calculated in the venue&apos;s local time.</p>
              </section>

              <section style={{ marginBottom: '2rem' }}>
                <h2 style={{ marginBottom: '1rem', color: 'var(--emerald-400)' }}>2. Cancellation by Venue</h2>
                <p>If the turf owner cancels the booking due to maintenance, weather, or other unforeseen reasons, a 100% refund will be processed back to your original payment method automatically. If you pay for a slot that was taken by someone else at the same moment, your payment is refunded in full.</p>
              </section>

              <section style={{ marginBottom: '2rem' }}>
                <h2 style={{ marginBottom: '1rem', color: 'var(--emerald-400)' }}>3. Refund Timeline</h2>
                <p>Once a refund is processed, it typically takes 5-7 business days to reflect in your bank account, depending on your bank's policies. All refunds are handled via Razorpay.</p>
              </section>

              <section style={{ marginBottom: '2rem' }}>
                <h2 style={{ marginBottom: '1rem', color: 'var(--emerald-400)' }}>4. No-Show Policy</h2>
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
