import { useState, useEffect, Suspense, useCallback, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import TurfCard from '@/components/TurfCard';
import LocationBar from '@/components/LocationBar';
import { apiGet } from '@/lib/api';
import { SPORTS, formatPrice } from '@/lib/constants';
import { setPageMeta } from '@/lib/seo';

export const dynamic = 'force-dynamic';

function TurfsPageContent() {
  const [searchParams] = useSearchParams();
  const [turfs, setTurfs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSport, setActiveSport] = useState(searchParams.get('sport') || 'all');
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('search') || searchParams.get('q') || '');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [usingFallback, setUsingFallback] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [searchError, setSearchError] = useState('');
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [exactMatch, setExactMatch] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);

  const isFirstRender = useRef(true);
  const latestLoadId = useRef(0);

  // Debounce search query to reduce API requests and search globally
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 400);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  useEffect(() => {
    const sport = searchParams.get('sport');
    const sportLabel = sport ? `${sport.charAt(0).toUpperCase()}${sport.slice(1)}` : 'All Sports';
    setPageMeta({
      title: `Turfs — ${sportLabel} | Book Arena`,
      description: 'Browse and book sports turfs near you. Filter by sport and location to find the perfect venue.',
      keywords: 'turfs, turf booking, book sports turf, cricket turf, football turf, badminton court, book arena',
      canonicalUrl: 'https://bookarena.in/turfs'
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Initial load based on URL params
  useEffect(() => {
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');
    
    if (lat && lng && !userLocation) {
      setUserLocation({ latitude: lat, longitude: lng });
    }
  }, [searchParams]);

  // Load venues when filters, location, or debounced search query changes.
  useEffect(() => {
    loadTurfs(1, false);
  }, [activeSport, userLocation, debouncedSearchQuery]);

  // Smooth scroll to top on filter change
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeSport, userLocation, debouncedSearchQuery]);

  async function loadTurfs(requestedPage = 1, append = false) {
    const loadId = latestLoadId.current + 1;
    latestLoadId.current = loadId;
    setLoading(true);
    setSearchError('');
    if (!append) {
      setUsingFallback(false);
      setExactMatch(null);
      setSearchSuggestions([]);
    }
    try {
      const trimmedSearch = debouncedSearchQuery.trim();
      const queryParams = new URLSearchParams();
      const lat = userLocation?.latitude || searchParams.get('lat');
      const lng = userLocation?.longitude || searchParams.get('lng');
      const hasCoordinates = lat != null && lng != null && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng));
      const wantsNearby = !trimmedSearch || /\b(?:near me|nearby)\b/i.test(trimmedSearch);

      queryParams.set('page', String(requestedPage));
      queryParams.set('limit', '12');
      if (activeSport !== 'all') {
        queryParams.set('sport', activeSport);
        queryParams.set('type', 'venue');
        queryParams.set('includeActivities', 'false');
      } else {
        queryParams.set('includeActivities', 'true');
      }
      if (trimmedSearch) queryParams.set('q', trimmedSearch);
      if (hasCoordinates && wantsNearby) {
        queryParams.set('lat', String(lat));
        queryParams.set('lng', String(lng));
        queryParams.set('radius', '50');
      }

      const endpoint = wantsNearby && hasCoordinates ? '/discovery/nearby' : '/discovery/search';
      const data = await apiGet(`${endpoint}?${queryParams.toString()}`);
      if (loadId !== latestLoadId.current) return;

      const results = data.results || [];
      setTurfs((current) => append ? [...current, ...results] : results);
      setSearchSuggestions(data.suggestions || []);
      if (!append) setExactMatch(data.exactMatch || null);
      setPage(requestedPage);
      setHasMore(Boolean(data.hasMore));
      setUsingFallback(false);
    } catch (err) {
      if (loadId !== latestLoadId.current) return;
      console.error(err);
      setSearchError('Could not load venues. Check your connection and try again.');
      if (!append) setTurfs([]);
    } finally {
      if (loadId === latestLoadId.current) {
        setLoading(false);
      }
    }
  }

  const handleLocationDetected = useCallback((location) => {
    setUserLocation(location);
  }, []);

  const visibleTurfs = turfs;

  return (
    <div className="page-wrapper">
      <Navbar />

      <section style={{ paddingTop: '120px', minHeight: '100vh' }}>
        <div className="container">
          {/* Header */}
          <div className="section-header">
            <div className="section-tag">🏟️ Browse</div>
            <h1 className="section-title">Find Your Perfect Venue</h1>
            <p className="section-subtitle">
              Search sports venues, amusement parks, water parks, and activities
            </p>
          </div>

          <LocationBar onLocationDetected={handleLocationDetected} />

          {/* Search Bar */}
          <div className="search-bar-container" style={{ marginTop: '2rem', marginBottom: '2rem' }}>
            <div className="premium-search-bar">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                placeholder="Search by name, location, or sport..."
                value={searchQuery}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => window.setTimeout(() => setSearchFocused(false), 150)}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') setSearchFocused(false);
                }}
                aria-label="Search venues by name, location, or sport"
                aria-autocomplete="list"
                aria-controls="venue-search-suggestions"
              />
              {searchFocused && searchQuery.trim() && !loading && (
                <div
                  id="venue-search-suggestions"
                  role="listbox"
                  style={{
                    position: 'absolute',
                    zIndex: 30,
                    top: 'calc(100% + 8px)',
                    left: 0,
                    right: 0,
                    padding: '8px',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '12px',
                    background: 'var(--bg-card)',
                    boxShadow: '0 12px 32px #0008'
                  }}
                >
                  {turfs.slice(0, 5).map((turf) => (
                    <Link
                      key={`${turf.type}-${turf.id}`}
                      role="option"
                      aria-selected="false"
                      to={turf.type === 'activity' ? `/activities/${turf.slug || turf.id}` : `/turfs/${turf.id}`}
                      onMouseDown={(event) => event.preventDefault()}
                      style={{ display: 'block', padding: '10px 12px', borderRadius: '8px' }}
                    >
                      <strong>{turf.name}</strong>
                      <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        {[turf.location, turf.city, turf.category_label || turf.sport_type].filter(Boolean).join(' · ')}
                      </span>
                    </Link>
                  ))}
                  {!turfs.length && searchSuggestions.map((suggestion) => (
                    <button
                      key={`${suggestion.kind}-${suggestion.query}`}
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        setSearchQuery(suggestion.query);
                        setSearchFocused(false);
                      }}
                      style={{ display: 'block', width: '100%', padding: '10px 12px', textAlign: 'left', background: 'transparent', color: 'var(--text-primary)' }}
                    >
                      {suggestion.label}
                    </button>
                  ))}
                  {!turfs.length && !searchSuggestions.length && (
                    <div style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>No matching venues yet.</div>
                  )}
                </div>
              )}
              {searchQuery && (
                <button 
                  type="button" 
                  className="search-clear-btn"
                  onClick={() => setSearchQuery('')}
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>
            <Link
              to="/activities?category=AMUSEMENT_PARK"
              className="btn btn-secondary"
              style={{ display: 'inline-flex', marginTop: '0.75rem', borderRadius: '999px' }}
            >
              🎢 Browse amusement parks
            </Link>
          </div>

          {/* Sport Filter Dropdown */}
          <div className="form-group" style={{ maxWidth: '500px', margin: '0 auto 2rem' }}>
            <select
              className="form-input"
              value={activeSport}
              onChange={(e) => setActiveSport(e.target.value)}
              style={{ fontSize: '1.1rem', padding: '16px 24px', fontWeight: 600, color: 'var(--text-primary)', background: 'var(--bg-card)' }}
            >
              <option value="all">🏟️ All Sports</option>
              {Object.entries(SPORTS).slice(0, 8).map(([key, sport]) => (
                <option key={key} value={key}>
                  {sport.emoji} {sport.label}
                </option>
              ))}
              {activeSport !== 'all' && !SPORTS[activeSport] && (
                <option value={activeSport}>🏟️ {activeSport.charAt(0).toUpperCase() + activeSport.slice(1)}</option>
              )}
            </select>
          </div>

          {/* Results */}
          {loading ? (
            <div className="flex-center" style={{ padding: '4rem' }}>
              <div className="loading-spinner" />
            </div>
          ) : searchError ? (
            <div className="empty-state" role="alert">
              <h3>Venue search unavailable</h3>
              <p>{searchError}</p>
              <button type="button" className="btn btn-primary" onClick={() => loadTurfs(1, false)}>Try again</button>
            </div>
          ) : visibleTurfs.length > 0 ? (
            <>
              {usingFallback && (
                <div style={{
                  background: 'rgba(245, 158, 11, 0.1)',
                  border: '1px solid var(--gold-500)',
                  padding: '1rem',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: '2rem',
                  color: 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}>
                  <span>⚠️</span>
                  <span>No turfs found near your current location. Showing all available turfs instead.</span>
                </div>
              )}
              
              {debouncedSearchQuery ? (
                <h3 style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '1.2rem',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  marginBottom: '0.5rem'
                }}>
                  🔍 Search Results for "{debouncedSearchQuery}"
                </h3>
              ) : null}

              {exactMatch && (
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '1rem',
                  flexWrap: 'wrap',
                  padding: '1rem',
                  margin: '1rem 0',
                  border: '1px solid var(--emerald-500)',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(16, 185, 129, 0.08)'
                }}>
                  <div>
                    <strong>Exact venue match</strong>
                    <div>{exactMatch.name} · {[exactMatch.location, exactMatch.city].filter(Boolean).join(', ')}</div>
                  </div>
                  <Link to={`/turfs/${exactMatch.id}`} className="btn btn-primary">View venue</Link>
                </div>
              )}

              <p style={{
                color: 'var(--text-muted)',
                marginBottom: '1.5rem',
                fontSize: '0.9rem'
              }}>
                Showing {visibleTurfs.length} result{visibleTurfs.length !== 1 ? 's' : ''}
                {activeSport !== 'all' ? ` for ${SPORTS[activeSport]?.label || activeSport}` : ''}
                {debouncedSearchQuery ? ' across all locations' : (!usingFallback && userLocation ? ' near you' : '')}
              </p>
              
              <div className="turf-grid">
                {visibleTurfs.map(turf => turf.type === 'activity'
                  ? <ActivitySearchCard key={`activity-${turf.id}`} activity={turf} />
                  : <TurfCard key={`venue-${turf.id}`} turf={turf} userLocation={userLocation} />
                )}
              </div>
              {hasMore && (
                <div style={{ textAlign: 'center', marginTop: '2rem' }}>
                  <button type="button" className="btn btn-secondary" disabled={loading} onClick={() => loadTurfs(page + 1, true)}>
                    Load more venues
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="empty-state">
              <div className="empty-icon">🔍</div>
              <h3>No matching venues or parks found</h3>
              <p>Try a venue name, city, sport, or park category.</p>
            </div>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}

function ActivitySearchCard({ activity }) {
  const image = activity.coverImage || activity.images?.[0] || '/images/hero/image%202%20amusement.jpeg';
  return (
    <Link
      to={`/activities/${activity.slug || activity.id}`}
      className="card activity-search-card"
      style={{ overflow: 'hidden', textDecoration: 'none' }}
    >
      <div style={{ position: 'relative', height: '210px', overflow: 'hidden' }}>
        <img
          src={image}
          alt={activity.name}
          loading="lazy"
          onError={(event) => { event.currentTarget.src = '/images/hero/image%202%20amusement.jpeg'; }}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
        <span className="card-badge badge-sport" style={{ zIndex: 2 }}>
          🎢 {activity.category_label || 'Park & Activity'}
        </span>
      </div>
      <div className="card-body">
        <h3 className="card-title">{activity.name}</h3>
        <div className="card-location">
          <span>📍</span>
          <span>{[activity.location, activity.city].filter(Boolean).join(', ') || 'Location details'}</span>
        </div>
        <div className="card-price">
          {activity.price_from != null ? `Tickets from ${formatPrice(activity.price_from, activity.currency_code)}` : 'View available tickets'}
        </div>
      </div>
    </Link>
  );
}

function getDemoTurfs() {
  return [
    { id: 1, name: 'Green Field Arena', location: 'Anna Nagar, Chennai', sport_type: 'cricket', price_per_hour: 1200, images: ['https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=800&q=80'], amenities: ['Floodlights', 'Parking', 'Changing Room'] },
    { id: 2, name: 'Thunder Football Ground', location: 'Velachery, Chennai', sport_type: 'football', price_per_hour: 1500, images: ['https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&q=80'], amenities: ['Floodlights', 'Washroom', 'Cafeteria'] },
    { id: 3, name: 'Smash Zone Courts', location: 'T Nagar, Chennai', sport_type: 'badminton', price_per_hour: 800, images: ['https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=800&q=80'], amenities: ['Air Conditioning', 'Parking'] },
    { id: 4, name: 'Elite Cricket Hub', location: 'Porur, Chennai', sport_type: 'box cricket', price_per_hour: 1000, images: ['https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=800&q=80'], amenities: ['Floodlights', 'Seating Area', 'CCTV'] },
    { id: 5, name: 'Ace Tennis Academy', location: 'Adyar, Chennai', sport_type: 'tennis', price_per_hour: 900, images: ['https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=800&q=80'], amenities: ['Coaching', 'Equipment'] },
    { id: 6, name: 'Slam Dunk Arena', location: 'Nungambakkam, Chennai', sport_type: 'basketball', price_per_hour: 1100, images: ['https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800&q=80'], amenities: ['Floodlights', 'Drinking Water'] },
  ];
}

export default function TurfsPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <TurfsPageContent />
    </Suspense>
  );
}
