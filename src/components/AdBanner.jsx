import React, { useState, useEffect } from 'react';
import { apiGet, apiPost } from '@/lib/api';

/**
 * Reusable Ad Banner Component
 * Fetches active ads for placement (e.g. 'HOME_BANNER', 'TOURNAMENT_AD')
 * and displays them responsively without breaking the UI.
 */
export default function AdBanner({ placement = 'HOME_BANNER', className = '' }) {
  const [ads, setAds] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    let isMounted = true;
    apiGet(`/ads?placement=${placement}`)
      .then((data) => {
        if (!isMounted) return;
        if (data?.success && Array.isArray(data.ads)) {
          setAds(data.ads);
        }
      })
      .catch((err) => {
        console.warn(`AdBanner fetch error (${placement}):`, err.message);
      });

    return () => {
      isMounted = false;
    };
  }, [placement]);

  useEffect(() => {
    if (ads.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % ads.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [ads.length]);

  if (!ads.length) return null;

  const currentAd = ads[currentIndex];

  const handleAdClick = () => {
    if (currentAd?.id) {
      apiPost(`/ads/${currentAd.id}/click`, {}).catch(() => {});
    }
    if (currentAd?.link_url) {
      window.open(currentAd.link_url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className={`ad-banner-wrapper ${className}`} style={{ margin: '1.5rem 0', width: '100%' }}>
      <div
        onClick={handleAdClick}
        style={{
          position: 'relative',
          width: '100%',
          maxHeight: '280px',
          borderRadius: '16px',
          overflow: 'hidden',
          cursor: currentAd.link_url ? 'pointer' : 'default',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          boxShadow: '0 8px 30px rgba(0,0,0,0.4)',
          backgroundColor: '#0f172a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <img
          src={currentAd.image_url}
          alt={currentAd.title}
          style={{
            width: '100%',
            height: '100%',
            maxHeight: '280px',
            objectFit: 'cover',
            display: 'block'
          }}
        />

        {/* Sponsor / Title Overlay */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: '1rem 1.5rem',
            background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0) 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem'
          }}
        >
          <div>
            {currentAd.sponsor_name && (
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  color: '#f59e0b',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  display: 'block'
                }}
              >
                Sponsored by {currentAd.sponsor_name}
              </span>
            )}
            <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#ffffff' }}>
              {currentAd.title}
            </h4>
          </div>

          {currentAd.link_url && (
            <span
              style={{
                backgroundColor: '#ef4444',
                color: '#fff',
                fontSize: '0.8rem',
                fontWeight: 700,
                padding: '6px 16px',
                borderRadius: '999px',
                whiteSpace: 'nowrap'
              }}
            >
              Learn More →
            </span>
          )}
        </div>

        {/* Carousel Indicators if multiple ads */}
        {ads.length > 1 && (
          <div
            style={{
              position: 'absolute',
              top: '12px',
              right: '12px',
              display: 'flex',
              gap: '6px',
              background: 'rgba(0,0,0,0.5)',
              padding: '4px 8px',
              borderRadius: '999px'
            }}
          >
            {ads.map((_, i) => (
              <div
                key={i}
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentIndex(i);
                }}
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: i === currentIndex ? '#ef4444' : 'rgba(255,255,255,0.4)',
                  cursor: 'pointer'
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
