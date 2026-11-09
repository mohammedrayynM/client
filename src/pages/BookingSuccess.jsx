import { Suspense, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import { setPageMeta } from '@/lib/seo';
import { apiGet } from '@/lib/api';
import { formatSlotTime } from '@/lib/constants';
import InviteSharePanel from '@/components/InviteSharePanel';

function formatPrice(amount) {
  return Number(amount || 0).toLocaleString('en-IN', {
    maximumFractionDigits: 0,
    style: 'currency',
    currency: 'INR'
  });
}

function SuccessContent() {
  const [searchParams] = useSearchParams();
  const bookingId = searchParams.get('id');
  const [bookingData, setBookingData] = useState(null);
  const [matchData, setMatchData] = useState(null);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchBookingDetails = async () => {
    if (!bookingId || bookingId === 'demo') {
      setLoading(false);
      return;
    }
    try {
      const res = await apiGet(`/bookings/${bookingId}`);
      setBookingData(res.booking);
      setMatchData(res.match);
      setPlayers(res.players || []);
      setError('');
    } catch (err) {
      console.error('Failed to load booking details:', err);
      setError('Could not load booking details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookingDetails();
    // Poll for live updates every 8 seconds (useful for host player tracking)
    const interval = setInterval(fetchBookingDetails, 8000);
    return () => clearInterval(interval);
  }, [bookingId]);

  if (loading) {
    return (
      <div className="success-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div className="loading-spinner" />
      </div>
    );
  }

  if (error || (!bookingData && bookingId !== 'demo')) {
    return (
      <div className="success-container" style={{ maxWidth: '600px', margin: '0 auto', textAlign: 'center', padding: '3rem 1.5rem' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
        <h2 style={{ color: 'var(--text-primary)' }}>Booking Details Not Found</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>{error || 'Invalid booking.'}</p>
        <Link to="/turfs" className="btn btn-primary">Browse Turfs</Link>
      </div>
    );
  }

  // Demo fallback
  const booking = bookingData || {
    id: 'demo',
    turf_name: 'Kick Off Arena',
    booking_date: '2026-06-15',
    time_slot: '06:00 PM - 07:00 PM',
    payment_type: 'advance',
    original_price: 1200,
    markup_amount: 300,
    service_fee: 20,
    discount_amount: 150,
    amount: 1370,
    advance_amount: 685,
    pending_balance: 685,
    need_players: 0
  };

  const totalSlotPrice = parseFloat(booking.original_price || 0) + parseFloat(booking.markup_amount || 0);
  const totalCostBeforeDeductions = totalSlotPrice + parseFloat(booking.service_fee || 0) - parseFloat(booking.discount_amount || 0);
  
  // Real player contributions collected so far
  const contributionsCollected = players.reduce((sum, p) => sum + parseFloat(p.amount_paid || 0), 0);
  const payNowAmount = booking.payment_type === 'advance' ? parseFloat(booking.advance_amount || 0) : parseFloat(booking.amount || 0);
  const initialPendingBalance = parseFloat(booking.pending_balance || 0);
  const netPendingBalance = Math.max(0, initialPendingBalance - contributionsCollected);

  // Match details for host tracking
  const playersNeeded = parseInt(booking.players_needed || 0, 10);
  const playersJoinedCount = players.length;
  const spotsRemaining = Math.max(0, playersNeeded - playersJoinedCount);
  const expectedTotalContributions = playersNeeded * parseFloat(booking.contribution_amount || 0);
  const pendingContributions = Math.max(0, expectedTotalContributions - contributionsCollected);

  // the backend's canonical public URL (never this browser's own origin, which is localhost while developing)
  const shareUrl = matchData?.invite_url || (matchData?.share_token ? `https://bookarena.in/match-request/${matchData.share_token}` : '');

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      alert('Invite link copied to clipboard!');
    } catch {
      alert('Could not copy automatically. Link: ' + shareUrl);
    }
  };

  const handleWhatsAppShare = () => {
    const msg = `Join my match for ${booking.sport_type || 'Sports'} at ${booking.turf_name} on ${booking.booking_date} (${booking.time_slot})!\nContribution: ₹${booking.contribution_amount} per player.\nJoin link: ${shareUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="success-container" style={{ padding: '2rem 1rem', maxWidth: '800px', margin: '0 auto' }}>
      <div className="success-card" style={{
        background: 'var(--bg-card)',
        borderRadius: '24px',
        padding: '2.5rem',
        border: '1px solid var(--border-color, #1e293b)',
        boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
        textAlign: 'center'
      }}>
        <div className="success-icon" style={{
          fontSize: '3.5rem',
          background: 'rgba(16, 185, 129, 0.1)',
          width: '80px',
          height: '80px',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 1.5rem auto',
          color: 'var(--emerald-400)'
        }}>
          ✓
        </div>

        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: '2.25rem',
          fontWeight: 800,
          color: 'var(--text-primary)',
          marginBottom: '0.5rem'
        }}>
          Booking Confirmed!
        </h1>

        <p style={{
          color: 'var(--text-secondary)',
          fontSize: '1.05rem',
          marginBottom: '2rem'
        }}>
          Thank you for choosing Book Arena. Here is your payment receipt and booking details.
        </p>

        {/* VENUE & SLOT SUMMARY */}
        <div style={{
          textAlign: 'left',
          background: 'rgba(255,255,255,0.02)',
          borderRadius: '16px',
          padding: '1.5rem',
          marginBottom: '2rem',
          border: '1px solid var(--border-subtle)'
        }}>
          <h3 style={{ margin: '0 0 1rem 0', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>🏟️ Booking Details</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.95rem' }}>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Venue</span>
              <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>{booking.turf_name}</div>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Date</span>
              <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>{booking.booking_date}</div>
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <span style={{ color: 'var(--text-muted)' }}>Time Slot(s)</span>
              <div style={{ fontWeight: 700, color: 'var(--emerald-400)', marginTop: '2px' }}>{formatSlotTime(booking.time_slot)}</div>
            </div>
          </div>
        </div>

        {/* RECEIPT BREAKDOWN */}
        <div style={{
          textAlign: 'left',
          background: 'rgba(255,255,255,0.02)',
          borderRadius: '16px',
          padding: '1.5rem',
          marginBottom: '2rem',
          border: '1px solid var(--border-subtle)'
        }}>
          <h3 style={{ margin: '0 0 1rem 0', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>💳 Payment Receipt</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.95rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Total Slot Price</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{formatPrice(totalSlotPrice)}</span>
            </div>

            {parseFloat(booking.discount_amount || 0) > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--emerald-400)' }}>
                <span>Coupon Discount {booking.coupon_code ? `(${booking.coupon_code})` : ''}</span>
                <span>-{formatPrice(booking.discount_amount)}</span>
              </div>
            )}

            {parseFloat(booking.service_fee || 0) > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Service Fee</span>
                <span style={{ color: 'var(--text-primary)' }}>+{formatPrice(booking.service_fee)}</span>
              </div>
            )}

            <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '0.5rem 0' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '1.05rem' }}>
              <span style={{ color: 'var(--text-primary)' }}>Total Cost</span>
              <span style={{ color: 'var(--text-primary)' }}>{formatPrice(totalCostBeforeDeductions)}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              <span>Payment Mode Selected</span>
              <span style={{ fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                {booking.payment_type === 'advance' ? 'Advance Payment' : 'Full Payment'}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(16, 185, 129, 0.08)', padding: '0.75rem 1rem', borderRadius: '10px', marginTop: '0.5rem' }}>
              <span style={{ color: 'var(--emerald-300)', fontWeight: 700 }}>Amount Paid Now</span>
              <span style={{ color: 'var(--emerald-300)', fontWeight: 800 }}>{formatPrice(payNowAmount)}</span>
            </div>

            {booking.payment_type === 'advance' && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 1rem 0 1rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Base Balance due at venue</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{formatPrice(initialPendingBalance)}</span>
                </div>

                {contributionsCollected > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 1rem 0 1rem', color: 'var(--emerald-400)' }}>
                    <span>Contributions Offset (Joined Players)</span>
                    <span>-{formatPrice(contributionsCollected)}</span>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(251, 146, 60, 0.08)', padding: '0.75rem 1rem', borderRadius: '10px', marginTop: '0.25rem' }}>
                  <span style={{ color: 'var(--orange-300)', fontWeight: 700 }}>Net Balance due at venue</span>
                  <span style={{ color: 'var(--orange-300)', fontWeight: 800 }}>{formatPrice(netPendingBalance)}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* HOST MATCH & PLAYER TRACKING CARD */}
        {Number(booking.need_players) === 1 && matchData && (
          <div style={{
            textAlign: 'left',
            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.4) 0%, rgba(15, 23, 42, 0.6) 100%)',
            borderRadius: '20px',
            padding: '2rem',
            marginBottom: '2.5rem',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            boxShadow: 'inset 0 0 12px rgba(16,185,129,0.05)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, color: 'var(--emerald-400)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.2rem', fontWeight: 800 }}>
                <span>👥</span> Match & Player Tracking
              </h3>
              <span style={{
                background: spotsRemaining === 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(251, 146, 60, 0.15)',
                color: spotsRemaining === 0 ? 'var(--emerald-400)' : 'var(--orange-400)',
                padding: '4px 12px',
                borderRadius: '50px',
                fontSize: '0.75rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                {spotsRemaining === 0 ? 'Fully Filled' : `${spotsRemaining} Spot${spotsRemaining === 1 ? '' : 's'} Left`}
              </span>
            </div>

            {/* PLAYER SLOTS PROGRESS BAR */}
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                <span>Players Joined</span>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{playersJoinedCount} / {playersNeeded} Joined</span>
              </div>
              <div style={{ height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  background: 'linear-gradient(90deg, var(--emerald-500) 0%, var(--emerald-400) 100%)',
                  width: `${(playersJoinedCount / playersNeeded) * 100}%`,
                  transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
                }} />
              </div>
            </div>

            {/* LIST OF JOINED PLAYERS */}
            <div style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ margin: '0 0 0.75rem 0', color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 700 }}>Joined Players Contributions</h4>
              {players.length === 0 ? (
                <div style={{
                  padding: '1rem',
                  borderRadius: '12px',
                  background: 'rgba(255,255,255,0.01)',
                  border: '1px dashed rgba(255,255,255,0.1)',
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                  fontSize: '0.85rem'
                }}>
                  No players have joined yet. Share your invite link to get players!
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {players.map((player) => (
                    <div key={player.id} style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'rgba(255,255,255,0.02)',
                      padding: '0.75rem 1rem',
                      borderRadius: '12px',
                      border: '1px solid rgba(255,255,255,0.03)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, #059669, #10b981)',
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: '0.85rem'
                        }}>
                          {player.user_name?.[0]?.toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{player.user_name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>Role: {player.role || 'Any'}</div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--emerald-400)' }}>{formatPrice(player.amount_paid)}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--emerald-500)', fontWeight: 600 }}>Paid</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* CONTRIBUTION FINANCIAL STATUS */}
            <div style={{
              background: 'rgba(255,255,255,0.02)',
              borderRadius: '12px',
              padding: '1rem',
              border: '1px solid rgba(255,255,255,0.05)',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '1rem',
              fontSize: '0.85rem',
              marginBottom: '1.5rem'
            }}>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Contributions Collected</span>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--emerald-400)', marginTop: '2px' }}>
                  {formatPrice(contributionsCollected)}
                </div>
              </div>
              <div style={{ borderLeft: '1px solid rgba(255,255,255,0.08)', paddingLeft: '1rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Expected Pending</span>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: spotsRemaining === 0 ? 'var(--text-muted)' : 'var(--orange-400)', marginTop: '2px' }}>
                  {formatPrice(pendingContributions)}
                </div>
              </div>
            </div>

            {/* INVITE SHARING PANEL */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '1.25rem' }}>
              <div style={{ marginBottom: '1rem' }}>
                <InviteSharePanel
                  inviteUrl={shareUrl}
                  title="Share with Friends — scan or send"
                  shareText={`Join my ${booking.sport_type || 'sports'} match at ${booking.turf_name} on ${booking.booking_date} (${booking.time_slot}). Your share: ₹${booking.contribution_amount}.`}
                />
              </div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px' }}>Invite Link (Share with Friends)</div>
              <div style={{
                display: 'flex',
                gap: '8px',
                background: 'rgba(0,0,0,0.2)',
                padding: '6px 6px 6px 12px',
                borderRadius: '12px',
                border: '1px solid rgba(255,255,255,0.05)',
                alignItems: 'center'
              }}>
                <span style={{
                  color: 'var(--text-muted)',
                  fontSize: '0.8rem',
                  textOverflow: 'ellipsis',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  flex: 1
                }}>
                  {shareUrl}
                </span>
                <button
                  onClick={handleCopyLink}
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: '6px 14px', fontSize: '0.75rem', whiteSpace: 'nowrap' }}
                >
                  Copy Link
                </button>
                <button
                  onClick={handleWhatsAppShare}
                  type="button"
                  className="btn"
                  style={{
                    padding: '6px 14px',
                    fontSize: '0.75rem',
                    background: '#25D366',
                    borderColor: '#25D366',
                    color: '#fff',
                    whiteSpace: 'nowrap'
                  }}
                >
                  Share WhatsApp
                </button>
              </div>
            </div>
          </div>
        )}

        {/* BOTTOM NAVIGATION ACTIONS */}
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          <Link to="/turfs" className="btn btn-primary" style={{ padding: '0.75rem 2rem' }}>
            Book Another Turf
          </Link>
          <Link to="/profile" className="btn btn-secondary" style={{ padding: '0.75rem 2rem' }}>
            View My Bookings
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function BookingSuccessPage() {
  useEffect(() => {
    setPageMeta({
      title: 'Booking Confirmed — Book Arena',
      description: 'Your booking is confirmed. View next steps and continue browsing turfs on Book Arena.',
      keywords: 'booking confirmed, turf booking, book arena',
      robots: 'noindex, nofollow',
      canonicalUrl: 'https://bookarena.in/booking/success'
    });
  }, []);

  return (
    <div className="page-wrapper">
      <Navbar />
      <Suspense fallback={
        <div className="loading-page">
          <div className="loading-spinner" />
        </div>
      }>
        <SuccessContent />
      </Suspense>
    </div>
  );
}
