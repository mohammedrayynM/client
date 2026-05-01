'use client';

import { useState, useEffect, Suspense, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import TurfCard from '@/components/TurfCard';
import LocationBar from '@/components/LocationBar';
import { apiGet } from '@/lib/api';
import { SPORTS } from '@/lib/constants';

export const dynamic = 'force-dynamic';

function TurfsPageContent() {
  const searchParams = useSearchParams();
  const [turfs, setTurfs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSport, setActiveSport] = useState(searchParams.get('sport') || 'all');
  const [searchQuery, setSearchQuery] = useState('');
  const [usingFallback, setUsingFallback] = useState(false);
  const [userLocation, setUserLocation] = useState(null);

  // Initial load based on URL params
  useEffect(() => {
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');
    
    if (lat && lng && !userLocation) {
      setUserLocation({ latitude: lat, longitude: lng });
    }
  }, [searchParams]);

  // Load turfs when filters or location changes
  useEffect(() => {
    loadTurfs();
  }, [activeSport, userLocation]);

  const loadTurfs = async () => {
    setLoading(true);
    setUsingFallback(false);
    try {
      let query = `?sport=${activeSport !== 'all' ? activeSport : ''}`;
      
      const lat = userLocation?.latitude || searchParams.get('lat');
      const lng = userLocation?.longitude || searchParams.get('lng');

      if (lat && lng) {
        query += `&lat=${lat}&lng=${lng}&radius=100`; // Search within 100km
      }
      
      const data = await apiGet(`/turfs${query}`);
      
      // If proximity search yielded no results, fetch all active turfs instead
      if (data.turfs && data.turfs.length === 0 && (lat || lng)) {
        console.log('No turfs nearby, showing all turfs...');
        const fallbackData = await apiGet(`/turfs?sport=${activeSport !== 'all' ? activeSport : ''}`);
        setTurfs(fallbackData.turfs || []);
        setUsingFallback(true);
      } else {
        setTurfs(data.turfs || []);
      }
    } catch (err) {
      console.error(err);
      setTurfs([]);
    } finally {
      setLoading(false);
    }
  };

  const handleLocationDetected = useCallback((location) => {
    setUserLocation(location);
  }, []);

  const filteredTurfs = searchQuery
    ? turfs.filter(t =>
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.sport_type.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : turfs;

  return (
    <div className="page-wrapper">
      <Navbar />

      <section style={{ paddingTop: '120px', minHeight: '100vh' }}>
        <div className="container">
          {/* Header */}
          <div className="section-header">
            <div className="section-tag">🏟️ Browse</div>
            <h1 className="section-title">Find Your Perfect Turf</h1>
            <p className="section-subtitle">
              Explore the best sports venues near you
            </p>
          </div>

          <LocationBar onLocationDetected={handleLocationDetected} />

          {/* Search Bar */}
          <div className="search-bar" id="turf-search" style={{ marginTop: '2rem' }}>
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search by name, location, or sport..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Sport Filter Dropdown */}
          <div className="form-group" style={{ maxWidth: '500px', margin: '0 auto 2rem' }}>
            <select
              className="form-input"
              value={activeSport}
              onChange={(e) => setActiveSport(e.target.value)}
              style={{ fontSize: '1.1rem', padding: '16px 24px', fontWeight: 600, color: 'var(--text-primary)', background: 'var(--bg-card)' }}
            >
              <option value="all">🏟️ All Sports</option>
              {Object.entries(SPORTS).slice(0, 8).map(([key, sport]) => (
                <option key={key} value={key}>
                  {sport.emoji} {sport.label}
                </option>
              ))}
              {activeSport !== 'all' && !SPORTS[activeSport] && (
                <option value={activeSport}>🏟️ {activeSport.charAt(0).toUpperCase() + activeSport.slice(1)}</option>
              )}
            </select>
          </div>

          {/* Results */}
          {loading ? (
            <div className="flex-center" style={{ padding: '4rem' }}>
              <div className="loading-spinner" />
            </div>
          ) : filteredTurfs.length > 0 ? (
            <>
              {usingFallback && (
                <div style={{
                  background: 'rgba(245, 158, 11, 0.1)',
                  border: '1px solid var(--gold-500)',
                  padding: '1rem',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: '2rem',
                  color: 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}>
                  <span>⚠️</span>
                  <span>No turfs found near your current location. Showing all available turfs instead.</span>
                </div>
              )}
              
              <p style={{
                color: 'var(--text-muted)',
                marginBottom: '1.5rem',
                fontSize: '0.9rem'
              }}>
                Showing {filteredTurfs.length} turf{filteredTurfs.length !== 1 ? 's' : ''}
                {activeSport !== 'all' ? ` for ${SPORTS[activeSport]?.label || activeSport}` : ''}
                {!usingFallback && userLocation ? ' near you' : ''}
              </p>
              
              <div className="turf-grid">
                {filteredTurfs.map(turf => (
                  <TurfCard key={turf.id} turf={turf} userLocation={userLocation} />
                ))}
              </div>
            </>
          ) : (
            <div className="empty-state">
              <div className="empty-icon">🔍</div>
              <h3>No Turfs Found</h3>
              <p>Try a different sport or search term</p>
            </div>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}

function getDemoTurfs() {
  return [
    { id: 1, name: 'Green Field Arena', location: 'Anna Nagar, Chennai', sport_type: 'cricket', price_per_hour: 1200, images: ['https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=800&q=80'], amenities: ['Floodlights', 'Parking', 'Changing Room'] },
    { id: 2, name: 'Thunder Football Ground', location: 'Velachery, Chennai', sport_type: 'football', price_per_hour: 1500, images: ['https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&q=80'], amenities: ['Floodlights', 'Washroom', 'Cafeteria'] },
    { id: 3, name: 'Smash Zone Courts', location: 'T Nagar, Chennai', sport_type: 'badminton', price_per_hour: 800, images: ['https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=800&q=80'], amenities: ['Air Conditioning', 'Parking'] },
    { id: 4, name: 'Elite Cricket Hub', location: 'Porur, Chennai', sport_type: 'box cricket', price_per_hour: 1000, images: ['https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=800&q=80'], amenities: ['Floodlights', 'Seating Area', 'CCTV'] },
    { id: 5, name: 'Ace Tennis Academy', location: 'Adyar, Chennai', sport_type: 'tennis', price_per_hour: 900, images: ['https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=800&q=80'], amenities: ['Coaching', 'Equipment'] },
    { id: 6, name: 'Slam Dunk Arena', location: 'Nungambakkam, Chennai', sport_type: 'basketball', price_per_hour: 1100, images: ['https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800&q=80'], amenities: ['Floodlights', 'Drinking Water'] },
  ];
}

export default function TurfsPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <TurfsPageContent />
    </Suspense>
  );
}
