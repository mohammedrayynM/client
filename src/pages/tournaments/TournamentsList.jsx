import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import AdBanner from '@/components/AdBanner';
import { apiGet } from '@/lib/api';
import { setPageMeta } from '@/lib/seo';
import { 
  Trophy, 
  Calendar, 
  MapPin, 
  Users, 
  Search, 
  ChevronRight, 
  Radio, 
  Sparkles,
  Award 
} from 'lucide-react';

const SPORTS = [
  { id: 'all', label: 'All Sports' },
  { id: 'Football', label: 'Football' },
  { id: 'Cricket', label: 'Cricket' },
  { id: 'Badminton', label: 'Badminton' },
  { id: 'Basketball', label: 'Basketball' },
  { id: 'Volleyball', label: 'Volleyball' },
  { id: 'Tennis', label: 'Tennis' },
  { id: 'Table Tennis', label: 'Table Tennis' },
];

const STATUS_FILTERS = [
  { id: 'all', label: 'All Status' },
  { id: 'REGISTRATION_OPEN', label: 'Registration Open' },
  { id: 'LIVE', label: 'Live Now' },
  { id: 'UPCOMING', label: 'Upcoming' },
  { id: 'COMPLETED', label: 'Completed' },
];

export default function TournamentsList() {
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSport, setActiveSport] = useState('all');
  const [activeStatus, setActiveStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    setPageMeta({
      title: 'Tournaments — Book Arena',
      description: 'Explore live, upcoming, and featured sports tournaments. Join teams, track live scores, and win championships.',
      canonicalUrl: 'https://bookarena.in/tournaments'
    });
  }, []);

  useEffect(() => {
    const fetchTournaments = async () => {
      setLoading(true);
      try {
        let url = '/tournaments?';
        if (activeSport !== 'all') url += `sport=${encodeURIComponent(activeSport)}&`;
        if (activeStatus !== 'all') url += `status=${encodeURIComponent(activeStatus)}&`;
        if (searchQuery) url += `search=${encodeURIComponent(searchQuery)}&`;

        const res = await apiGet(url);
        if (res.success) {
          setTournaments(res.tournaments || []);
        }
      } catch (err) {
        console.error('Failed to load tournaments:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTournaments();
  }, [activeSport, activeStatus, searchQuery]);

  return (
    <div className="modern-page">
      <Navbar />

      {/* Hero Banner with Modern Styling & Padding-top for Navbar */}
      <section className="modern-hero">
        <div className="modern-hero-inner">
          <div className="modern-hero-top">
            <div>
              <div className="modern-badge">
                <Trophy size={14} /> Book Arena Championships
              </div>
              <h1 className="modern-title">Compete, Score & Win</h1>
              <p className="modern-subtitle">
                Discover local and regional sports tournaments. View live scoreboards, match fixtures, YouTube streams, and player stats.
              </p>
            </div>

            {/* Quick stats and host button */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div className="modern-stats-box">
                <div className="modern-stat-item" style={{ borderRight: '1px solid rgba(52,211,153,0.2)', paddingRight: '1.25rem' }}>
                  <div className="modern-stat-value" style={{ color: '#34d399' }}>{tournaments.length}</div>
                  <div className="modern-stat-label">Tournaments</div>
                </div>
                <div className="modern-stat-item">
                  <div className="modern-stat-value" style={{ color: '#fbbf24' }}>
                    {tournaments.filter(t => t.status === 'LIVE').length}
                  </div>
                  <div className="modern-stat-label">Live Now</div>
                </div>
              </div>

              <Link
                to="/tournaments/create"
                className="btn btn-primary"
                style={{
                  borderRadius: '50px',
                  padding: '10px 22px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  fontSize: '0.85rem',
                  fontWeight: 800,
                  boxShadow: '0 4px 20px rgba(16, 185, 129, 0.4)'
                }}
              >
                <Trophy size={16} /> + Host a Tournament
              </Link>
            </div>
          </div>

          {/* Search & Status Filters */}
          <div className="modern-search-bar" style={{ marginTop: '0.5rem' }}>
            <div className="modern-input-wrapper">
              <Search className="modern-input-icon" size={16} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tournaments, sports or venues..."
                className="modern-input"
              />
            </div>

            <div className="modern-pills-row" style={{ paddingBottom: 0, overflowX: 'auto' }}>
              {STATUS_FILTERS.map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setActiveStatus(st.id)}
                  className={`modern-pill ${activeStatus === st.id ? 'active' : ''}`}
                  style={{ fontSize: '0.75rem', padding: '0.45rem 1rem' }}
                >
                  {st.id === 'LIVE' && <span className="modern-dot-ping" />}
                  {st.label}
                </button>
              ))}
            </div>
          </div>

          {/* Sport Selector Chips */}
          <div className="modern-pills-row" style={{ marginTop: '0.25rem' }}>
            {SPORTS.map((sp) => (
              <button
                key={sp.id}
                type="button"
                onClick={() => setActiveSport(sp.id)}
                className={`modern-chip ${activeSport === sp.id ? 'active' : ''}`}
              >
                {sp.id === 'all' ? '🏆' : sp.id === 'Football' ? '⚽' : sp.id === 'Cricket' ? '🏏' : '🏸'}
                <span>{sp.label}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Main Grid Content */}
      <main className="modern-container">
        <AdBanner placement="TOURNAMENT_AD" className="mb-6" />

        {loading ? (
          <div className="modern-grid">
            {[1, 2, 3].map((n) => (
              <div key={n} className="modern-card" style={{ height: '320px', opacity: 0.5, animation: 'pulse 1.5s infinite' }} />
            ))}
          </div>
        ) : tournaments.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem 1.5rem', background: 'rgba(15,31,53,0.5)', borderRadius: '1.5rem', border: '1px solid rgba(52,211,153,0.15)' }}>
            <Trophy size={48} color="#64748b" style={{ margin: '0 auto 1rem auto' }} />
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f1f5f9' }}>No Tournaments Found</h3>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: '0.5rem' }}>
              Try adjusting your sport or status filters to discover active tournaments.
            </p>
            <button
              onClick={() => { setActiveSport('all'); setActiveStatus('all'); setSearchQuery(''); }}
              className="btn btn-secondary btn-sm"
              style={{ marginTop: '1.25rem', borderRadius: '50px' }}
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="modern-grid">
            {tournaments.map((t) => {
              const isLive = t.status === 'LIVE';
              const isOpen = t.status === 'REGISTRATION_OPEN';

              return (
                <Link
                  key={t.id}
                  to={`/tournaments/${t.slug}`}
                  className="modern-card"
                >
                  {/* Banner */}
                  <div className="modern-card-thumb">
                    {t.banner ? (
                      <img src={t.banner} alt={t.name} loading="lazy" />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3rem', background: 'linear-gradient(135deg, #0a1628, #0f1f35)' }}>
                        {t.sport === 'Cricket' ? '🏏' : t.sport === 'Football' ? '⚽' : '🏆'}
                      </div>
                    )}
                    <div className="modern-card-gradient" />

                    {/* Sport Badge */}
                    <span className="modern-badge-floating">
                      {t.sport}
                    </span>

                    {/* Status Pill */}
                    {isLive ? (
                      <span className="modern-badge-offer" style={{ background: '#e11d48' }}>
                        🔴 LIVE MATCH
                      </span>
                    ) : isOpen ? (
                      <span className="modern-badge-offer" style={{ background: '#059669' }}>
                        REGISTRATION OPEN
                      </span>
                    ) : (
                      <span className="modern-distance-tag" style={{ top: '1rem', right: '1rem', bottom: 'auto', left: 'auto' }}>
                        {t.status?.replace('_', ' ')}
                      </span>
                    )}
                  </div>

                  {/* Body */}
                  <div className="modern-card-body">
                    <div>
                      <h3 className="modern-card-name">{t.name}</h3>

                      <div className="modern-card-meta">
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <MapPin size={13} color="#10b981" /> {t.venue || t.location || 'Stadium Arena'}
                        </span>
                        <span>•</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Calendar size={13} color="#10b981" /> {new Date(t.start_date).toLocaleDateString()}
                        </span>
                      </div>

                      {t.description && (
                        <p className="modern-card-desc">{t.description}</p>
                      )}
                    </div>

                    {/* Footer */}
                    <div className="modern-card-footer">
                      <div className="modern-price-block">
                        <span>Entry Fee</span>
                        <strong>₹{Number(t.prize_pool_amount || 0).toLocaleString('en-IN')} Prize Pool</strong>
                      </div>

                      <span className="modern-btn-card">
                        View Bracket <ChevronRight size={14} />
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
