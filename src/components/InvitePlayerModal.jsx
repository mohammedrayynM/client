import { useEffect, useState } from 'react';
import { apiGet, apiPost } from '@/lib/api';

export default function InvitePlayerModal({ isOpen, onClose, availability, onInviteSuccess }) {
  const [matches, setMatches] = useState([]);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    async function load() {
      try {
        const userData = JSON.parse(localStorage.getItem('userData') || '{}');
        if (!userData || !userData.id) return;
        const data = await apiGet(`/match-requests/host/${userData.id}`);
        setMatches(data.requests || []);
      } catch (err) {
        console.error(err);
      }
    }
    load();
  }, [isOpen]);

  const handleInvite = async (e) => {
    if (e) e.preventDefault();
    if (!selectedMatch) return alert('Select a match to invite the player to.');
    setLoading(true);
    try {
      const userData = JSON.parse(localStorage.getItem('userData') || '{}');
      const payload = {
        match_id: selectedMatch,
        availability_id: availability.id,
        host_id: userData.id
      };
      const res = await apiPost('/player-availability/invite', payload);
      alert('Invite sent');
      onInviteSuccess && onInviteSuccess(res.invite_id);
      onClose();
    } catch (err) {
      console.error(err);
      alert('Failed to send invite');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
      <div style={{ width: 520, background: 'var(--bg-primary)', borderRadius: 12, padding: 20, border: '1px solid var(--border-subtle)' }}>
        <button onClick={onClose} style={{ position: 'absolute', right: 20, top: 18, background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 22 }}>×</button>
        <h3 style={{ marginTop: 0 }}>Invite {availability.user_name}</h3>
        <p style={{ color: 'var(--text-muted)' }}>{availability.role} · {availability.skill_level} · {availability.preferred_location || availability.turf_name}</p>

        <div style={{ marginTop: 12 }}>
          <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Select Match</label>
          {matches.length === 0 ? (
            <div style={{ color: 'var(--text-muted)' }}>You have no active matches. Create a match first to invite players.</div>
          ) : (
            <select value={selectedMatch || ''} onChange={e => setSelectedMatch(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}>
              <option value="">-- Select --</option>
              {matches.map(m => (
                <option key={m.id} value={m.id}>{m.sport_type} • {m.match_date} {m.match_time} • {m.turf_name || 'Venue'}</option>
              ))}
            </select>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={handleInvite} disabled={loading || matches.length === 0}>{loading ? 'Sending...' : 'Send Invite'}</button>
        </div>
      </div>
    </div>
  );
}
