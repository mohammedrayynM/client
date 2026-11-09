import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import MatchJoinFlow from '@/components/MatchJoinFlow';
import { apiGet } from '@/lib/api';
import { getSportInfo, formatDate } from '@/lib/constants';
import { setPageMeta } from '@/lib/seo';

export default function MatchDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [match, setMatch] = useState(null);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showJoinFlow, setShowJoinFlow] = useState(false);
  const [userJoinedRole, setUserJoinedRole] = useState(null);

  const userData = JSON.parse(localStorage.getItem('userData') || '{}');

  useEffect(() => {
    fetchMatchDetail();
  }, [id]);

  useEffect(() => {
    const title = match?.turf_name
      ? `Match at ${match.turf_name} — Book Arena`
      : 'Match Details — Book Arena';
    setPageMeta({
      title,
      description: 'View match details and join the game through Book Arena.',
      keywords: 'match details, join match, find players, book arena',
      robots: 'noindex, nofollow'
    });
  }, [match?.turf_name]);

  async function fetchMatchDetail() {
    try {
      setLoading(true);
      const data = await apiGet(`/match-requests/${id}`);
      setMatch(data.match);
      setPlayers(data.players || []);
      
      // Check if current user already joined
      const joinedPlayer = data.players?.find(p => p.user_id === userData.id);
      if (joinedPlayer) {
        setUserJoinedRole(joinedPlayer.role);
      }
    } catch (err) {
      setError(err.message || 'Failed to load match details');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="page-wrapper">
        <Navbar />
        <div className="container" style={{ paddingTop: '120px', paddingBottom: '4rem', maxWidth: '900px' }}>
          <div className="match-detail-header" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3rem', marginBottom: '3rem' }}>
            <div className="skeleton-card" style={{ height: '400px', borderRadius: '20px' }}></div>
            <div>
              <div className="skeleton-card" style={{ height: '40px', width: '80%', marginBottom: '1rem', borderRadius: '8px' }}></div>
              <div className="skeleton-card" style={{ height: '24px', width: '50%', marginBottom: '2rem', borderRadius: '4px' }}></div>
              <div className="skeleton-card" style={{ height: '120px', width: '100%', marginBottom: '1.5rem', borderRadius: '12px' }}></div>
              <div className="skeleton-card" style={{ height: '60px', width: '100%', borderRadius: '12px' }}></div>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (error || !match) {
    return (
      <div className="page-wrapper">
        <Navbar />
        <div className="container" style={{ paddingTop: '120px', minHeight: '60vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>❌</div>
          <h2>Match Not Found</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>{error}</p>
          <button className="btn btn-primary" onClick={() => navigate('/find-players')}>Back to Matches</button>
        </div>
        <Footer />
      </div>
    );
  }

  const sport = getSportInfo(match.sport_type);
  let roles = [];
  try {
    roles = Array.isArray(match.roles_needed)
      ? match.roles_needed
      : (typeof match.roles_needed === 'string'
          ? JSON.parse(match.roles_needed || '[]')
          : []);
  } catch (e) {
    console.error('Failed to parse roles in MatchDetail:', e);
    roles = [];
  }
  const isFull = match.status === 'full';
  const isUrgent = new Date(`${match.match_date}T${match.match_time}`) - new Date() < 2 * 60 * 60 * 1000;
  const rolesNeeded = {};

  roles.forEach(role => {
    const roleCount = players.filter(p => p.role === role).length;
    rolesNeeded[role] = {
      filled: roleCount,
      total: roles.length > 0 ? Math.ceil(match.total_slots / roles.length) : 0
    };
  });

  const emptySlots = match.total_slots - match.filled_slots;

  let turfImages = match.turf_images;
  if (typeof turfImages === 'string') {
    try {
      turfImages = JSON.parse(turfImages);
    } catch (e) {
      turfImages = [];
    }
  }
  if (!Array.isArray(turfImages)) {
    turfImages = [];
  }

  return (
    <div className="page-wrapper">
      <Navbar />

      <div className="container" style={{ paddingTop: '120px', paddingBottom: '4rem', maxWidth: '900px' }}>
        {/* HEADER SECTION */}
        <div className="match-detail-header" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3rem', marginBottom: '3rem' }}>
          {/* LEFT: VENUE IMAGE & BADGES */}
          <div style={{ position: 'relative' }}>
            <div style={{
              position: 'relative',
              borderRadius: '20px',
              overflow: 'hidden',
              aspectRatio: '1',
              marginBottom: '1.5rem'
            }}>
              <img
                src={turfImages[0] || '/images/default-turf.jpg'}
                alt={match.turf_name}
                loading="lazy"
                decoding="async"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              
              {/* BADGES OVERLAY */}
              <div style={{
                position: 'absolute',
                top: '1rem',
                left: '1rem',
                display: 'flex',
                gap: '0.5rem',
                flexWrap: 'wrap'
              }}>
                {isUrgent && (
                  <div style={{
                    background: 'rgba(239, 68, 68, 0.9)',
                    color: '#fff',
                    padding: '0.5rem 1rem',
                    borderRadius: '50px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    letterSpacing: '0.5px',
                    animation: 'pulse 2s infinite'
                  }}>
                    🔥 URGENT
                  </div>
                )}
                {isFull && (
                  <div style={{
                    background: 'rgba(107, 114, 128, 0.9)',
                    color: '#fff',
                    padding: '0.5rem 1rem',
                    borderRadius: '50px',
                    fontSize: '0.8rem',
                    fontWeight: 700
                  }}>
                    MATCH FULL
                  </div>
                )}
                {match.is_featured && (
                  <div style={{
                    background: 'rgba(251, 146, 60, 0.9)',
                    color: '#fff',
                    padding: '0.5rem 1rem',
                    borderRadius: '50px',
                    fontSize: '0.8rem',
                    fontWeight: 700
                  }}>
                    ⭐ FEATURED
                  </div>
                )}
              </div>

              {/* HOST OVERLAY */}
              <div style={{
                position: 'absolute',
                bottom: '1rem',
                left: '1rem',
                right: '1rem',
                background: 'rgba(0, 0, 0, 0.6)',
                backdrop: 'blur(10px)',
                borderRadius: '12px',
                padding: '1rem',
                display: 'flex',
                gap: '1rem',
                alignItems: 'center'
              }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #059669, #10b981)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.5rem',
                  fontWeight: 700,
                  flexShrink: 0
                }}>
                  {match.host_name?.[0]}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{match.host_name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>⭐ {match.host_karma} Karma</div>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: MATCH INFO */}
          <div>
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem' }}>
                <span style={{ fontSize: '1.5rem' }}>{sport.emoji}</span>
                <h1 style={{ fontSize: '2rem', margin: 0 }}>{match.turf_name}</h1>
              </div>
              <p style={{ color: 'var(--text-muted)', margin: 0 }}>{match.turf_address}</p>
            </div>

            <div style={{ background: 'var(--bg-card)', padding: '1.5rem', borderRadius: '16px', marginBottom: '1.5rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Date</div>
                  <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>📅 {formatDate(match.match_date)}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Time</div>
                  <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>🕒 {match.match_time.substring(0, 5)}</div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1.5rem' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Sport & Level</div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <div style={{ fontWeight: 700 }}>{match.sport_type}</div>
                  <div style={{ fontWeight: 700, color: 'var(--emerald-400)' }}>{match.skill_level}</div>
                </div>
              </div>
            </div>

            {/* PLAYER COUNT */}
            <div style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.1), rgba(5,150,105,0.1))', padding: '1.5rem', borderRadius: '16px', borderLeft: '4px solid var(--emerald-500)' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Players</div>
              <div style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--emerald-400)', marginBottom: '0.5rem' }}>
                {match.filled_slots}/{match.total_slots}
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                {emptySlots} slots available • {match.match_type}
              </div>
            </div>
          </div>
        </div>

        {/* PAYMENT & PRICING */}
        <div style={{ background: 'var(--bg-card)', padding: '2rem', borderRadius: '16px', marginBottom: '3rem' }}>
          <h3 style={{ marginTop: 0 }}>Payment Options</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Advance Payment</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--emerald-400)' }}>₹{match.advance_amount}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Secure your slot now</div>
            </div>
            <div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Split Payment</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--emerald-400)' }}>₹{match.split_amount}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Pay at venue</div>
            </div>
          </div>
        </div>

        {/* ROLES NEEDED */}
        <div style={{ marginBottom: '3rem' }}>
          <h3>Roles Needed</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
            {roles.map(role => {
              const roleStats = rolesNeeded[role];
              const isFilled = roleStats.filled >= roleStats.total;
              return (
                <div
                  key={role}
                  style={{
                    background: isFilled ? 'rgba(107, 114, 128, 0.1)' : 'var(--bg-card)',
                    padding: '1.5rem',
                    borderRadius: '12px',
                    textAlign: 'center',
                    border: `2px solid ${isFilled ? 'var(--border-subtle)' : 'var(--emerald-500)'}`,
                    opacity: isFilled ? 0.6 : 1
                  }}
                >
                  <div style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem' }}>{role}</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    {roleStats.filled}/{roleStats.total} filled
                  </div>
                  {isFilled && <div style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '0.5rem' }}>Full</div>}
                </div>
              );
            })}
          </div>
        </div>

        {/* JOINED PLAYERS */}
        {players.length > 0 && (
          <div style={{ marginBottom: '3rem' }}>
            <h3>{players.length} Players Joined</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
              {players.map(player => (
                <div
                  key={player.id}
                  style={{
                    background: 'var(--bg-card)',
                    padding: '1rem',
                    borderRadius: '12px',
                    border: `1px solid ${player.status === 'approved' ? 'var(--emerald-500)' : 'var(--border-subtle)'}`,
                    display: 'flex',
                    gap: '1rem'
                  }}
                >
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #059669, #10b981)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1rem',
                    fontWeight: 700,
                    flexShrink: 0
                  }}>
                    {player.user_name?.[0]}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{player.user_name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{player.role}</div>
                    <div style={{ fontSize: '0.7rem', color: player.status === 'approved' ? 'var(--emerald-400)' : 'var(--gold-500)', marginTop: '0.25rem', textTransform: 'capitalize' }}>
                      {player.status === 'approved' ? '✅' : '⏳'} {player.status}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* JOIN BUTTON */}
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: 'var(--bg-primary)',
          borderTop: '1px solid var(--border-subtle)',
          padding: '1.5rem',
          display: 'flex',
          gap: '1rem',
          justifyContent: 'center'
        }}>
          <button
            className="btn btn-secondary"
            onClick={() => navigate('/find-players')}
            style={{ flex: 1, maxWidth: '400px' }}
          >
            Back to Matches
          </button>
          
          {userJoinedRole ? (
            <button className="btn" style={{ flex: 1, maxWidth: '400px', background: 'var(--emerald-500)', border: 'none', cursor: 'default' }}>
              ✅ YOU'RE IN ({userJoinedRole})
            </button>
          ) : !isFull ? (
            <button
              className="btn btn-primary"
              onClick={() => setShowJoinFlow(true)}
              style={{ flex: 1, maxWidth: '400px' }}
            >
              JOIN THIS MATCH
            </button>
          ) : (
            <button className="btn" style={{ flex: 1, maxWidth: '400px', background: '#6b7280', border: 'none', cursor: 'not-allowed' }}>
              MATCH FULL
            </button>
          )}
        </div>

        {/* SAFE BOTTOM PADDING */}
        <div style={{ height: '100px' }} />
      </div>

      {showJoinFlow && (
        <MatchJoinFlow
          match={match}
          onClose={() => setShowJoinFlow(false)}
          onSuccess={() => {
            setShowJoinFlow(false);
            fetchMatchDetail();
          }}
        />
      )}

      <Footer />
    </div>
  );
}
