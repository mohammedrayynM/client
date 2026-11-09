import React, { useState, useEffect } from 'react';
import { apiGet, apiPost } from '@/lib/api';

/**
 * Public Promotional / Advertisement Modal Popup.
 * Fetches active ads for placement (e.g. 'HOME', 'TOURNAMENT_PAGE')
 * and displays an attractive popup matching reference designs.
 */
export default function AdPopupModal({ placement = 'HOME' }) {
  const [ad, setAd] = useState(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Session check to avoid annoying re-popups in the same browser session
    const closedKey = `ad_dismissed_${placement}`;
    if (sessionStorage.getItem(closedKey)) return;

    let isMounted = true;
    apiGet(`/ads?placement=${placement}`)
      .then((data) => {
        if (!isMounted) return;
        if (data?.success && Array.isArray(data.ads) && data.ads.length > 0) {
          // Select a random active ad
          const selectedAd = data.ads[Math.floor(Math.random() * data.ads.length)];
          setAd(selectedAd);
          // Show popup after a slight 1.5s delay
          setTimeout(() => {
            if (isMounted) setIsOpen(true);
          }, 1500);
        }
      })
      .catch((err) => {
        console.warn('Ad fetch skipped:', err.message);
      });

    return () => {
      isMounted = false;
    };
  }, [placement]);

  function handleClose() {
    setIsOpen(false);
    sessionStorage.setItem(`ad_dismissed_${placement}`, 'true');
  }

  function handleAdClick() {
    if (ad?.id) {
      apiPost(`/ads/${ad.id}/click`, {}).catch(() => {});
    }
    if (ad?.link_url) {
      window.open(ad.link_url, '_blank', 'noopener,noreferrer');
    }
    handleClose();
  }

  if (!isOpen || !ad) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(6px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        animation: 'fadeIn 0.3s ease-out'
      }}
      onClick={handleClose}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '440px',
          backgroundColor: '#111625',
          border: '1px solid rgba(239, 68, 68, 0.4)',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 30px rgba(239, 68, 68, 0.15)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          aria-label="Close advertisement"
          style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            color: '#fff',
            fontSize: '16px',
            fontWeight: 700,
            cursor: 'pointer',
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background-color 0.2s ease'
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#ef4444')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.6)')}
        >
          ✕
        </button>

        {/* Ad Image / Header */}
        {ad.image_url ? (
          <div style={{ width: '100%', maxHeight: '240px', overflow: 'hidden', backgroundColor: '#090d16' }}>
            <img
              src={ad.image_url}
              alt={ad.title}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          </div>
        ) : (
          <div
            style={{
              padding: '2rem 1.5rem 1rem',
              background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(17, 22, 37, 1) 100%)',
              textAlign: 'center'
            }}
          >
            <span style={{ fontSize: '3rem' }}>📢</span>
          </div>
        )}

        {/* Content */}
        <div style={{ padding: '1.5rem', textAlign: 'center' }}>
          {ad.sponsor_name && (
            <div
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '1px',
                color: '#f59e0b',
                marginBottom: '6px'
              }}
            >
              Sponsored by {ad.sponsor_name}
            </div>
          )}
          <h3
            style={{
              fontFamily: 'var(--font-display, sans-serif)',
              fontSize: '1.4rem',
              fontWeight: 800,
              color: '#ffffff',
              marginBottom: '8px',
              lineHeight: 1.3
            }}
          >
            {ad.title}
          </h3>

          <div style={{ marginTop: '1.5rem' }}>
            <button
              onClick={handleAdClick}
              style={{
                width: '100%',
                padding: '12px 20px',
                fontSize: '1rem',
                fontWeight: 700,
                borderRadius: '10px',
                border: 'none',
                backgroundColor: '#ef4444',
                color: '#ffffff',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(239, 68, 68, 0.4)',
                transition: 'transform 0.15s ease, background-color 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#dc2626';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#ef4444';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              {ad.link_url ? 'Explore Offer 🚀' : 'Got It 👍'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
