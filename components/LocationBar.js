'use client';

import { useState, useEffect, useCallback } from 'react';
import { getUserLocation, checkLocationPermission, clearLocationCache } from '@/lib/location';

/**
 * LocationBar — Shows detected location with permission handling & fallback
 * Emits onLocationDetected(locationData) when location is available
 */
export default function LocationBar({ onLocationDetected, compact = false }) {
  const [status, setStatus] = useState('idle'); // idle | detecting | detected | denied | error
  const [location, setLocation] = useState(null);
  const [permState, setPermState] = useState('unknown');

  // Check permission on mount
  useEffect(() => {
    checkLocationPermission().then(state => {
      setPermState(state);
      // Auto-detect if already granted
      if (state === 'granted') {
        detectLocation();
      }
    });

    // Check for cached location
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('bookarena_user_location');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Date.now() - parsed.timestamp < 30 * 60 * 1000) {
            setLocation(parsed);
            setStatus('detected');
            onLocationDetected?.(parsed);
          }
        } catch {}
      }
    }
  }, []);

  const detectLocation = useCallback(async () => {
    setStatus('detecting');
    try {
      const loc = await getUserLocation(true);
      setLocation(loc);
      setStatus('detected');
      onLocationDetected?.(loc);
    } catch (err) {
      if (err.message === 'PERMISSION_DENIED') {
        setStatus('denied');
        setPermState('denied');
      } else {
        setStatus('error');
      }
    }
  }, [onLocationDetected]);

  const handleRefresh = () => {
    clearLocationCache();
    detectLocation();
  };

  // Compact mode for navbar
  if (compact) {
    return (
      <div className="location-bar-compact" id="location-bar-compact">
        {status === 'detected' && location ? (
          <button className="location-detected-compact" onClick={handleRefresh} title="Refresh location">
            <span className="location-pulse-dot" />
            <span>📍 {location.area || location.city || 'Your Area'}</span>
          </button>
        ) : status === 'detecting' ? (
          <span className="location-detecting-compact">
            <div className="mini-spinner" />
            <span>Locating...</span>
          </span>
        ) : (
          <button className="location-enable-compact" onClick={detectLocation} title="Enable location">
            📍 Detect Location
          </button>
        )}
      </div>
    );
  }

  // Full location bar
  return (
    <div className={`location-bar ${status}`} id="location-bar">
      {/* Idle / Prompt state */}
      {(status === 'idle' && permState !== 'granted') && (
        <div className="location-bar-content">
          <div className="location-bar-icon">📍</div>
          <div className="location-bar-text">
            <strong>Find turfs near you</strong>
            <span>Allow location access to discover nearby sports venues</span>
          </div>
          <button className="btn btn-primary btn-sm location-bar-btn" onClick={detectLocation}>
            <span>🔍</span> Enable Location
          </button>
        </div>
      )}

      {/* Detecting */}
      {status === 'detecting' && (
        <div className="location-bar-content">
          <div className="location-bar-icon detecting">
            <div className="location-radar" />
          </div>
          <div className="location-bar-text">
            <strong>Detecting your location...</strong>
            <span>Please allow access when prompted</span>
          </div>
          <div className="loading-dots">
            <span /><span /><span />
          </div>
        </div>
      )}

      {/* Detected */}
      {status === 'detected' && location && (
        <div className="location-bar-content detected">
          <div className="location-bar-icon success">
            <span className="location-pulse-dot" />
            📍
          </div>
          <div className="location-bar-text">
            <strong>{location.displayName || 'Your Location'}</strong>
            <span>Showing turfs near you • <button className="link-btn" onClick={handleRefresh}>Refresh</button></span>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => {
            clearLocationCache();
            setStatus('idle');
            setLocation(null);
            onLocationDetected?.(null);
          }}>
            ✕ Clear
          </button>
        </div>
      )}

      {/* Permission Denied */}
      {status === 'denied' && (
        <div className="location-bar-content denied">
          <div className="location-bar-icon denied-icon">🔒</div>
          <div className="location-bar-text">
            <strong>Location access denied</strong>
            <span>Enable location in your browser settings, or search by city below</span>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => setStatus('idle')}>
            Dismiss
          </button>
        </div>
      )}

      {/* Error */}
      {status === 'error' && (
        <div className="location-bar-content error">
          <div className="location-bar-icon">⚠️</div>
          <div className="location-bar-text">
            <strong>Could not detect location</strong>
            <span>Check your connection and try again</span>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={detectLocation}>
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
