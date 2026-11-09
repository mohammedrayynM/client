import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getSportInfo, formatPrice, DEFAULT_TURF_IMAGES } from '@/lib/constants';
import { formatDistance, getDirectionsUrl } from '@/lib/location';
import { resolveMediaUrl } from '@/lib/mediaUrl';

export default function TurfCard({ turf, userLocation = null }) {
  const sport = getSportInfo(turf.sport_type);
  const bestCoupon = turf?.bestCoupon || null;
  
  // Custom premium photo-cycling states
  const [activeIdx, setActiveIdx] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  const photosList = (turf.photos && turf.photos.length > 0)
    ? turf.photos
    : ((turf.images && turf.images.length > 0) ? turf.images : []);

  const fallbackImage = DEFAULT_TURF_IMAGES[turf.id % DEFAULT_TURF_IMAGES.length];
  const finalPhotos = photosList.length > 0 ? photosList : [fallbackImage];

  useEffect(() => {
    if (finalPhotos.length <= 1 || isHovered) return;

    const interval = setInterval(() => {
      setActiveIdx(prev => (prev + 1) % finalPhotos.length);
    }, 3000);

    return () => clearInterval(interval);
  }, [finalPhotos.length, isHovered]);

  // Distance from backend (Haversine) or computed client-side
  const distance = turf.distance != null ? turf.distance : (turf.distance_km != null ? turf.distance_km : null);
  const distanceText = distance != null ? formatDistance(distance) : '';

  const directionsUrl = (turf.latitude && turf.longitude)
    ? getDirectionsUrl(turf.latitude, turf.longitude, turf.name)
    : null;

  const offerText = (() => {
    if (!bestCoupon || !bestCoupon.discountType || !bestCoupon.discountValue) return '';
    const type = String(bestCoupon.discountType).toLowerCase();
    const rawVal = Number(bestCoupon.discountValue);
    if (!rawVal || rawVal <= 0) return '';
    const displayVal = Number.isInteger(rawVal) ? rawVal : Math.round(rawVal);
    if (type === 'flat') return `Flat ₹${displayVal} OFF`;
    if (type === 'percentage') return `${displayVal}% OFF`;
    return '';
  })();

  return (
    <div className="turf-card-wrapper" id={`turf-card-${turf.id}`}>
      <Link to={`/turfs/${turf.id}`} className="card">
        <div 
          className="card-image" 
          style={{ position: 'relative', overflow: 'hidden' }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => {
            setIsHovered(false);
            setActiveIdx(0); // Optional: reset index on mouse leave for clean hover experience
          }}
        >
          {finalPhotos.map((img, idx) => (
            <img 
              key={idx} 
              src={resolveMediaUrl(img)} 
              alt={turf.name} 
              loading="lazy" 
              onError={(e) => { e.target.onerror = null; e.target.src = '/images/default-turf.jpg'; }}
              style={{
                position: idx === 0 ? 'relative' : 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                opacity: activeIdx === idx ? 1 : 0,
                transition: 'opacity 0.8s ease-in-out',
                zIndex: activeIdx === idx ? 1 : 0
              }}
            />
          ))}

          <div className="card-badge badge-sport" style={{ zIndex: 2 }}>
            {sport.emoji} {sport.label}
          </div>
          
          {/* Distance badge */}
          {distanceText && (
            <div className="card-badge badge-distance" style={{ zIndex: 2 }}>
              🧭 {distanceText}
            </div>
          )}

          {/* Coupon offer strip */}
          {offerText && (
            <div className="turf-offer-strip" style={{ zIndex: 3 }}>
              <span style={{ opacity: 0.95 }}>📍</span>
              <span>{offerText}</span>
            </div>
          )}
        </div>
        <div className="card-body">
          <h3 className="card-title">{turf.name}</h3>
          <div className="card-location">
            <span>📍</span>
            <span>{turf.location}</span>
          </div>
          {turf.amenities && turf.amenities.length > 0 && (
            <div className="amenity-tags" style={{ marginBottom: '12px' }}>
              {turf.amenities.slice(0, 3).map((a, i) => (
                <span key={i} className="amenity-tag">{a}</span>
              ))}
              {turf.amenities.length > 3 && (
                <span className="amenity-tag">+{turf.amenities.length - 3}</span>
              )}
            </div>
          )}
          <div className="card-price" style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem' }}>
            {turf.price_per_hour != null || turf.price_from != null ? (
              <>
                <span className="amount">{formatPrice(turf.price_per_hour ?? turf.price_from, turf.currency_code)}</span>
                <span className="period">/ hour</span>
              </>
            ) : (
              <span className="period">Price on request</span>
            )}
          </div>
        </div>
        <div className="card-footer">
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            {turf.rating != null && Number.isFinite(Number(turf.rating)) && Number(turf.rating) > 0
              ? `⭐ ${Number(turf.rating).toFixed(1)}${turf.review_count ? ` (${turf.review_count})` : ''}`
              : ''}
          </span>
          <span className="btn btn-primary btn-sm">Book Now →</span>
        </div>
      </Link>
      {/* Directions button — outside the main Link to avoid nested links */}
      {directionsUrl && (
        <a
          href={directionsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="directions-btn"
          onClick={(e) => e.stopPropagation()}
          title="Get directions"
        >
          🗺️ Directions
        </a>
      )}
    </div>
  );
}
