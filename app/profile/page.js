'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export default function UserProfile() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('userToken');
    if (!token) {
      router.push('/login');
      return;
    }

    const fetchProfile = async () => {
      try {
        const res = await fetch('http://localhost:5000/api/users/me', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        const data = await res.json();
        
        if (!res.ok) {
          throw new Error(data.error || 'Failed to load profile');
        }

        setUser(data.user);
        setBookings(data.bookings || []);
      } catch (err) {
        setError(err.message);
        if (err.message === 'Unauthorized') {
          localStorage.removeItem('userToken');
          localStorage.removeItem('userData');
          router.push('/login');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [router]);

  if (loading) {
    return (
      <div className="page-wrapper">
        <Navbar />
        <div className="flex-center" style={{ minHeight: '60vh' }}>
          <div className="loading-spinner" />
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="page-wrapper" style={{ background: 'var(--bg-secondary)' }}>
      <Navbar />
      
      <div className="container" style={{ padding: '120px 20px 60px' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '2rem' }}>
          My User Portal
        </h1>

        {error && (
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '10px', borderRadius: '6px', marginBottom: '1rem' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem', '@media(min-width: 768px)': { gridTemplateColumns: '300px 1fr' } }}>
          
          {/* Profile Card */}
          <div className="card" style={{ padding: '2rem', height: 'max-content' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '2rem' }}>
              <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--emerald-500)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem', color: '#fff', marginBottom: '1rem', fontWeight: 700 }}>
                {user?.name?.charAt(0).toUpperCase()}
              </div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', color: 'var(--text-primary)', fontWeight: 700 }}>
                {user?.name}
              </h2>
              <p style={{ color: 'var(--text-muted)' }}>{user?.email}</p>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <Link href="/turfs" className="btn btn-primary" style={{ textAlign: 'center', borderRadius: '50px' }}>
                Book a New Turf
              </Link>
              <button 
                onClick={() => {
                  localStorage.removeItem('userToken');
                  localStorage.removeItem('userData');
                  router.push('/login');
                }}
                className="btn btn-secondary" style={{ textAlign: 'center', borderRadius: '50px' }}
              >
                Sign Out
              </button>
            </div>
          </div>

          {/* Bookings Section */}
          <div className="card" style={{ padding: '2rem' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', color: 'var(--text-primary)', fontWeight: 700, marginBottom: '1.5rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1rem' }}>
              My Bookings
            </h2>
            
            {bookings.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.5 }}>🏟️</div>
                <h3 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>No bookings yet</h3>
                <p style={{ color: 'var(--text-muted)' }}>You haven&apos;t booked any turfs yet.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem', alignItems: 'start' }}>
                {bookings.map(booking => (
                  <div key={booking.id} style={{ 
                    border: '1px solid var(--border-subtle)', 
                    borderRadius: 'var(--radius-md)', 
                    padding: '1.5rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem',
                    background: 'var(--bg-default)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                      <div>
                        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                          {booking.turf_name}
                        </h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                          Booking ID: #{booking.id}
                        </p>
                      </div>
                      
                      {booking.payment_status === 'success' ? (
                        <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--emerald-400)', padding: '6px 12px', borderRadius: '50px', fontSize: '0.8rem', fontWeight: 600 }}>
                          ✅ Confirmed
                        </span>
                      ) : booking.payment_status === 'expired' || booking.status === 'cancelled' ? (
                        <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '6px 12px', borderRadius: '50px', fontSize: '0.8rem', fontWeight: 600 }}>
                          ❌ Cancelled
                        </span>
                      ) : (
                        <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', padding: '6px 12px', borderRadius: '50px', fontSize: '0.8rem', fontWeight: 600 }}>
                          ⏳ Pending Payment
                        </span>
                      )}
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '1rem', background: 'var(--bg-surface)', padding: '1rem', borderRadius: 'var(--radius-sm)' }}>
                      <div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '0.25rem' }}>Date</div>
                        <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{new Date(booking.booking_date).toLocaleDateString()}</div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '0.25rem' }}>Time</div>
                        <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{booking.time_slot}</div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '0.25rem' }}>Amount Paid</div>
                        <div style={{ color: 'var(--emerald-400)', fontWeight: 700 }}>₹{booking.amount}</div>
                      </div>
                    </div>
                    
                    {booking.payment_status === 'success' && (
                       <Link href={`/booking/success?id=${booking.id}`} style={{ color: 'var(--emerald-400)', fontSize: '0.9rem', fontWeight: 600, alignSelf: 'flex-end', textDecoration: 'none' }}>
                         View Receipt →
                       </Link>
                    )}
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
