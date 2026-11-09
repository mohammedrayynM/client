import { useEffect, useMemo, useState } from 'react';
import { apiPost } from '@/lib/api';

const SPORT_OPTIONS = [
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

function toTitleCase(s) {
  return String(s || '')
    .split(' ')
    .filter(Boolean)
    .map(w => w[0]?.toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function getDefaultRolesForSport(sportLabel) {
  const s = String(sportLabel || '').toLowerCase();
  if (s.includes('cricket')) return ['Batsman', 'Bowler', 'All-Rounder', 'Wicket Keeper'];
  if (s.includes('football')) return ['Striker', 'Midfielder', 'Defender', 'Goalkeeper'];
  if (s.includes('badminton')) return ['Singles', 'Doubles', 'Mixed Doubles'];
  if (s.includes('tennis')) return ['Singles', 'Doubles'];
  if (s.includes('basketball')) return ['Guard', 'Forward', 'Center'];
  if (s.includes('volleyball')) return ['Setter', 'Spiker', 'Libero'];
  if (s.includes('hockey')) return ['Forward', 'Midfielder', 'Defender', 'Goalkeeper'];
  if (s.includes('swimming')) return ['Freestyle', 'Backstroke', 'Breaststroke', 'Butterfly'];
  return ['Any Role'];
}

export default function BookingFindPlayersModal({
  isOpen,
  onClose,
  onCreated,
  turf,
  court,
  bookingDate,
  bookingTimeSlot,
  bookingTotalAmount
}) {
  const [step, setStep] = useState('form'); // form | success
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState(null); // { id, share_token, shareUrl }

  const defaultSport = useMemo(() => {
    const turfSport = toTitleCase(turf?.sport_type);
    if (SPORT_OPTIONS.includes(turfSport)) return turfSport;
    if (!turfSport) return 'Cricket';
    return turfSport;
  }, [turf?.sport_type]);

  const [form, setForm] = useState({
    sport: defaultSport,
    players_needed: 4,
    match_type: 'friendly',
    skill_level: 'all',
    contact_phone: '',
    contribution_amount: 200,
    note: ''
  });

  const [rolesSelected, setRolesSelected] = useState([]);
  const [customRole, setCustomRole] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setStep('form');
    setCreated(null);
    setForm(prev => ({ ...prev, sport: defaultSport }));
    setRolesSelected(getDefaultRolesForSport(defaultSport).slice(0, 2));
    setCustomRole('');
  }, [isOpen, defaultSport]);

  if (!isOpen) return null;

  const roleOptions = getDefaultRolesForSport(form.sport);

  const shareUrl = created?.shareUrl || (created?.share_token ? `https://bookarena.in/match-request/${created.share_token}` : '');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!turf?.id) return alert('Turf not found.');
    if (!bookingDate || !bookingTimeSlot) return alert('Please select a date and time slot first.');

    if (!form.contact_phone.trim()) return alert('Please add a contact number.');
    if (!form.players_needed || Number(form.players_needed) < 1) return alert('Enter players needed.');
    if (!form.contribution_amount || Number(form.contribution_amount) < 0) return alert('Enter a valid contribution amount.');

    setLoading(true);
    try {
      const payload = {
        turf_id: turf.id,
        court_id: court?.id || null,
        sport_type: form.sport,
        match_type: form.match_type,
        match_date: bookingDate,
        booking_time_slot: bookingTimeSlot,
        players_needed: Number(form.players_needed),
        roles_needed: rolesSelected,
        skill_level: form.skill_level,
        contact_phone: form.contact_phone,
        contribution_amount: Number(form.contribution_amount),
        booking_total_amount: Number(bookingTotalAmount || 0),
        note: form.note,
        latitude: turf.latitude,
        longitude: turf.longitude,
        visibility_radius: 25
      };

      const res = await apiPost('/match-requests/create-from-booking', payload);
      const next = {
        id: res.id,
        share_token: res.share_token,
        // the backend's public invite URL — this browser's own origin is localhost while developing
        shareUrl: res.invite_url || `${window.location.origin}/match-request/${res.share_token}`
      };
      setCreated(next);
      setStep('success');
      onCreated && onCreated(next);
    } catch (err) {
      alert(err.message || 'Failed to create request');
    } finally {
      setLoading(false);
    }
  }

  function toggleRole(role) {
    setRolesSelected(prev => {
      if (prev.includes(role)) return prev.filter(r => r !== role);
      return [...prev, role];
    });
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      alert('Link copied');
    } catch {
      alert('Could not copy automatically. Please copy the link manually:\n' + shareUrl);
    }
  }

  function handleWhatsAppShare() {
    const msg =
      `Need players for ${form.sport} at ${turf?.name || 'the venue'}\n` +
      `Date: ${bookingDate}\n` +
      `Time: ${bookingTimeSlot}\n` +
      `Contribution: ₹${form.contribution_amount} per player\n` +
      `Join link: ${shareUrl}`;
    const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.65)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1200,
      padding: '1rem'
    }}>
      <div className="card" style={{
        maxWidth: 640,
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto',
        padding: '1.25rem',
        position: 'relative'
      }}>
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 14,
            right: 14,
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            fontSize: 24
          }}
          aria-label="Close"
        >
          ×
        </button>

        {step === 'form' ? (
          <>
            <h3 style={{ marginTop: 0, marginBottom: 6 }}>Need Players for This Slot</h3>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: 16 }}>
              {turf?.name} • {bookingDate} • {bookingTimeSlot}
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label className="form-label">Sport</label>
                  <select
                    className="form-input"
                    value={form.sport}
                    onChange={(e) => {
                      const sport = e.target.value;
                      setForm(prev => ({ ...prev, sport }));
                      setRolesSelected(getDefaultRolesForSport(sport).slice(0, 2));
                    }}
                  >
                    {SPORT_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                <div>
                  <label className="form-label">Players still needed</label>
                  <input
                    className="form-input"
                    type="number"
                    min={1}
                    value={form.players_needed}
                    onChange={(e) => setForm(prev => ({ ...prev, players_needed: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <label className="form-label">Roles needed</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {roleOptions.map(role => (
                    <button
                      key={role}
                      type="button"
                      className={`filter-pill ${rolesSelected.includes(role) ? 'active' : ''}`}
                      onClick={() => toggleRole(role)}
                    >
                      {role}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <input
                    className="form-input"
                    placeholder="Add custom role (optional)"
                    value={customRole}
                    onChange={(e) => setCustomRole(e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ whiteSpace: 'nowrap' }}
                    onClick={() => {
                      const role = customRole.trim();
                      if (!role) return;
                      if (!rolesSelected.includes(role)) setRolesSelected(prev => [...prev, role]);
                      setCustomRole('');
                    }}
                  >
                    Add
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label className="form-label">Match type</label>
                  <select
                    className="form-input"
                    value={form.match_type}
                    onChange={(e) => setForm(prev => ({ ...prev, match_type: e.target.value }))}
                  >
                    <option value="friendly">Friendly</option>
                    <option value="competitive">Competitive</option>
                  </select>
                </div>

                <div>
                  <label className="form-label">Skill level</label>
                  <select
                    className="form-input"
                    value={form.skill_level}
                    onChange={(e) => setForm(prev => ({ ...prev, skill_level: e.target.value }))}
                  >
                    <option value="all">All levels</option>
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label className="form-label">Contact number</label>
                  <input
                    className="form-input"
                    type="tel"
                    placeholder="For coordination"
                    value={form.contact_phone}
                    onChange={(e) => setForm(prev => ({ ...prev, contact_phone: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="form-label">Contribution per player (₹)</label>
                  <input
                    className="form-input"
                    type="number"
                    min={0}
                    value={form.contribution_amount}
                    onChange={(e) => setForm(prev => ({ ...prev, contribution_amount: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <label className="form-label">Optional note</label>
                <textarea
                  className="form-input"
                  rows={3}
                  placeholder="Any details for players (optional)"
                  value={form.note}
                  onChange={(e) => setForm(prev => ({ ...prev, note: e.target.value }))}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button type="button" className="btn btn-secondary" onClick={onClose} style={{ flex: 1 }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading} style={{ flex: 1 }}>
                  {loading ? 'Creating...' : 'Create Request'}
                </button>
              </div>
            </form>
          </>
        ) : (
          <>
            <h3 style={{ marginTop: 0 }}>Request Created</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>
              Share this link so players can join and pay.
            </p>

            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)', padding: 12, borderRadius: 12, wordBreak: 'break-all' }}>
              {shareUrl}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }}>
              <button className="btn btn-secondary" type="button" onClick={handleCopy}>
                Copy Link
              </button>
              <button className="btn btn-primary" type="button" onClick={handleWhatsAppShare} style={{ background: '#25D366', borderColor: '#25D366' }}>
                Share on WhatsApp
              </button>
            </div>

            <div style={{ marginTop: 14 }}>
              <button className="btn btn-primary" onClick={onClose} style={{ width: '100%' }}>
                Done
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

