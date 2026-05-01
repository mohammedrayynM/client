'use client';

/**
 * BookArena Location Detection Utility
 * Handles geolocation, reverse geocoding, permission management, and distance calculations
 */

const LOCATION_CACHE_KEY = 'bookarena_user_location';
const LOCATION_CACHE_EXPIRY = 30 * 60 * 1000; // 30 minutes

/**
 * Get user's current position via browser Geolocation API
 * Returns: { latitude, longitude, accuracy }
 */
export function getCurrentPosition(options = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      },
      (error) => {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            reject(new Error('PERMISSION_DENIED'));
            break;
          case error.POSITION_UNAVAILABLE:
            reject(new Error('POSITION_UNAVAILABLE'));
            break;
          case error.TIMEOUT:
            reject(new Error('TIMEOUT'));
            break;
          default:
            reject(new Error('UNKNOWN_ERROR'));
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000, // 5 min cache
        ...options,
      }
    );
  });
}

/**
 * Check geolocation permission status without prompting
 */
export async function checkLocationPermission() {
  if (!navigator.permissions) return 'unknown';
  try {
    const result = await navigator.permissions.query({ name: 'geolocation' });
    return result.state; // 'granted', 'denied', 'prompt'
  } catch {
    return 'unknown';
  }
}

/**
 * Reverse geocode coordinates to city/area using free Nominatim API
 */
export async function reverseGeocode(latitude, longitude) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1&zoom=14`,
      { headers: { 'Accept-Language': 'en' } }
    );
    if (!res.ok) throw new Error('Geocoding failed');
    const data = await res.json();
    const addr = data.address || {};
    
    const area = addr.suburb || addr.neighbourhood || addr.hamlet || addr.village || addr.town || '';
    const city = addr.city || addr.state_district || addr.county || addr.state || '';
    const state = addr.state || '';
    const displayName = [area, city].filter(Boolean).join(', ');

    return {
      area,
      city,
      state,
      displayName: displayName || data.display_name?.split(',').slice(0, 2).join(',') || 'Your Location',
      fullAddress: data.display_name || '',
    };
  } catch (err) {
    console.warn('Reverse geocoding failed:', err);
    return {
      area: '',
      city: '',
      state: '',
      displayName: 'Your Location',
      fullAddress: '',
    };
  }
}

/**
 * Get full user location with caching (coordinates + city/area)
 */
export async function getUserLocation(forceRefresh = false) {
  // Check cache first
  if (!forceRefresh && typeof window !== 'undefined') {
    const cached = localStorage.getItem(LOCATION_CACHE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.timestamp < LOCATION_CACHE_EXPIRY) {
          return parsed;
        }
      } catch {}
    }
  }

  const coords = await getCurrentPosition();
  const geo = await reverseGeocode(coords.latitude, coords.longitude);

  const locationData = {
    latitude: coords.latitude,
    longitude: coords.longitude,
    accuracy: coords.accuracy,
    ...geo,
    timestamp: Date.now(),
  };

  // Cache the result
  if (typeof window !== 'undefined') {
    localStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify(locationData));
  }

  return locationData;
}

/**
 * Clear cached location
 */
export function clearLocationCache() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(LOCATION_CACHE_KEY);
  }
}

/**
 * Calculate distance between two points using Haversine formula
 * Returns distance in km
 */
export function calculateDistance(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg) {
  return deg * (Math.PI / 180);
}

/**
 * Format distance for display
 */
export function formatDistance(km) {
  if (km === null || km === undefined) return '';
  if (km < 1) return `${Math.round(km * 1000)}m away`;
  if (km < 10) return `${km.toFixed(1)} km away`;
  return `${Math.round(km)} km away`;
}

/**
 * Get Google Maps directions URL
 */
export function getDirectionsUrl(destLat, destLng, destName = '') {
  const destination = destName 
    ? encodeURIComponent(destName) 
    : `${destLat},${destLng}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`;
}

/**
 * Get Google Maps static map URL for a location
 */
export function getStaticMapUrl(lat, lng, zoom = 15, width = 400, height = 200) {
  return `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=${zoom}&size=${width}x${height}&markers=color:green%7C${lat},${lng}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`;
}
