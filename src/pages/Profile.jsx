
import { useState, useEffect } from 'react';
import { useNavigate as useRouter } from 'react-router-dom';
import { Link } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { API_BASE } from '@/lib/api';
import { fetchMyTickets } from '@/services/activities';
import { setPageMeta } from '@/lib/seo';
import { formatSlotTime } from '@/lib/constants';

export default function UserProfile() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [matchReceipts, setMatchReceipts] = useState([]);
  const [activityTickets, setActivityTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    setPageMeta({
      title: 'My Account — Book Arena',
      description: 'View your bookings and receipts on Book Arena.',
      keywords: 'book arena profile, my bookings, booking receipts, match receipts',
      robots: 'noindex, nofollow',
      canonicalUrl: 'https://bookarena.in/profile'
    });
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('userToken');
    if (!token) {
      router('/login');
      return;
    }

    const fetchProfile = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`${API_BASE}/users/me`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        const contentType = res.headers.get('content-type') || '';
        const data = contentType.includes('application/json') ? await res.json() : {};

        if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
            localStorage.removeItem('userToken');
            localStorage.removeItem('userData');
            router('/login');
            return;
          }
          throw new Error(data.error || `Server error (${res.status})`);
        }

        setUser(data.user);
        setBookings(data.bookings || []);
        setMatchReceipts(data.matchReceipts || data.match_receipts || []);

        try {
          const actRes = await fetchMyTickets();
          setActivityTickets(actRes || []);
        } catch {
          setActivityTickets([]);
        }
      } catch (err) {
        console.error('Profile fetch error:', err);
        if (err.message === 'Failed to fetch' || err.name === 'TypeError') {
          setError('Unable to connect to server. Please check your internet connection and try again.');
        } else {
          setError(err.message || 'Failed to load profile');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [router, retryCount]);

  if (loading) {
    return (
      <div className="page-wrapper">
        <Navbar />
        <div className="flex-center" style={{ minHeight: '60vh', flexDirection: 'column', gap: '1rem' }}>
          <div className="loading-spinner" />
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Loading your bookings...</p>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="page-wrapper" style={{ background: 'var(--bg-secondary)' }}>
      <Navbar />
      
      <div className="container profile-container">
        <h1 className="profile-title">
          My User Portal
        </h1>

        {error && (
          <div className="profile-error">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '1.3rem' }}>⚠️</span>
              <span style={{ flex: 1 }}>{error}</span>
              <button 
                onClick={() => setRetryCount(prev => prev + 1)} 
                className="btn btn-primary btn-sm"
                style={{ borderRadius: '50px', padding: '6px 18px', fontSize: '0.85rem' }}
              >
                🔄 Retry
              </button>
            </div>
          </div>
        )}

        <div className="profile-grid">
          
          {/* Profile Card */}
          <div className="card profile-card">
            <div className="profile-avatar-section">
              <div className="profile-avatar">
                {user?.name?.charAt(0).toUpperCase()}
              </div>
              <h2 className="profile-name">{user?.name}</h2>
              <p className="profile-email">{user?.email}</p>
            </div>
            
            <div className="profile-actions">
              <Link to="/turfs" className="btn btn-primary" style={{ textAlign: 'center', borderRadius: '50px' }}>
                🏟️ Book a New Turf
              </Link>
              <Link to="/activities" className="btn btn-secondary" style={{ textAlign: 'center', borderRadius: '50px' }}>
                🎡 Amusement Parks
              </Link>
              <Link to="/tournaments" className="btn btn-secondary" style={{ textAlign: 'center', borderRadius: '50px' }}>
                🏆 Tournaments
              </Link>
              <button 
                onClick={() => {
                  localStorage.removeItem('userToken');
                  localStorage.removeItem('userData');
                  router('/login');
                }}
                className="btn btn-secondary" style={{ textAlign: 'center', borderRadius: '50px' }}
              >
                🚪 Sign Out
              </button>
            </div>
          </div>

          {/* Bookings Section */}
          <div className="card bookings-card">
            <h2 className="bookings-title">
              📋 My Bookings
            </h2>
            
            {bookings.length === 0 ? (
              <div className="bookings-empty">
                <div style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.5 }}>🏟️</div>
                <h3 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>No bookings yet</h3>
                <p style={{ color: 'var(--text-muted)' }}>You haven&apos;t booked any turfs yet.</p>
                <Link to="/turfs" className="btn btn-primary btn-sm" style={{ marginTop: '1rem', borderRadius: '50px' }}>
                  Browse Turfs
                </Link>
              </div>
            ) : (
              <div className="bookings-grid">
                {bookings.map(booking => (
                  <div key={booking.id} className="booking-item">
                    <div className="booking-item-header">
                      <div>
                        <h3 className="booking-turf-name">
                          {booking.turf_name}
                        </h3>
                        {booking.court_name && (
                          <p className="booking-court-name">{booking.court_name}</p>
                        )}
                        <p className="booking-id">
                          Booking ID: #{booking.id}
                        </p>
                      </div>
                      
                      {booking.payment_status === 'success' ? (
                        <span className="booking-badge badge-confirmed">
                          ✅ Confirmed
                        </span>
                      ) : booking.payment_status === 'expired' || booking.status === 'cancelled' ? (
                        <span className="booking-badge badge-cancelled">
                          ❌ Cancelled
                        </span>
                      ) : (
                        <span className="booking-badge badge-pending">
                          ⏳ Pending
                        </span>
                      )}
                    </div>
                    
                    <div className="booking-details-grid">
                      <div>
                        <div className="booking-detail-label">Date</div>
                        <div className="booking-detail-value">{new Date(booking.booking_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                      </div>
                      <div>
                        <div className="booking-detail-label">Time</div>
                        <div className="booking-detail-value">{formatSlotTime(booking.time_slot)}</div>
                      </div>
                      <div>
                        <div className="booking-detail-label">Amount Paid</div>
                        <div className="booking-detail-value" style={{ color: 'var(--emerald-400)', fontWeight: 700 }}>
                          ₹{booking.payment_type === 'advance' ? (booking.advance_amount || booking.amount) : booking.amount}
                          {booking.payment_type === 'advance' && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--emerald-400)', marginLeft: '4px', fontWeight: 500 }}>(Advance Paid)</span>
                          )}
                        </div>
                      </div>
                      {booking.payment_type === 'advance' && booking.pending_balance > 0 && (
                        <div>
                          <div className="booking-detail-label">Balance Due at Venue</div>
                          <div className="booking-detail-value" style={{ color: '#f59e0b', fontWeight: 700 }}>
                            ₹{booking.pending_balance}
                            <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 500, marginTop: '2px' }}>(Pay at Venue)</span>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {booking.payment_status === 'success' && (
                       <Link to={`/booking/success?id=${booking.id}`} className="booking-receipt-link">
                         View Receipt →
                       </Link>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Match Join Receipts */}
          <div className="card bookings-card">
            <h2 className="bookings-title">
              🧾 My Match Receipts
            </h2>

            {matchReceipts.length === 0 ? (
              <div className="bookings-empty">
                <div style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.5 }}>🏟️</div>
                <h3 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>No match receipts yet</h3>
                <p style={{ color: 'var(--text-muted)' }}>
                  When you join and pay for a match from Find Players, your receipt will show up here.
                </p>
                <Link to="/find-players" className="btn btn-primary btn-sm" style={{ marginTop: '1rem', borderRadius: '50px' }}>
                  Find Matches
                </Link>
              </div>
            ) : (
              <div className="bookings-grid">
                {matchReceipts.map(r => {
                  const when = (r.booking_time_slot || '').trim() || String(r.match_time || '').slice(0, 5);
                  return (
                    <div key={r.match_player_id || r.match_id} className="booking-item">
                      <div className="booking-item-header">
                        <div>
                          <h3 className="booking-turf-name">
                            {String(r.sport_type || '').toUpperCase()} • {r.turf_name}
                          </h3>
                          {r.court_name && (
                            <p className="booking-court-name">{r.court_name}</p>
                          )}
                          {r.turf_address && (
                            <p className="booking-court-name" style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '2px', lineHeight: 1.4 }}>📍 {r.turf_address}</p>
                          )}
                          <p className="booking-id">
                            Match ID: #{r.match_id} • Receipt: #{r.match_player_id}
                          </p>
                        </div>
                        <span className="booking-badge badge-confirmed">
                          ✅ Paid
                        </span>
                      </div>

                      <div className="booking-details-grid">
                        <div>
                          <div className="booking-detail-label">Date</div>
                          <div className="booking-detail-value">
                            {new Date(r.match_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </div>
                        </div>
                        <div>
                          <div className="booking-detail-label">Time</div>
                          <div className="booking-detail-value">{formatSlotTime(when)}</div>
                        </div>
                        <div>
                          <div className="booking-detail-label">Amount Paid</div>
                          <div className="booking-detail-value" style={{ color: 'var(--emerald-400)', fontWeight: 700 }}>
                            ₹{Number(r.amount_paid || 0)}
                          </div>
                        </div>
                        <div>
                          <div className="booking-detail-label">Host</div>
                          <div className="booking-detail-value">
                            {r.host_name}{r.host_contact_phone ? ` • ${r.host_contact_phone}` : ''}
                          </div>
                        </div>
                      </div>

                      {r.share_token ? (
                        <Link to={`/match-request/${r.share_token}`} className="booking-receipt-link">
                          View Match Details →
                        </Link>
                      ) : (
                        <Link to="/find-players" className="booking-receipt-link">
                          View Matches →
                        </Link>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Activity Passes Section */}
          <div className="card bookings-card" style={{ marginTop: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h2 className="bookings-title" style={{ margin: 0 }}>
                🎡 Amusement Park & Activity Passes
              </h2>
              <Link to="/activities" className="btn btn-secondary btn-sm" style={{ borderRadius: '50px', fontSize: '0.8rem', padding: '4px 14px' }}>
                Browse Parks →
              </Link>
            </div>

            {activityTickets.length === 0 ? (
              <div className="bookings-empty">
                <div style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.5 }}>🎢</div>
                <h3 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>No activity passes yet</h3>
                <p style={{ color: 'var(--text-muted)' }}>You haven't booked any amusement or water park tickets yet.</p>
                <Link to="/activities" className="btn btn-primary btn-sm" style={{ marginTop: '1rem', borderRadius: '50px' }}>
                  Explore Experiences
                </Link>
              </div>
            ) : (
              <div className="bookings-grid">
                {activityTickets.map((pass) => (
                  <div key={pass.id} className="booking-item">
                    <div className="booking-item-header">
                      <div>
                        <h3 className="booking-turf-name">{pass.activity_name}</h3>
                        <p className="booking-id">Pass Ref: #{pass.booking_code || pass.id}</p>
                      </div>
                      <span className={`booking-badge ${pass.status === 'confirmed' ? 'badge-confirmed' : 'badge-pending'}`}>
                        {pass.status === 'confirmed' ? '✅ Confirmed' : pass.status}
                      </span>
                    </div>

                    <div className="booking-details-grid">
                      <div>
                        <div className="booking-detail-label">Visit Date</div>
                        <div className="booking-detail-value">
                          {new Date(pass.booking_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </div>
                      </div>
                      <div>
                        <div className="booking-detail-label">Entry Slot</div>
                        <div className="booking-detail-value">{pass.time_window_label || 'All-Day Pass'}</div>
                      </div>
                      <div>
                        <div className="booking-detail-label">Total Amount</div>
                        <div className="booking-detail-value" style={{ color: 'var(--emerald-400)', fontWeight: 700 }}>
                          ₹{pass.final_amount || pass.total_amount}
                        </div>
                      </div>
                    </div>

                    <Link to={`/my-tickets/${pass.id}`} className="booking-receipt-link">
                      View QR Pass Ticket →
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
          
        </div>
      </div>

      <Footer />
    </div>
  );
}
