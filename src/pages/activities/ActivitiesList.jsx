import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { fetchCategories, fetchActivities } from '@/services/activities';
import { resolveMediaUrl } from '@/lib/mediaUrl';
import { setPageMeta } from '@/lib/seo';
import { 
  Compass, 
  MapPin, 
  Search, 
  Tag, 
  Ticket, 
  Navigation, 
  ChevronRight, 
  Sparkles,
  AlertCircle
} from 'lucide-react';

const SECTIONS = [
  { id: 'all', label: 'All Activities' },
  { id: 'trending', label: 'Trending Near You' },
  { id: 'popular', label: 'Most Popular' },
  { id: 'weekend', label: 'Weekend Getaways' },
  { id: 'family', label: 'Family & Kids' },
  { id: 'friends', label: 'With Friends' },
  { id: 'deals', label: 'Exclusive Deals' },
];
const ACTIVITY_IMAGE_FALLBACK = '/images/hero/image%202%20amusement.jpeg';

export default function ActivitiesList() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const initialCat = searchParams.get('category') || null;
  const initialSection = searchParams.get('section') || 'all';
  const initialCity = searchParams.get('city') || '';

  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState(initialCat);
  const [activeSection, setActiveSection] = useState(initialSection);
  const [search, setSearch] = useState('');
  const [city, setCity] = useState(initialCity);
  const [coords, setCoords] = useState(null);
  const [activities, setActivities] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setPageMeta({
      title: 'Amusement Parks, Water Parks & Adventure Activities | Book Arena',
      description: 'Discover and book tickets for amusement parks, water parks, adventure arenas, and experiential activities with instant QR passes.',
      canonicalUrl: 'https://bookarena.in/activities'
    });
  }, []);

  useEffect(() => {
    fetchCategories()
      .then(setCategories)
      .catch((err) => {
        console.error('Failed to load activity categories:', err);
        setCategories([]);
      });
  }, []);

  const loadActivities = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchActivities({
        category: activeCategory || undefined,
        location: city || undefined,
        search: search.trim() || undefined,
        section: activeSection === 'all' ? undefined : activeSection,
        lat: coords?.lat,
        lng: coords?.lng,
        sort: coords ? 'nearest' : undefined
      });
      setActivities(data);
    } catch (err) {
      console.error('Error fetching activities:', err);
      setError('Could not load activities. Please check your internet or retry.');
      setActivities([]);
    } finally {
      setLoading(false);
    }
  }, [activeCategory, city, search, activeSection, coords]);

  useEffect(() => {
    const timer = setTimeout(loadActivities, 250);
    return () => clearTimeout(timer);
  }, [loadActivities]);

  const handleNearMe = () => {
    if (coords) {
      setCoords(null);
      return;
    }
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        });
      },
      () => {
        alert('Could not retrieve your location. Please check browser permissions.');
      }
    );
  };

  return (
    <div className="modern-page">
      <Navbar />

      {/* Hero Banner with Modern Gradient & Spacing */}
      <section className="modern-hero">
        <div className="modern-hero-inner">
          <div className="modern-hero-top">
            <div>
              <div className="modern-badge">
                <Sparkles size={14} /> Book Arena Experiences
              </div>
              <h1 className="modern-title">Amusement Parks & Activities</h1>
              <p className="modern-subtitle">
                Book theme parks, water slides, trampoline zones, and adventure activities with instant all-in-one digital QR passes.
              </p>
            </div>
          </div>

          {/* Search, City & Near Me Filter Bar */}
          <div className="modern-search-bar" style={{ marginTop: '0.5rem' }}>
            <div className="modern-input-wrapper">
              <Search className="modern-input-icon" size={16} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search parks, rides or activities..."
                className="modern-input"
              />
            </div>

            <div className="modern-input-wrapper" style={{ maxWidth: '220px' }}>
              <MapPin className="modern-input-icon" size={16} />
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="City (e.g. Chennai)"
                className="modern-input"
              />
            </div>

            <button
              type="button"
              onClick={handleNearMe}
              className={`modern-btn-locate ${coords ? 'active' : ''}`}
            >
              <Navigation size={15} />
              {coords ? 'Near You (Active)' : 'Find Near Me'}
            </button>
          </div>

          {/* Section Filter Pills */}
          <div className="modern-pills-row" style={{ marginTop: '0.25rem' }}>
            {SECTIONS.map((sec) => (
              <button
                key={sec.id}
                type="button"
                onClick={() => setActiveSection(sec.id)}
                className={`modern-pill ${activeSection === sec.id ? 'active' : ''}`}
              >
                {sec.label}
              </button>
            ))}
          </div>

          {/* Category Chips with Icons */}
          {categories.length > 0 && (
            <div className="modern-pills-row" style={{ marginTop: '0.25rem' }}>
              <button
                type="button"
                onClick={() => setActiveCategory(null)}
                className={`modern-chip ${!activeCategory ? 'active' : ''}`}
              >
                <span>✨</span> All Categories
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.key_name}
                  type="button"
                  onClick={() => setActiveCategory(activeCategory === cat.key_name ? null : cat.key_name)}
                  className={`modern-chip ${activeCategory === cat.key_name ? 'active' : ''}`}
                >
                  <span>{cat.icon || '🎢'}</span>
                  <span>{cat.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Main Grid Content */}
      <main className="modern-container">
        {error && (
          <div className="modern-alert modern-alert-danger">
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{error}</span>
            <button
              onClick={loadActivities}
              style={{ marginLeft: 'auto', textDecoration: 'underline', background: 'none', color: 'inherit', fontWeight: 700 }}
            >
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <div className="modern-grid">
            {[1, 2, 3].map((n) => (
              <div key={n} className="modern-card" style={{ height: '340px', opacity: 0.5, animation: 'pulse 1.5s infinite' }} />
            ))}
          </div>
        ) : activities && activities.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem 1.5rem', background: 'rgba(15,31,53,0.5)', borderRadius: '1.5rem', border: '1px solid rgba(52,211,153,0.15)' }}>
            <Ticket size={48} color="#64748b" style={{ margin: '0 auto 1rem auto' }} />
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f1f5f9' }}>No Venues Found</h3>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: '0.5rem' }}>
              We couldn't find any activities matching your search or filters. Try searching by city or reset filters.
            </p>
            <button
              onClick={() => {
                setActiveCategory(null);
                setActiveSection('all');
                setSearch('');
                setCity('');
                setCoords(null);
              }}
              className="btn btn-secondary btn-sm"
              style={{ marginTop: '1.25rem', borderRadius: '50px' }}
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="modern-grid">
            {activities?.map((a) => {
              const cover = Array.isArray(a.images) && a.images[0] ? resolveMediaUrl(a.images[0]) : '';
              return (
                <div key={a.id} className="modern-card">
                  {/* Thumbnail Banner */}
                  <div className="modern-card-thumb">
                    {cover ? (
                      <img
                        src={cover || ACTIVITY_IMAGE_FALLBACK}
                        alt={a.name}
                        loading="lazy"
                        onError={(event) => {
                          event.currentTarget.onerror = null;
                          event.currentTarget.src = ACTIVITY_IMAGE_FALLBACK;
                        }}
                      />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3.5rem', background: 'linear-gradient(135deg, #0a1628, #0f1f35)' }}>
                        {a.category_label === 'Water Park' ? '🌊' : '🎢'}
                      </div>
                    )}
                    <div className="modern-card-gradient" />

                    {/* Category pill */}
                    <span className="modern-badge-floating">
                      {a.category_label || 'Amusement Park'}
                    </span>

                    {/* Offer badge */}
                    {a.has_offer && (
                      <span className="modern-badge-offer">
                        <Tag size={12} style={{ display: 'inline', marginRight: '4px' }} /> SPECIAL OFFER
                      </span>
                    )}

                    {/* Distance tag */}
                    {a.distance_km != null && (
                      <span className="modern-distance-tag">
                        📍 {a.distance_km} km away
                      </span>
                    )}
                  </div>

                  {/* Body */}
                  <div className="modern-card-body">
                    <div>
                      <h3 className="modern-card-name">{a.name}</h3>

                      <div className="modern-card-meta">
                        {a.location && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <MapPin size={13} color="#10b981" /> {a.location}
                          </span>
                        )}
                        {a.city && <span>• {a.city}</span>}
                      </div>

                      {a.short_description && (
                        <p className="modern-card-desc">{a.short_description}</p>
                      )}
                    </div>

                    {/* Footer */}
                    <div className="modern-card-footer">
                      <div className="modern-price-block">
                        <span>Tickets From</span>
                        <strong>{a.starting_price != null ? `₹${a.starting_price}` : 'View Passes'}</strong>
                      </div>

                      <Link to={`/activities/${a.slug}`} className="modern-btn-card">
                        Book Tickets <ChevronRight size={14} />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
