import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import MatchJoinFlow from '@/components/MatchJoinFlow';
import { apiGet } from '@/lib/api';
import { getSportInfo, formatDate } from '@/lib/constants';
import { setPageMeta } from '@/lib/seo';

export default function MatchRequestPublic() {
  const { token } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [match, setMatch] = useState(null);
  const [players, setPlayers] = useState([]);
  const [contributionTotal, setContributionTotal] = useState(0);
  const [invite, setInvite] = useState(null);   // backend-authoritative state: open/full/cancelled/expired/completed, share, spots, amounts
  const [showJoin, setShowJoin] = useState(false);

  const sport = useMemo(() => getSportInfo(match?.sport_type), [match?.sport_type]);

  useEffect(() => {
    const title = match?.turf_name
      ? `Find Players — ${String(match.sport_type || '').toUpperCase()} at ${match.turf_name} | Book Arena`
      : 'Find Players — Match Invite | Book Arena';
    setPageMeta({
      title,
      description: 'Join this match invite on Book Arena. View match details and confirm your slot.',
      keywords: 'find players, match invite, join match, book arena',
      robots: 'noindex, nofollow'
    });
  }, [match?.turf_name, match?.sport_type]);

  async function load() {
    try {
      setLoading(true);
      setError('');
      const data = await apiGet(`/match-requests/public/${token}`);
      setMatch(data.match);
      setPlayers(data.players || []);
      setContributionTotal(Number(data.contribution_total || 0));
      setInvite(data.invite || null);
    } catch (e) {
      setError(e.message || 'Failed to load match');
      setMatch(null);
      setPlayers([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // "Live" updates via polling
    const id = setInterval(load, 8000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

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
        <div className="container" style={{ paddingTop: 120, paddingBottom: 60, textAlign: 'center' }}>
          <h2 style={{ marginBottom: 8 }}>Match not found</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: 18 }}>{error}</p>
          <button className="btn btn-primary" onClick={() => navigate('/find-players')}>
            Back to Find Players
          </button>
        </div>
        <Footer />
      </div>
    );
  }

  const state = invite?.state || (match.status === 'full' || match.filled_slots >= match.total_slots ? 'full' : 'open');
  const isFull = state === 'full';
  const slotsLeft = invite ? invite.remaining_spots : Math.max(0, match.total_slots - match.filled_slots);
  const confirmed = invite ? invite.confirmed_participants : match.filled_slots;
  const share = invite ? invite.share_amount : Number(match.contribution_amount || 0);
  const canJoin = invite ? invite.can_join : !isFull;
  const myPending = invite?.my_status && invite.my_status.payment_status === 'pending';
  const joinLabel = invite?.my_status?.payment_status === 'paid' ? "You're in this match"
    : invite?.is_host ? 'You are the host'
    : state === 'full' ? 'All spots are filled'
    : state === 'cancelled' ? 'Booking cancelled'
    : state === 'completed' ? 'Session ended'
    : state === 'expired' ? 'Match already started'
    : slotsLeft <= 0 ? 'Last spot is being held — try again shortly'
    : `Join & Pay My Share${share ? ` · ₹${share}` : ''}`;

  return (
    <div className="page-wrapper">
      <Navbar />

      <div className="container" style={{ paddingTop: 120, paddingBottom: 80, maxWidth: 900 }}>
        <div className="card" style={{ padding: '1.25rem', borderRadius: 16 }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ fontSize: 28 }}>{sport.emoji}</div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontWeight: 900, fontSize: '1.25rem', overflowWrap: 'anywhere' }}>
                {match.turf_name}
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                {match.turf_address}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 900, color: isFull ? '#f87171' : 'var(--emerald-400)' }}>
                {confirmed}/{match.total_slots}
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                {slotsLeft} {slotsLeft === 1 ? 'spot' : 'spots'} left
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16 }}>
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 12 }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Date</div>
              <div style={{ fontWeight: 800 }}>{formatDate(match.match_date)}</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 12 }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Time</div>
              <div style={{ fontWeight: 800 }}>{String(match.booking_time_slot || '').trim() || String(match.match_time || '').substring(0, 5)}</div>
            </div>
          </div>

          <div style={{ marginTop: 16, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <div className="filter-pill active" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              ₹{share} per player
            </div>
            {invite && (
              <div className="filter-pill" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                Booking total ₹{invite.total_amount}
              </div>
            )}
            {match.host_name && (
              <div className="filter-pill" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                Host: {match.host_name}
              </div>
            )}
            <div className="filter-pill" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              {String(match.match_type || 'friendly').toUpperCase()}
            </div>
            <div className="filter-pill" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              Collected: ₹{Math.round(contributionTotal)}
            </div>
          </div>

          {invite && state !== 'open' && (
            <div style={{ marginTop: 14, padding: '10px 12px', borderRadius: 12, background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.3)', color: '#fca5a5', fontSize: '0.9rem' }}>
              {invite.message}
            </div>
          )}
          {myPending && (
            <div style={{ marginTop: 14, padding: '10px 12px', borderRadius: 12, background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.3)', color: '#fbbf24', fontSize: '0.9rem' }}>
              Your payment is still pending — you are added only once it is confirmed. You can pay again below.
            </div>
          )}

          <div style={{ marginTop: 16 }}>
            <button
              className="btn btn-primary"
              style={{ width: '100%' }}
              disabled={!canJoin}
              onClick={() => setShowJoin(true)}
            >
              {joinLabel}
            </button>
          </div>

          {players.length > 0 && (
            <div style={{ marginTop: 18 }}>
              <div style={{ fontWeight: 800, marginBottom: 10 }}>Players joined</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
                {players.map(p => (
                  <div key={p.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 10 }}>
                    <div style={{ fontWeight: 700, overflowWrap: 'anywhere' }}>{p.user_name}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{p.role || 'Player'}</div>
                    <div style={{ color: p.payment_status === 'paid' ? 'var(--emerald-400)' : 'var(--gold-500)', fontSize: '0.8rem', marginTop: 4 }}>
                      {p.payment_status === 'paid' ? 'Paid' : 'Pending payment'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {showJoin && (
        <MatchJoinFlow
          match={match}
          invite={invite}
          onClose={() => setShowJoin(false)}
          onSuccess={() => {
            setShowJoin(false);
            load();
          }}
        />
      )}

      <Footer />
    </div>
  );
}
