'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import TurfCard from '@/components/TurfCard';
import { apiGet } from '@/lib/api';
import { SPORTS } from '@/lib/constants';

export default function TurfsPage() {
  const searchParams = useSearchParams();
  const [turfs, setTurfs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSport, setActiveSport] = useState(searchParams.get('sport') || 'all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadTurfs();
  }, [activeSport]);

  async function loadTurfs() {
    setLoading(true);
    try {
      const params = activeSport !== 'all' ? `?sport=${activeSport}` : '';
      const data = await apiGet(`/turfs${params}`);
      setTurfs(data.turfs || []);
    } catch (err) {
      console.error(err);
      setTurfs([]);
    } finally {
      setLoading(false);
    }
  }

  const filteredTurfs = searchQuery
    ? turfs.filter(t =>
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.location.toLowerCase().includes(searchQuery.toLowerCase())
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

          {/* Search Bar */}
          <div className="search-bar" id="turf-search">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search by name or location..."
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
            </select>
          </div>

          {/* Results */}
          {loading ? (
            <div className="flex-center" style={{ padding: '4rem' }}>
              <div className="loading-spinner" />
            </div>
          ) : filteredTurfs.length > 0 ? (
            <>
              <p style={{
                color: 'var(--text-muted)',
                marginBottom: '1.5rem',
                fontSize: '0.9rem'
              }}>
                Showing {filteredTurfs.length} turf{filteredTurfs.length !== 1 ? 's' : ''}
                {activeSport !== 'all' ? ` for ${SPORTS[activeSport]?.label || activeSport}` : ''}
              </p>
              <div className="turf-grid">
                {filteredTurfs.map(turf => (
                  <TurfCard key={turf.id} turf={turf} />
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
