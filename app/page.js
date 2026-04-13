'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import TurfCard from '@/components/TurfCard';
import { apiGet } from '@/lib/api';
import { SPORTS } from '@/lib/constants';

export default function HomePage() {
  const [turfs, setTurfs] = useState([]);
  const [loading, setLoading] = useState(true);

  const [currentSlide, setCurrentSlide] = useState(0);

  const heroImages = [
    '/images/hero/football.png', 
    '/images/hero/cricket.png',
    '/images/hero/badminton.png'
  ];

  useEffect(() => {
    loadTurfs();
    const interval = setInterval(() => {
      setCurrentSlide(prev => (prev + 1) % heroImages.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  async function loadTurfs() {
    try {
      const data = await apiGet('/turfs');
      setTurfs(data.turfs || []);
    } catch (err) {
      console.error(err);
      setTurfs([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-wrapper">
      <Navbar />

      {/* ═══════ HERO SECTION ═══════ */}
      <section className="hero" id="hero">
        <div className="hero-carousel">
          {heroImages.map((img, i) => (
            <div key={i} className={`hero-slide ${i === currentSlide ? 'active' : ''}`} style={{ backgroundImage: `url(${img})` }} />
          ))}
          <div className="hero-slide-overlay" />
        </div>

        <div className="container">
          <div className="hero-content">
            {/* Smart Search Bar */}
            <div className="search-container" style={{ 
              background: 'rgba(255, 255, 255, 0.05)', 
              backdropFilter: 'blur(20px)',
              padding: '8px 8px 8px 24px',
              borderRadius: '50px',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              display: 'flex',
              alignItems: 'center',
              width: '100%',
              maxWidth: '600px',
              margin: '0 auto 2.5rem',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)'
            }}>
              <input 
                type="text" 
                placeholder="Search near your location..." 
                style={{ 
                  background: 'transparent', 
                  border: 'none', 
                  color: 'white', 
                  flex: 1, 
                  padding: '12px 0',
                  outline: 'none',
                  fontSize: '0.95rem'
                }}
              />
              <button 
                onClick={() => {
                  if (navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition((pos) => {
                      alert(`Finding turfs near: ${pos.coords.latitude}, ${pos.coords.longitude}`);
                      window.location.href = "/turfs";
                    }, () => alert("Please enable location access"));
                  }
                }}
                className="btn btn-primary" 
                style={{ 
                  borderRadius: '50px', 
                  padding: '10px 24px', 
                  fontSize: '0.85rem',
                  whiteSpace: 'nowrap'
                }}
              >
                Find Near Me
              </button>
            </div>

            <h1 className="hero-title" style={{ fontSize: 'clamp(2.5rem, 8vw, 4.5rem)', lineHeight: 1.1 }}>
              Book Your Perfect Sports Arena in Seconds
            </h1>

            <div className="hero-actions" style={{ marginTop: '2.5rem' }}>
              <Link href="/turfs" className="btn btn-primary btn-lg" style={{ borderRadius: '50px', padding: '16px 40px' }}>
                🏟️ Explore All Turfs
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════ SPORTS CATEGORIES ═══════ */}
      <section className="section" id="sports-section" style={{ position: 'relative' }}>
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '1px',
          background: 'linear-gradient(90deg, transparent, var(--emerald-800), transparent)'
        }} />
        <div className="container">
          <div className="section-header">
            <div className="section-tag">🎯 Choose Your Sport</div>
            <h2 className="section-title">Play What You Love</h2>
            <p className="section-subtitle">
              From cricket pitches to badminton courts — we have it all
            </p>
          </div>

          <div style={{ maxWidth: '400px', margin: '0 auto 2rem auto' }}>
            <select className="form-input" style={{ width: '100%', cursor: 'pointer', textAlign: 'center', fontWeight: 'bold' }} onChange={(e) => { if(e.target.value) window.location.href=`/turfs?sport=${e.target.value}` }}>
              <option value="">🔎 Browse Other Sports...</option>
              <option value="tennis">🎾 Tennis</option>
              <option value="basketball">🏀 Basketball</option>
              <option value="volleyball">🏐 Volleyball</option>
              <option value="swimming">🏊‍♂️ Swimming</option>
              <option value="box cricket">🏏 Box Cricket</option>
            </select>
          </div>

          <div className="grid-3">
            <Link href="/turfs?sport=cricket" className="card" style={{ cursor: 'pointer', textAlign: 'center', padding: '2rem 1.5rem', background: 'var(--bg-card)' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem', filter: 'drop-shadow(0 0 10px rgba(16, 185, 129, 0.3))' }}>🏏</div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Cricket</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Book Now →</p>
            </Link>
            <Link href="/turfs?sport=football" className="card" style={{ cursor: 'pointer', textAlign: 'center', padding: '2rem 1.5rem', background: 'var(--bg-card)' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem', filter: 'drop-shadow(0 0 10px rgba(16, 185, 129, 0.3))' }}>⚽</div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Football</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Book Now →</p>
            </Link>
            <Link href="/turfs?sport=badminton" className="card" style={{ cursor: 'pointer', textAlign: 'center', padding: '2rem 1.5rem', background: 'var(--bg-card)' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem', filter: 'drop-shadow(0 0 10px rgba(16, 185, 129, 0.3))' }}>🏸</div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Badminton</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Book Now →</p>
            </Link>
          </div>
        </div>
      </section>

      {/* ═══════ FEATURED TURFS ═══════ */}
      <section className="section" id="featured-turfs" style={{ background: 'var(--bg-secondary)' }}>
        <div className="container">
          <div className="section-header">
            <div className="section-tag">🔥 Popular Picks</div>
            <h2 className="section-title">Featured Turfs</h2>
            <p className="section-subtitle">
              Top-rated arenas handpicked for you
            </p>
          </div>

          {loading ? (
            <div className="flex-center" style={{ padding: '4rem' }}>
              <div className="loading-spinner"></div>
            </div>
          ) : turfs.length > 0 ? (
            <div className="grid-3">
              {turfs.slice(0, 6).map(turf => (
                <TurfCard key={turf.id} turf={turf} />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-icon">🏟️</div>
              <h3>Turfs Coming Soon</h3>
              <p>We&apos;re adding turfs in your area. Stay tuned!</p>
            </div>
          )}

          {turfs.length > 6 && (
            <div style={{ textAlign: 'center', marginTop: '2rem' }}>
              <Link href="/turfs" className="btn btn-secondary btn-lg">
                View All Turfs →
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* ═══════ HOW IT WORKS ═══════ */}
      <section className="section" id="how-it-works">
        <div className="container">
          <div className="section-header">
            <div className="section-tag">📋 Simple Process</div>
            <h2 className="section-title">How It Works</h2>
            <p className="section-subtitle">
              Book your turf in just 3 simple steps
            </p>
          </div>

          <div className="grid-3">
            {[
              {
                step: '01',
                icon: '🔍',
                title: 'Find Your Turf',
                desc: 'Browse turfs by sport, location, or availability. Filter and find the perfect arena.'
              },
              {
                step: '02',
                icon: '📅',
                title: 'Select Your Slot',
                desc: 'Pick your preferred date and time slot. See real-time availability instantly.'
              },
              {
                step: '03',
                icon: '✅',
                title: 'Book & Play',
                desc: 'Fill in your details, pay securely, and get instant confirmation. Game on!'
              }
            ].map((item) => (
              <div key={item.step} className="card" style={{ padding: '2rem', textAlign: 'center' }}>
                <div style={{
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  color: 'var(--emerald-400)',
                  letterSpacing: '2px',
                  marginBottom: '1rem'
                }}>
                  STEP {item.step}
                </div>
                <div style={{
                  width: '72px',
                  height: '72px',
                  background: 'rgba(16, 185, 129, 0.1)',
                  borderRadius: 'var(--radius-lg)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '2rem',
                  margin: '0 auto 1.5rem',
                }}>
                  {item.icon}
                </div>
                <h3 style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  marginBottom: '0.75rem',
                  color: 'var(--text-primary)'
                }}>
                  {item.title}
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6 }}>
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>



      <Footer />
    </div>
  );
}

// Demo data when API is not connected
function getDemoTurfs() {
  return [
    {
      id: 1, name: 'Green Field Arena', location: 'Anna Nagar, Chennai',
      sport_type: 'cricket', price_per_hour: 1200,
      images: ['https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=800&q=80'],
      amenities: ['Floodlights', 'Parking', 'Changing Room', 'Drinking Water']
    },
    {
      id: 2, name: 'Thunder Football Ground', location: 'Velachery, Chennai',
      sport_type: 'football', price_per_hour: 1500,
      images: ['https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&q=80'],
      amenities: ['Floodlights', 'Washroom', 'Cafeteria']
    },
    {
      id: 3, name: 'Smash Zone Courts', location: 'T Nagar, Chennai',
      sport_type: 'badminton', price_per_hour: 800,
      images: ['https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=800&q=80'],
      amenities: ['Air Conditioning', 'Parking', 'Shower']
    },
    {
      id: 4, name: 'Elite Cricket Hub', location: 'Porur, Chennai',
      sport_type: 'box cricket', price_per_hour: 1000,
      images: ['https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=800&q=80'],
      amenities: ['Floodlights', 'Seating Area', 'CCTV', 'First Aid']
    },
    {
      id: 5, name: 'Ace Tennis Academy', location: 'Adyar, Chennai',
      sport_type: 'tennis', price_per_hour: 900,
      images: ['https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=800&q=80'],
      amenities: ['Coaching', 'Equipment', 'Parking']
    },
    {
      id: 6, name: 'Slam Dunk Arena', location: 'Nungambakkam, Chennai',
      sport_type: 'basketball', price_per_hour: 1100,
      images: ['https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800&q=80'],
      amenities: ['Floodlights', 'Drinking Water', 'Locker']
    },
  ];
}
