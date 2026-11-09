import { useState, useEffect } from 'react';
import { formatPrice, formatDate, getSportInfo } from '@/lib/constants';
import { Link } from 'react-router-dom';

export default function MatchRequestCard({ request, onJoin, isJoinedByMe }) {
  const [timeLeft, setTimeLeft] = useState('');
  const sport = getSportInfo(request.sport_type);
  
  // Urgent if within 2 hours
  const matchDateStr = request.match_date ? String(request.match_date).split('T')[0] : '';
  const matchTimeStr = request.match_time ? String(request.match_time) : '';
  const isUrgent = (matchDateStr && matchTimeStr)
    ? (new Date(`${matchDateStr}T${matchTimeStr}`) - new Date() < 2 * 60 * 60 * 1000)
    : false;
  const isFull = request.status === 'full' || Number(request.filled_slots || 0) >= Number(request.total_slots || 0);

  useEffect(() => {
    const timer = setInterval(() => {
      const matchDateStr = request.match_date ? String(request.match_date).split('T')[0] : '';
      const matchTimeStr = request.match_time ? String(request.match_time) : '';
      const matchTime = new Date(`${matchDateStr}T${matchTimeStr}`);
      const now = new Date();
      const diff = matchTime - now;
      
      if (isNaN(diff) || diff <= 0) {
        setTimeLeft(isNaN(diff) ? 'Unknown' : 'Started');
        clearInterval(timer);
      } else {
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        setTimeLeft(`${h}h ${m}m`);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [request.match_date, request.match_time]);

  let roles = [];
  try {
    const parsed = JSON.parse(request.roles_needed || '[]');
    roles = Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    roles = [];
  }
  const hasContribution = Number(request.contribution_amount || 0) > 0;

  let turfImages = request.turf_images;
  if (typeof turfImages === 'string') {
    try {
      turfImages = JSON.parse(turfImages);
    } catch (e) {
      turfImages = null;
    }
  }
  const displayImage = Array.isArray(turfImages) && turfImages.length > 0 ? turfImages[0] : '/images/default-turf.jpg';

  return (
    <div className={`match-card ${isUrgent ? 'urgent' : ''} ${isFull ? 'full' : ''} ${isJoinedByMe ? 'joined' : ''}`}>
      {isUrgent && <div className="urgent-badge-pulsing">🔥 URGENT</div>}
      {isJoinedByMe && <div className="joined-badge">✅ YOU'RE IN</div>}
      
      <div className="match-card-header">
        <img src={displayImage} alt={request.turf_name} className="venue-img" loading="lazy" decoding="async" />
        <div className="host-overlay">
          <div className="host-avatar">
            <div className="avatar-initials">{request.host_name?.[0]}</div>
          </div>
          <div className="host-info">
            <span className="host-name">{request.host_name}</span>
            <span className="host-karma">⭐ {request.host_karma} Karma</span>
          </div>
        </div>
      </div>

      <div className="match-card-body">
        <div className="match-meta" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
          <span className="sport-tag">{sport.emoji} {sport.label}</span>
          <span className="type-tag">{request.match_type}</span>
          <span className="distance-tag">📍 {request.distance?.toFixed(1)} km</span>
        </div>

        <h3 className="match-venue-name">{request.turf_name}</h3>
        <p className="match-time-info" style={{ fontSize: '0.85rem', lineHeight: '1.4' }}>
          📅 {request.match_date ? new Date(request.match_date).toLocaleDateString() : '—'} • 🕒 {matchTimeStr ? matchTimeStr.substring(0, 5) : '—'}
          <span className="countdown"> ({timeLeft})</span>
        </p>

        <div className="player-progress">
          <div className="progress-header">
            <span>{request.filled_slots} / {request.total_slots} Players</span>
            <span className="slots-left">⚡ {request.total_slots - request.filled_slots} Slots Left</span>
          </div>
          <div className="progress-bar-bg">
            <div className="progress-bar-fill" style={{ width: `${(request.filled_slots / request.total_slots) * 100}%` }}></div>
          </div>
        </div>

        <div className="roles-scroll">
          {roles.map((role, i) => (
            <span key={i} className="role-chip">{role}</span>
          ))}
        </div>

        <div className="price-info">
          {hasContribution ? (
            <span>₹{request.contribution_amount} per player</span>
          ) : (
            <>
              <span>₹{request.advance_amount} Advance</span>
              <span className="sep">·</span>
              <span>₹{request.split_amount} Split</span>
            </>
          )}
        </div>

        {!isFull && !isJoinedByMe ? (
          <button className="btn-join-pulse" onClick={() => onJoin(request)}>
            {hasContribution ? 'JOIN & PAY' : 'JOIN MATCH'}
          </button>
        ) : (
          <button className="btn-disabled" disabled>
            {isFull ? 'MATCH FULL' : 'ALREADY JOINED'}
          </button>
        )}
        
        <Link
          to={request.share_token ? `/match-request/${request.share_token}` : `/match/${request.id}`}
          className="view-details-link"
        >
          View Full Details →
        </Link>
      </div>
    </div>
  );
}
