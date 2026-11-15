
import { Link, useNavigate as useRouter } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import TurfCard from '@/components/TurfCard';
import AdBanner from '@/components/AdBanner';
import { apiGet } from '@/lib/api';
import { resolveMediaUrl } from '@/lib/mediaUrl';
import { SPORTS } from '@/lib/constants';
import { setJsonLd, setPageMeta } from '@/lib/seo';
import { fetchActivities } from '@/services/activities';

const heroImages = [
  '/images/hero/image.jpg',
  '/images/hero/image%202%20amusement.jpeg',
  '/images/hero/image%203%20pickle%20ball.jpeg'
];

export default function HomePage() {
  const router = useRouter();
  const [turfs, setTurfs] = useState([]);
  const [parks, setParks] = useState([]);
  const [parksLoading, setParksLoading] = useState(true);
  const [parksError, setParksError] = useState('');
  const [loading, setLoading] = useState(true);
  const [sportsList, setSportsList] = useState([]);
  const [showAllSports, setShowAllSports] = useState(false);
  const sportsSectionRef = useRef(null);

  const [currentSlide, setCurrentSlide] = useState(0);
  const [isLocating, setIsLocating] = useState(false);
  const searchInputRef = useRef(null);
  const autocompleteRef = useRef(null);

  const FAQS = [
    {
      q: 'How do I book a sports turf in Chennai on Book Arena?',
      a: 'Browse verified sports venues across Chennai and Tamil Nadu, select your preferred sport (cricket, football, badminton, pickleball), choose your date and slot, and confirm instantly with secure payment.'
    },
    {
      q: 'Can I book amusement park and water park tickets on Book Arena?',
      a: 'Yes, Book Arena offers online ticket booking for top amusement parks, water theme parks, and recreation centers with instant digital passes.'
    },
    {
      q: 'Can I find players to join my match if I am short of teammates?',
      a: 'Yes. After reserving your slot, use the "Need Players for This Slot" feature or post in the Find Players hub. Nearby players can join, select their roles, and contribute their share of the slot fee.'
    },
    {
      q: 'Are online payments secure and do I receive an instant booking receipt?',
      a: 'All transactions are protected by Razorpay with bank-grade encryption. Once payment is confirmed, an instant digital receipt and slot confirmation are delivered via email and saved to your profile dashboard.'
    }
  ];

  useEffect(() => {
    // Page-specific Advanced SEO & AEO meta
    setPageMeta({
      title: 'Book Arena — Book Sports Turfs in Chennai & Amusement Parks Online',
      description: 'Find and book top-rated sports turfs in Chennai, Bangalore & Tamil Nadu. Book box cricket, football grounds, badminton courts, pickleball & amusement park passes instantly with Book Arena.',
      keywords: 'turf in chennai, book amusement park, sports turf booking chennai, box cricket chennai, football turf chennai, badminton court booking, online turf booking, cricket ground rental, water park tickets, book arena',
      canonicalUrl: 'https://bookarena.in/',
      imageUrl: 'https://bookarena.in/images/hero/image.jpg'
    });

    // Organization + FAQ schema
    setJsonLd({
      id: 'org',
      data: {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'Book Arena',
        url: 'https://bookarena.in/',
        logo: 'https://bookarena.in/images/book-arena-logo.png',
        contactPoint: [{
          '@type': 'ContactPoint',
          telephone: '+91 89034 95256',
          contactType: 'customer support',
          areaServed: 'IN',
          availableLanguage: ['en']
        }]
      }
    });

    setJsonLd({
      id: 'faq-home',
      data: {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: FAQS.map(item => ({
          '@type': 'Question',
          name: item.q,
          acceptedAnswer: { '@type': 'Answer', text: item.a }
        }))
      }
    });

    loadTurfs();
    loadParks();
    loadSports();
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const interval = reduceMotion ? null : setInterval(() => {
      setCurrentSlide(prev => (prev + 1) % heroImages.length);
    }, 5000);

    // Initialize Google Maps Autocomplete
    if (typeof window !== 'undefined' && window.google) {
      try {
        if (searchInputRef.current && !import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.includes('placeholder')) {
          autocompleteRef.current = new window.google.maps.places.Autocomplete(searchInputRef.current, {
            types: ['(cities)'],
            componentRestrictions: { country: 'in' }
          });

          autocompleteRef.current.addListener('place_changed', () => {
            const place = autocompleteRef.current.getPlace();
            if (place.geometry) {
              const lat = place.geometry.location.lat();
              const lng = place.geometry.location.lng();
              router(`/turfs?lat=${lat}&lng=${lng}`);
            }
          });
        }
      } catch (err) {
        console.warn('Google Maps Autocomplete failed to initialize:', err);
      }
    }

    return () => {
      if (interval) clearInterval(interval);
    };
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

  async function loadParks() {
    setParksLoading(true);
    setParksError('');
    try {
      setParks(await fetchActivities({ category: 'AMUSEMENT_PARK' }));
    } catch (err) {
      console.error('Could not load amusement parks:', err);
      setParksError('Parks are temporarily unavailable. Please try again.');
    } finally {
      setParksLoading(false);
    }
  }

  async function loadSports() {
    try {
      const data = await apiGet('/discovery/sports');
      if (Array.isArray(data?.sports)) setSportsList(data.sports);
    } catch (err) {
      console.warn('Could not load sports categories:', err);
    }
  }

  return (
    <div className="page-wrapper">
      <Navbar />

      {/* ═══════ HERO SECTION ═══════ */}
      <section className="hero" id="hero">
        <div className="hero-carousel">
          {heroImages.map((img, i) => (
            <div key={img} className={`hero-slide ${i === currentSlide ? 'active' : ''}`} aria-hidden="true">
              <img
                src={img}
                alt=""
                width="1600"
                height="900"
                loading={i === 0 ? 'eager' : 'lazy'}
                fetchPriority={i === 0 ? 'high' : 'auto'}
                decoding="async"
                onError={(event) => { event.currentTarget.style.display = 'none'; }}
              />
            </div>
          ))}
          <div className="hero-slide-overlay" />
        </div>

        <div className="container">
          <div className="hero-content">
            <h1 className="hero-title">
              Book Your Perfect Sports Arena in Seconds
            </h1>

            <form
              className="search-container hero-search"
              onSubmit={(event) => {
                event.preventDefault();
                const query = searchInputRef.current?.value.trim();
                if (query) router(`/turfs?search=${encodeURIComponent(query)}`);
              }}
            >
              <input 
                type="text" 
                ref={searchInputRef}
                placeholder="Search by venue, sport, or city..."
                aria-label="Search venues by name, location, or sport"
              />
              <button type="submit" className="btn btn-secondary hero-submit">Search</button>
              <button 
                type="button"
                onClick={() => {
                  if (isLocating) return;
                  if (navigator.geolocation) {
                    setIsLocating(true);
                    navigator.geolocation.getCurrentPosition((pos) => {
                      const { latitude, longitude } = pos.coords;
                      router(`/turfs?lat=${latitude}&lng=${longitude}`);
                    }, (err) => {
                      setIsLocating(false);
                      alert("Please enable location access to find nearby turfs");
                      console.error(err);
                    });
                  } else {
                    alert("Geolocation is not supported by your browser");
                  }
                }}
                className="btn btn-primary" 
                disabled={isLocating}
                aria-label={isLocating ? 'Finding nearby turfs' : 'Find nearby turfs'}
              >
                {isLocating ? (
                  <>
                    <div className="spinner-mini" style={{
                      width: '18px',
                      height: '18px',
                      border: '2px solid rgba(255,255,255,0.3)',
                      borderTopColor: 'white',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }} />
                    Finding...
                  </>
                ) : (
                  <>Find Near Me</>
                )}
              </button>
            </form>

            <Link to="/activities?category=AMUSEMENT_PARK" className="hero-park-link">
              🎢 Discover amusement parks
            </Link>

            <div className="hero-actions">
              <Link to="/turfs" className="btn btn-primary btn-lg hero-cta">
                Explore All Turfs
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════ PROMOTIONAL BANNER ADS ═══════ */}
      <div className="container" style={{ marginTop: '2rem', marginBottom: '1rem' }}>
        <AdBanner placement="HOME_BANNER" />
      </div>

      {/* ═══════ SPORTS CATEGORIES ═══════ */}
      <section className="section" id="sports-section" ref={sportsSectionRef} style={{ position: 'relative', scrollMarginTop: '80px' }}>
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
            <select className="form-input" style={{ width: '100%', cursor: 'pointer', textAlign: 'center', fontWeight: 'bold' }} onChange={(e) => { if(e.target.value) router(`/turfs?sport=${e.target.value}`) }}>
              <option value="">🔎 Browse All Sports...</option>
              {sportsList.length > 0 ? (
                sportsList.map((s) => (
                  <option key={s.id} value={s.slug || s.name.toLowerCase()}>{s.name}</option>
                ))
              ) : (
                <>
                  <option value="tennis">🎾 Tennis</option>
                  <option value="basketball">🏀 Basketball</option>
                  <option value="volleyball">🏐 Volleyball</option>
                  <option value="swimming">🏊‍♂️ Swimming</option>
                  <option value="box cricket">🏏 Box Cricket</option>
                </>
              )}
            </select>
          </div>

          {(() => {
            // Categories come from the admin's list (/discovery/sports: enabled only, in the admin's order). The three
            // hard-coded entries are only a fallback for when that request fails, exactly as before.
            const seen = new Set();
            const categories = (sportsList.length > 0 ? sportsList : [
              { id: 'cricket', name: 'Cricket', slug: 'cricket', emoji: '🏏' },
              { id: 'football', name: 'Football', slug: 'football', emoji: '⚽' },
              { id: 'badminton', name: 'Badminton', slug: 'badminton', emoji: '🏸' }
            ]).filter((s) => {
              const key = String(s.id ?? s.slug ?? s.name);
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            });
            const INITIAL_COUNT = 3;
            const visible = showAllSports ? categories : categories.slice(0, INITIAL_COUNT);
            const hiddenCount = Math.max(0, categories.length - INITIAL_COUNT);

            const toggle = () => {
              if (showAllSports) {
                setShowAllSports(false);
                // keep the section in view after it shrinks
                const el = sportsSectionRef.current;
                if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
              } else {
                setShowAllSports(true);
              }
            };

            return (
              <>
                <div className="sport-cat-grid" id="sport-category-grid">
                  {visible.map((s, index) => {
                    const info = SPORTS[s.slug] || SPORTS[s.name?.toLowerCase()] || {};
                    const emoji = s.emoji || info.emoji || '🏟️';
                    const imageUrl = resolveMediaUrl(s.image_url);
                    return (
                      <Link
                        key={s.id ?? s.slug ?? s.name}
                        to={`/turfs?sport=${encodeURIComponent(s.slug || s.name.toLowerCase())}`}
                        className={`sport-cat-card${imageUrl ? ' has-image' : ''}${index >= INITIAL_COUNT ? ' sport-cat-extra' : ''}`}
                        style={index >= INITIAL_COUNT ? { animationDelay: `${(index - INITIAL_COUNT) * 70}ms` } : undefined}
                        aria-label={`Book ${s.name}`}
                      >
                        {imageUrl ? (
                          <img
                            className="sport-cat-img"
                            src={imageUrl}
                            alt=""
                            loading={index < INITIAL_COUNT ? 'eager' : 'lazy'}
                            decoding="async"
                            onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.parentElement?.classList.remove('has-image'); }}
                          />
                        ) : null}
                        <span className="sport-cat-emoji" aria-hidden="true">{emoji}</span>
                        <span className="sport-cat-overlay" aria-hidden="true" />
                        <span className="sport-cat-content">
                          <h3 className="sport-cat-name">{s.name}</h3>
                          <span className="sport-cat-cta">Book Now →</span>
                        </span>
                      </Link>
                    );
                  })}
                </div>
                {hiddenCount > 0 ? (
                  <div className="sport-cat-toggle-wrap">
                    <button
                      type="button"
                      className="btn btn-secondary sport-cat-toggle"
                      onClick={toggle}
                      aria-expanded={showAllSports}
                      aria-controls="sport-category-grid"
                    >
                      {showAllSports ? 'Show Less' : `View All Categories (${categories.length})`}
                      <span className={`sport-cat-chevron${showAllSports ? ' open' : ''}`} aria-hidden="true">▾</span>
                    </button>
                  </div>
                ) : null}
              </>
            );
          })()}
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
              <Link to="/turfs" className="btn btn-secondary btn-lg">
                View All Turfs →
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* ═══════ AMUSEMENT PARKS & TOURNAMENTS SPOTLIGHT ═══════ */}
      <section className="section" style={{ background: 'linear-gradient(180deg, var(--bg-primary), var(--bg-secondary))' }}>
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
            {/* Amusement Parks Card */}
            <div className="card" style={{ padding: '2rem', background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(15, 23, 42, 0.95))', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '1.5rem' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🎡</div>
              <div className="section-tag" style={{ marginBottom: '0.5rem' }}>Available experiences</div>
              <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff', marginBottom: '0.5rem' }}>Amusement & Water Parks</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: 1.6 }}>
                Find approved parks and book their real ticket offers with digital passes.
              </p>
              {parksLoading ? (
                <div role="status" style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>Loading available parks…</div>
              ) : parksError ? (
                <div role="alert" style={{ color: '#fca5a5', marginBottom: '1rem' }}>
                  {parksError} <button type="button" className="hero-park-retry" onClick={loadParks}>Retry</button>
                </div>
              ) : parks.length ? (
                <div className="home-park-list">
                  {parks.slice(0, 3).map((park) => (
                    <Link key={park.id} to={`/activities/${park.slug}`} className="home-park-item">
                      <span>{park.name}</span>
                      <small>{[park.city, park.location].filter(Boolean).join(' · ') || 'View park details'}</small>
                      <strong>{park.starting_price != null ? `From ₹${Number(park.starting_price).toLocaleString('en-IN')}` : 'View tickets'}</strong>
                    </Link>
                  ))}
                </div>
              ) : (
                <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>No approved amusement parks are listed right now.</p>
              )}
              <Link to="/activities" className="btn btn-primary" style={{ borderRadius: '50px', padding: '10px 24px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                Explore Parks & Rides →
              </Link>
            </div>

            {/* Tournaments Card */}
            <div className="card" style={{ padding: '2rem', background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12), rgba(15, 23, 42, 0.95))', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '1.5rem' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🏆</div>
              <div className="section-tag" style={{ marginBottom: '0.5rem', borderColor: 'rgba(245, 158, 11, 0.4)', color: '#fbbf24' }}>Championships</div>
              <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff', marginBottom: '0.5rem' }}>Live Tournaments</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: 1.6 }}>
                Compete in local cricket, football, and badminton leagues. Track live scores, fixtures, and register your team.
              </p>
              <Link to="/tournaments" className="btn btn-secondary" style={{ borderRadius: '50px', padding: '10px 24px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                View Tournaments →
              </Link>
            </div>
          </div>
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

      {/* ═══════ FAQ ═══════ */}
      <section className="section" id="faq" style={{ background: 'var(--bg-secondary)' }}>
        <div className="container">
          <div className="section-header">
            <div className="section-tag">❓ FAQs</div>
            <h2 className="section-title">Frequently Asked Questions</h2>
            <p className="section-subtitle">
              Quick answers about booking turfs and finding players
            </p>
          </div>

          <div className="grid-2" style={{ gap: '1.5rem' }}>
            {FAQS.map((item) => (
              <div key={item.q} className="card" style={{ padding: '1.5rem' }}>
                <h3 style={{ marginTop: 0, marginBottom: '0.75rem' }}>{item.q}</h3>
                <p style={{ color: 'var(--text-muted)', marginBottom: 0, lineHeight: 1.7 }}>{item.a}</p>
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
