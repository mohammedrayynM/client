'use client';

import Link from 'next/link';
import { getSportInfo, formatPrice, DEFAULT_TURF_IMAGES } from '@/lib/constants';

export default function TurfCard({ turf }) {
  const sport = getSportInfo(turf.sport_type);
  const image = turf.images && turf.images.length > 0
    ? turf.images[0]
    : DEFAULT_TURF_IMAGES[turf.id % DEFAULT_TURF_IMAGES.length];

  return (
    <Link href={`/turfs/${turf.id}`} className="card" id={`turf-card-${turf.id}`}>
      <div className="card-image" style={{ position: 'relative' }}>
        <img src={image} alt={turf.name} loading="lazy" />
        <div className="card-badge badge-sport">
          {sport.emoji} {sport.label}
        </div>
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
          <span style={{ textDecoration: 'line-through', color: 'var(--text-secondary)', fontSize: '0.95rem', fontWeight: 500 }}>{formatPrice(parseFloat(turf.price_per_hour || 0) + 200)}</span>
          <span className="amount">{formatPrice(turf.price_per_hour)}</span>
          <span className="period">/ hour</span>
        </div>
      </div>
      <div className="card-footer">
        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          ⭐ 4.{5 + (turf.id % 5)} rating
        </span>
        <span className="btn btn-primary btn-sm">Book Now →</span>
      </div>
    </Link>
  );
}
