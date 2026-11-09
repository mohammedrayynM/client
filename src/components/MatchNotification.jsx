import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE } from '@/lib/api';

function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = (v) => (Number(v) * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function isFutureMatch(match) {
  try {
    const date = String(match?.match_date || '').slice(0, 10);
    const time = String(match?.match_time || '00:00:00').slice(0, 8);
    if (!date) return true;
    const dt = new Date(`${date}T${time}`);
    if (Number.isNaN(dt.getTime())) return true;
    return dt.getTime() >= Date.now();
  } catch {
    return true;
  }
}

export default function MatchNotification() {
  const [notification, setNotification] = useState(null);
  const [progress, setProgress] = useState(100);
  const navigate = useNavigate();
  const [myLocation, setMyLocation] = useState(null); // { lat, lng }

  useEffect(() => {
    // Best-effort user location for "nearby" filtering.
    if (!navigator?.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setMyLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setMyLocation(null),
      { maximumAge: 5 * 60 * 1000, timeout: 6000 }
    );
  }, []);

  useEffect(() => {
    let es;
    try {
      es = new EventSource(`${API_BASE}/match-requests/events`);
    } catch {
      return;
    }

    const onCreated = (e) => {
      try {
        const payload = JSON.parse(e.data || '{}');
        const match = payload.match;
        if (!match?.id) return;
        if (!isFutureMatch(match)) return;

        const me = JSON.parse(localStorage.getItem('userData') || '{}');
        if (me?.id && Number(me.id) === Number(match.host_id)) return; // don't notify the host themselves

        // Nearby filtering (best-effort):
        // If we know the user's location + match coords, only show within 25km.
        if (myLocation && match?.latitude != null && match?.longitude != null) {
          const d = haversineKm(
            Number(myLocation.lat),
            Number(myLocation.lng),
            Number(match.latitude),
            Number(match.longitude)
          );
          const radiusKm = 25;
          if (Number.isFinite(d) && d > radiusKm) return;
        }

        const slotsLeft = Math.max(0, Number(match.total_slots || 0) - Number(match.filled_slots || 0));
        setProgress(100);
        setNotification({
          id: match.id,
          share_token: match.share_token,
          turf_name: match.turf_name,
          sport_type: match.sport_type,
          match_date: match.match_date,
          match_time: match.match_time,
          booking_time_slot: match.booking_time_slot,
          slots_left: slotsLeft,
          price_per_player: Number(match.contribution_amount || 0),
        });
      } catch {
        // ignore
      }
    };

    const onInvited = (e) => {
      try {
        const payload = JSON.parse(e.data || '{}');
        const me = JSON.parse(localStorage.getItem('userData') || '{}');
        if (!me?.id || Number(me.id) !== Number(payload.player_user_id)) return; // Only show to the invited player!
        
        setProgress(100);
        setNotification({
          isInvite: true,
          id: payload.match_id,
          share_token: payload.share_token,
          turf_name: payload.turf_name,
          sport_type: payload.sport_type,
          match_date: payload.match_date,
          match_time: payload.match_time,
          booking_time_slot: payload.booking_time_slot,
          host_name: payload.host_name
        });
      } catch {
        // ignore
      }
    };

    es.addEventListener('match_request_created', onCreated);
    es.addEventListener('player_invited', onInvited);
    es.onerror = () => {
      // EventSource auto-reconnects; keep it silent unless debugging.
    };

    return () => {
      try {
        es.removeEventListener('match_request_created', onCreated);
        es.removeEventListener('player_invited', onInvited);
        es.close();
      } catch {}
    };
  }, [myLocation]);

  useEffect(() => {
    if (!notification) return;

    const duration = 8000; // 8 seconds
    const interval = 10;
    const step = (interval / duration) * 100;

    const progressTimer = setInterval(() => {
      setProgress(prev => {
        if (prev <= 0) {
          setNotification(null);
          return 0;
        }
        return prev - step;
      });
    }, interval);

    return () => clearInterval(progressTimer);
  }, [notification]);

  if (!notification) return null;

  return (
    <div className="match-popup">
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '1.2rem' }}>{notification.isInvite ? '✉️' : '🔥'}</span>
          <span style={{ fontWeight: 800, fontSize: '0.8rem', letterSpacing: '1px', color: 'var(--emerald-400)' }}>
            {notification.isInvite ? 'YOU ARE INVITED!' : 'PLAYERS NEEDED NEAR YOU'}
          </span>
        </div>
        <button onClick={() => setNotification(null)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '1.2rem' }}>×</button>
      </div>

      <div style={{ marginBottom: '1.25rem' }}>
        {notification.isInvite ? (
          <div style={{ fontWeight: 800, fontSize: '1.05rem', marginBottom: '6px' }}>
            {notification.host_name} invited you to play {String(notification.sport_type || '').toUpperCase()} at {notification.turf_name}
          </div>
        ) : (
          <div style={{ fontWeight: 800, fontSize: '1.05rem', marginBottom: '6px' }}>
            {String(notification.sport_type || '').toUpperCase()} · {notification.turf_name}
          </div>
        )}
        <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.4 }}>
          📅 {String(notification.match_date).slice(0, 10)} • 🕒 {String(notification.booking_time_slot || '').trim() || String(notification.match_time || '').slice(0, 5)}
        </div>
        {!notification.isInvite && (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: 6 }}>
            👥 {notification.slots_left} player{notification.slots_left === 1 ? '' : 's'} needed • ₹{notification.price_per_player} per player
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '10px' }}>
        <button 
          className="btn btn-primary" 
          style={{ flex: 1, padding: '10px', fontSize: '0.85rem' }}
          onClick={() => {
            if (notification.share_token) navigate(`/match-request/${notification.share_token}`);
            else navigate('/find-players');
            setNotification(null);
          }}
        >
          {notification.isInvite ? 'VIEW & JOIN' : 'JOIN'}
        </button>
        <button className="btn btn-secondary" style={{ flex: 0.5, padding: '10px', fontSize: '0.85rem' }} onClick={() => setNotification(null)}>
          Dismiss
        </button>
      </div>

      {/* Progress Bar */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, height: '4px', background: 'var(--emerald-500)', width: `${progress}%`, transition: 'width 0.01s linear', borderBottomLeftRadius: '20px' }}></div>
    </div>
  );
}
