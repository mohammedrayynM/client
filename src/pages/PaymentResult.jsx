import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { apiGet, apiPost } from '@/lib/api';

const copy = {
  success: ['Payment Confirmed', 'Your booking is confirmed.'],
  cancelled: ['Payment Cancelled', 'Your payment was not completed. Your slot has not been booked.'],
  failed: ['Payment Failed', 'Your payment could not be completed. Please try again.'],
  pending: ['Payment Processing', 'Your payment is being verified. Please wait while we confirm the status.']
};

export default function PaymentResult() {
  const [params] = useSearchParams();
  const location = useLocation();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [releasing, setReleasing] = useState(false);
  const releasedRef = useRef(false);

  const status = location.pathname.split('/').pop().replace('payment-', '') || 'pending';
  const bookingId = params.get('booking_id') || params.get('bookingId') || params.get('id');
  const orderId = params.get('order_id') || params.get('orderId');
  const paymentId = params.get('payment_id') || params.get('paymentId');

  const refresh = useCallback(async () => {
    if (!bookingId) {
      setError('The booking reference is missing.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const proof = paymentId
        ? `payment_id=${encodeURIComponent(paymentId)}`
        : orderId ? `order_id=${encodeURIComponent(orderId)}` : '';
      const result = await apiGet(`/bookings/${encodeURIComponent(bookingId)}${proof ? `?${proof}` : ''}`);
      setBooking(result.booking || result);
    } catch (e) {
      setError(e.message || 'Could not load the latest booking status.');
    } finally {
      setLoading(false);
    }
  }, [bookingId, orderId, paymentId]);

  // On cancelled/failed page — reconcile with backend to release slot safely
  useEffect(() => {
    if (!bookingId || releasedRef.current) return;
    if (status === 'cancelled' || status === 'failed') {
      releasedRef.current = true;
      setReleasing(true);
      apiPost('/bookings/cancel-pending', { booking_id: bookingId })
        .catch(() => {/* non-critical */})
        .finally(() => { setReleasing(false); refresh(); });
    } else {
      refresh();
    }
  }, [bookingId, status, refresh]);

  const verified = booking?.payment_status === 'success' && booking?.status === 'confirmed';
  const rejected = ['failed', 'expired'].includes(String(booking?.payment_status || '').toLowerCase())
    || String(booking?.status || '').toLowerCase() === 'cancelled';
  const effectiveStatus = verified ? 'success' : rejected
    ? (status === 'cancelled' ? 'cancelled' : 'failed')
    : ['success', 'cancelled', 'failed'].includes(status) ? 'pending' : status;
  const [title, message] = copy[effectiveStatus] || copy.pending;

  return (
    <div className="page-wrapper">
      <Navbar />
      <main className="container" style={{ minHeight: '65vh', display: 'grid', placeItems: 'center', paddingTop: '7rem', paddingBottom: '3rem' }}>
        <section className="card" style={{ width: '100%', maxWidth: 520, padding: '2rem', textAlign: 'center' }}>
          <div style={{ color: 'var(--emerald-400)', fontWeight: 900, letterSpacing: '.12em', marginBottom: '1rem' }}>BOOK ARENA</div>
          <h1 style={{ marginBottom: '.75rem' }}>
            {loading || releasing ? 'Checking Payment…' : title}
          </h1>
          {loading || releasing ? <div className="loading-spinner" /> : <>
            <p>{message}</p>
            {error && <p role="alert" style={{ color: '#f87171' }}>{error}</p>}
            {booking && !verified && !rejected && <p role="status">The booking will remain unconfirmed until the backend verifies the payment.</p>}
            <div style={{ display: 'grid', gap: '.75rem', marginTop: '1.5rem' }}>
              <button type="button" className="btn btn-primary" onClick={refresh}>Refresh Payment Status</button>
              {(effectiveStatus === 'failed' || effectiveStatus === 'cancelled') && booking?.turf_id && (
                <Link className="btn btn-secondary" to={`/turfs/${booking.turf_id}`}>Try Again</Link>
              )}
              {(effectiveStatus === 'failed' || effectiveStatus === 'cancelled') && (
                <Link className="btn btn-secondary" to="/turfs">Select Another Slot</Link>
              )}
              <Link className="btn btn-secondary" to="/profile">View My Bookings</Link>
              <Link to="/turfs">Back to Available Slots</Link>
            </div>
          </>}
        </section>
      </main>
      <Footer />
    </div>
  );
}
