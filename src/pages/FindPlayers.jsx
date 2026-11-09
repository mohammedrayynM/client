import { useState, useEffect, useCallback, useRef } from 'react';
import Navbar from '../components/Navbar';
import MatchRequestCard from '../components/MatchRequestCard';
import MarkAvailableModal from '@/components/MarkAvailableModal';
import InvitePlayerModal from '@/components/InvitePlayerModal';
import MatchJoinFlow from '../components/MatchJoinFlow';
import { apiGet, apiDelete, apiPost, API_BASE } from '@/lib/api';
import { SPORTS } from '@/lib/constants';
import { setPageMeta } from '@/lib/seo';

export default function FindPlayers() {
  // Keep the options explicit (order matters for UI + requirements)
  const SPORT_OPTIONS = [
    'All',
    'Cricket',
    'Football',
    'Badminton',
    'Tennis',
    'Basketball',
    'Volleyball',
    'Box Cricket',
    'Hockey',
    'Swimming',
    'Other'
  ];
  const [requests, setRequests] = useState([]);
  const [isFallback, setIsFallback] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showAvailableModal, setShowAvailableModal] = useState(false);
  const [activeTab, setActiveTab] = useState('matches'); // 'matches' | 'availablePlayers' | 'availableToPlay'
  const [availablePlayers, setAvailablePlayers] = useState([]);
  const [inviteTarget, setInviteTarget] = useState(null);
  const [filters, setFilters] = useState({ sport: 'All', radius: 25, sort: 'nearest' });
  const [location, setLocation] = useState({ lat: 12.9716, lng: 77.5946 });
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);

  const [myActiveAvailability, setMyActiveAvailability] = useState(null);
  const userData = JSON.parse(localStorage.getItem('userData') || '{}');

  useEffect(() => {
    setPageMeta({
      title: 'Find Players — Join Nearby Matches | Book Arena',
      description: 'Find active matches, join nearby games, and mark yourself available to play. Meet players and get on the field faster.',
      keywords: 'find players, join match, nearby matches, play sports, cricket players, football players, book arena',
      canonicalUrl: 'https://bookarena.in/find-players'
    });
  }, []);

  const isFutureMatch = useCallback((m) => {
    try {
      const date = String(m?.match_date || '').slice(0, 10);
      // Some match rows can have match_time missing/null (depending on creation flow).
      // In that case, treat the match as valid so the list never becomes empty while matches exist.
      if (!m?.match_time) return true;
      const time = String(m.match_time).slice(0, 8);
      if (!date) return true;
      const dt = new Date(`${date}T${time}`);
      if (Number.isNaN(dt.getTime())) return true;
      return dt.getTime() >= Date.now();
    } catch {
      return true;
    }
  }, []);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 1. Detect Location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => console.log('Geolocation not available/denied. Using default.', err)
      );
    }
  }, []);

  // 2. Fetch Requests
  const fetchMatches = useCallback(async (isNew = false) => {
    if (!location) return;
    setLoading(true);
    try {
      const currentPage = isNew ? 1 : page;
      // IMPORTANT: sport can contain spaces (e.g. "Box Cricket") so it must be encoded.
      const data = await apiGet(`/match-requests/nearby?lat=${location.lat}&lng=${location.lng}&sport=${encodeURIComponent(filters.sport)}&radius=${filters.radius}&page=${currentPage}`);
      
      // Timezone differences on client side can mistakenly filter out today's matches.
      // Since the server already correctly filters matches on the DB query, we use the server's results directly.
      const next = data.requests || [];
      
      if (isNew) {
        setRequests(next);
        setIsFallback(data.fallback || false);
      } else {
        setRequests(prev => [...prev, ...next]);
        if (data.fallback) setIsFallback(true);
      }
      
      setHasMore((data.requests || []).length === 10);
      setPage(currentPage + 1);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [location, filters, page]);

  // Fetch available players
  const fetchAvailablePlayers = useCallback(async (isNew = false) => {
    if (!location) return;
    setLoading(true);
    try {
      const currentPage = isNew ? 1 : page;
      const data = await apiGet(`/player-availability/nearby?lat=${location.lat}&lng=${location.lng}&sport=${encodeURIComponent(filters.sport)}&radius=${filters.radius}&date=${new Date().toISOString().split('T')[0]}&page=${currentPage}`);
      if (isNew) setAvailablePlayers(data.players || []);
      else setAvailablePlayers(prev => [...prev, ...(data.players || [])]);
      setHasMore(data.players?.length === 10);
      setPage(currentPage + 1);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [location, filters, page]);

  useEffect(() => {
    if (!location) return;
    setIsFallback(false);
    if (activeTab === 'availablePlayers') fetchAvailablePlayers(true);
    else fetchMatches(true);
  }, [location, filters.sport, filters.radius, filters.sort, activeTab]);

  // -----------------------------------------------------------------------
  // Live updates (SSE): new match requests + player count updates
  // -----------------------------------------------------------------------
  const locationRef = useRef(location);
  const activeTabRef = useRef(activeTab);
  const fetchMatchesRef = useRef(fetchMatches);

  useEffect(() => { locationRef.current = location; }, [location]);
  useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);
  useEffect(() => { fetchMatchesRef.current = fetchMatches; }, [fetchMatches]);

  useEffect(() => {
    let es;
    try {
      es = new EventSource(`${API_BASE}/match-requests/events`);
    } catch {
      return;
    }

    const onCreated = () => {
      // Only refresh the Matches tab (avoid interrupting other tabs)
      if (activeTabRef.current !== 'matches') return;
      if (!locationRef.current) return;
      fetchMatchesRef.current(true);
    };

    const onUpdated = (e) => {
      try {
        const payload = JSON.parse(e.data || '{}');
        const match = payload.match;
        if (!match?.id) return;
        setRequests(prev =>
          prev.map(r => (Number(r.id) === Number(match.id) ? { ...r, ...match } : r))
        );
      } catch {
        // ignore
      }
    };

    es.addEventListener('match_request_created', onCreated);
    es.addEventListener('match_request_updated', onUpdated);

    return () => {
      try { es.close(); } catch {}
    };
  }, []);

  // Keep availability statuses fresh (auto-expire)
  useEffect(() => {
    apiPost('/player-availability/cleanup', {}).catch(() => {});
  }, []);

  const fetchMyAvailability = useCallback(async () => {
    if (!userData?.id) {
      setMyActiveAvailability(null);
      return;
    }
    try {
      const data = await apiGet(`/player-availability/user/${userData.id}`);
      const today = new Date().toISOString().split('T')[0];
      const active = (data.availability || []).find(a => a.status === 'active' && String(a.availability_date).slice(0, 10) === today);
      setMyActiveAvailability(active || null);
    } catch {
      setMyActiveAvailability(null);
    }
  }, [userData?.id]);

  useEffect(() => {
    if (activeTab === 'availableToPlay') fetchMyAvailability();
  }, [activeTab, fetchMyAvailability]);

  const handleJoin = (match) => {
    setSelectedMatch(match);
  };

  return (
    <div className="page-wrapper">
      <Navbar />
      
      <div className="container" style={{ paddingTop: '120px', paddingBottom: '4rem' }}>
        <div className="section-header">
          <h1 className="section-title">Find <span className="accent">Players</span></h1>
          <p className="section-subtitle">Join nearby matches and meet fellow athletes instantly.</p>
        </div>

        <div className="findplayers-tabs-row">
          <div className="findplayers-tabs">
            <button className={`filter-pill ${activeTab === 'matches' ? 'active' : ''}`} onClick={() => { setActiveTab('matches'); setPage(1); }}>
              Matches
            </button>
            <button className={`filter-pill ${activeTab === 'availablePlayers' ? 'active' : ''}`} onClick={() => { setActiveTab('availablePlayers'); setPage(1); }}>
              Available Players
            </button>
            <button className={`filter-pill ${activeTab === 'availableToPlay' ? 'active' : ''}`} onClick={() => { setActiveTab('availableToPlay'); setPage(1); }}>
              Available to Play
            </button>
          </div>
          <div className="findplayers-tabs-action">
            <button className="btn btn-primary" onClick={() => setShowAvailableModal(true)}>I Am Available to Play</button>
          </div>
        </div>

        {/* Filters */}
        <div className="filters-container">
          <div className="findplayers-filters-row">
            <div style={{ flex: 1, minWidth: 0 }}>
              {isMobile ? (
                <select
                  className="filter-select findplayers-filter-select-full"
                  value={filters.sport}
                  onChange={(e) => setFilters({ ...filters, sport: e.target.value })}
                >
                  {SPORT_OPTIONS.map(sport => (
                    <option key={sport} value={sport}>{sport}</option>
                  ))}
                </select>
              ) : (
                <div className="sport-filters">
                  {SPORT_OPTIONS.map(sport => (
                    <button
                      key={sport}
                      className={`filter-pill ${filters.sport === sport ? 'active' : ''}`}
                      onClick={() => setFilters({ ...filters, sport })}
                    >
                      {sport}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="other-filters">
              <select className="filter-select" value={filters.radius} onChange={(e) => setFilters({ ...filters, radius: e.target.value })}>
                <option value="10">Within 10 km</option>
                <option value="25">Within 25 km</option>
                <option value="50">Within 50 km</option>
                <option value="100">Within 100 km</option>
              </select>
            </div>
          </div>
        </div>

        {/* Results */}
        {activeTab === 'availableToPlay' ? (
          <div className="card" style={{ padding: '1.25rem' }}>
            <h3 style={{ marginTop: 0 }}>Your Availability</h3>
            {!userData?.id ? (
              <p style={{ color: 'var(--text-muted)' }}>Login to mark yourself available.</p>
            ) : myActiveAvailability ? (
              <div style={{ display: 'grid', gap: '0.75rem' }}>
                <div style={{ color: 'var(--text-muted)' }}>
                  Active for {String(myActiveAvailability.availability_date).slice(0, 10)} • {String(myActiveAvailability.availability_start).slice(0, 5)} - {String(myActiveAvailability.availability_end).slice(0, 5)}
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <button className="btn btn-secondary" onClick={() => setShowAvailableModal(true)}>Edit Availability</button>
                  <button
                    className="btn btn-danger"
                    onClick={async () => {
                      try {
                        await apiDelete(`/player-availability/${myActiveAvailability.id}`);
                        await fetchMyAvailability();
                        if (activeTab === 'availablePlayers') fetchAvailablePlayers(true);
                      } catch (e) {
                        alert(e.message);
                      }
                    }}
                  >
                    Turn Off
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '0.75rem' }}>
                <p style={{ color: 'var(--text-muted)' }}>You are not currently marked as available.</p>
                <button className="btn btn-primary" onClick={() => setShowAvailableModal(true)}>Mark Me Available</button>
              </div>
            )}
          </div>
        ) : activeTab === 'matches' ? (
          loading && requests.length === 0 ? (
            <div className="flex-center" style={{ padding: '3rem', flexDirection: 'column', gap: '1rem' }}>
              <div className="loading-spinner" />
              <div style={{ color: 'var(--text-muted)' }}>Loading matches near you...</div>
            </div>
          ) : (
            <>
              {isFallback && requests.length > 0 && (
                <div className="fallback-banner" style={{
                  background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(37, 99, 235, 0.03) 100%)',
                  border: '1px solid rgba(59, 130, 246, 0.25)',
                  color: '#93c5fd',
                  padding: '1.25rem 1.5rem',
                  borderRadius: '16px',
                  marginBottom: '2rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  fontSize: '0.95rem',
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
                  backdropFilter: 'blur(8px)',
                  animation: 'fadeIn 0.4s ease'
                }}>
                  <span style={{ fontSize: '1.5rem' }}>📢</span>
                  <div>
                    <strong style={{ color: '#fff', display: 'block', marginBottom: '2px' }}>No matches found in your region!</strong> 
                    Showing all available active matches from other regions instead.
                  </div>
                </div>
              )}
              {requests.length > 0 ? (
                <div className="findplayers-grid" style={{ gap: '2rem' }}>
                  {requests.map(req => (
                    <MatchRequestCard 
                      key={req.id} 
                      request={req} 
                      onJoin={handleJoin}
                      isJoinedByMe={false} // Would check against user's joined list
                    />
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <div style={{ fontSize: '4rem', marginBottom: '1.5rem' }}>🏟️</div>
                  <h3>No matches nearby right now.</h3>
                  <p>Check back soon, try increasing the radius, or mark yourself available!</p>
                </div>
              )}
            </>
          )
        ) : activeTab === 'availablePlayers' ? (
          loading && availablePlayers.length === 0 ? (
            <div className="flex-center" style={{ padding: '3rem' }}>
              <div className="loading-spinner" />
            </div>
          ) : availablePlayers.length > 0 ? (
            <div className="findplayers-grid" style={{ gap: '2rem' }}>
              {availablePlayers.map(p => (
                <div key={p.id} className="availability-card" style={{ background: 'var(--bg-card)', padding: '1.25rem', borderRadius: '12px' }}>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg,#059669,#10b981)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>{p.user_name?.[0]}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 800 }}>{p.user_name}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{p.role} · {p.skill_level}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{p.preferred_location || p.turf_name || ''} · {p.distance?.toFixed(1)} km</div>
                    </div>
                    <div>
                      <button className="btn btn-primary" onClick={() => setInviteTarget(p)}>Invite</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <div style={{ fontSize: '4rem', marginBottom: '1.5rem' }}>🏟️</div>
              <h3>No available players nearby right now.</h3>
              <p>Check back soon, try increasing the radius, or invite your friends!</p>
            </div>
          )
        ) : null}

        {hasMore && !loading && (
          <div className="flex-center" style={{ marginTop: '3rem' }}>
            <button
              className="btn btn-secondary"
              onClick={() => {
                if (activeTab === 'availablePlayers') fetchAvailablePlayers(false);
                else fetchMatches(false);
              }}
            >
              {activeTab === 'availablePlayers' ? 'Load More Players' : 'Load More Matches'}
            </button>
          </div>
        )}
      </div>

      {selectedMatch && (
        <MatchJoinFlow 
          match={selectedMatch} 
          onClose={() => setSelectedMatch(null)}
          onSuccess={() => {
            setSelectedMatch(null);
            fetchMatches(true); // Refresh
          }}
        />
      )}

      <MarkAvailableModal
        isOpen={showAvailableModal}
        onClose={() => setShowAvailableModal(false)}
        onSuccess={() => {
          setShowAvailableModal(false);
          // Switch to Available Players tab and refresh immediately
          setActiveTab('availablePlayers');
          fetchAvailablePlayers(true);
          fetchMyAvailability();
        }}
        prefilledData={{}}
      />

      {inviteTarget && (
        <InvitePlayerModal
          isOpen={inviteTarget !== null}
          onClose={() => setInviteTarget(null)}
          availability={inviteTarget}
          onInviteSuccess={(inviteId) => {
            console.log('Invite sent successfully:', inviteId);
          }}
        />
      )}
    </div>
  );
}
