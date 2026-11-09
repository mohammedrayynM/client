import React, { useState, useEffect } from 'react';
import { apiGet } from '@/lib/api';
import MatchRequestCard from '@/components/MatchRequestCard';
import LocationBar from '@/components/LocationBar';
import MatchJoinFlow from '@/components/MatchJoinFlow';

const SPORTS = [
  'All', 'Cricket', 'Football', 'Badminton', 'Tennis', 'Basketball', 
  'Volleyball', 'Box Cricket', 'Hockey', 'Swimming', 'Other'
];

const RADII = [5, 10, 25, 50, 100];

export default function FindPlayersPage() {
  const [matches, setMatches] = useState([]);
  const [selectedSport, setSelectedSport] = useState('All');
  const [radius, setRadius] = useState(25);
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [joiningMatch, setJoiningMatch] = useState(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const fetchMatches = async (loc, sport, rad) => {
    setLoading(true);
    try {
      let url = `/match-requests/nearby?radius=${rad}`;
      if (loc) url += `&lat=${loc.lat}&lng=${loc.lng}`;
      if (sport !== 'All') url += `&sport=${sport.toLowerCase()}`;
      
      const data = await apiGet(url);
      setMatches(data.requests || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatches(location, selectedSport, radius);
  }, [location, selectedSport, radius]);

  return (
    <div className="page-container" style={{ padding: isMobile ? '10px' : '40px 20px', minHeight: '100vh', background: 'var(--bg-default)' }}>
      <div className="container" style={{ maxWidth: '1200px', margin: '0 auto' }}>
        
        <header style={{ marginBottom: '30px' }}>
          <h1 style={{ fontSize: isMobile ? '1.5rem' : '2.5rem', fontWeight: 800, marginBottom: '10px' }}>Find Players & Matches</h1>
          <p style={{ color: 'var(--text-muted)' }}>Join games happening near you or host your own.</p>
        </header>

        <LocationBar onLocationDetected={setLocation} />

        <div className="filters-bar" style={{ 
          display: 'flex', 
          flexDirection: isMobile ? 'column' : 'row', 
          gap: '20px', 
          alignItems: isMobile ? 'stretch' : 'center',
          margin: '30px 0',
          padding: '20px',
          background: 'var(--bg-surface)',
          borderRadius: '16px',
          border: '1px solid var(--border-subtle)'
        }}>
          
          <div className="sport-filter" style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '10px', textTransform: 'uppercase' }}>
              Sport Category
            </label>
            
            {isMobile ? (
              <select 
                value={selectedSport} 
                onChange={(e) => setSelectedSport(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '10px',
                  background: 'var(--bg-card)',
                  color: '#fff',
                  border: '1px solid var(--border-subtle)',
                  fontSize: '1rem'
                }}
              >
                {SPORTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {SPORTS.map(s => (
                  <button
                    key={s}
                    onClick={() => setSelectedSport(s)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '50px',
                      border: '1px solid',
                      borderColor: selectedSport === s ? 'var(--primary)' : 'var(--border-subtle)',
                      background: selectedSport === s ? 'var(--primary)' : 'transparent',
                      color: selectedSport === s ? '#fff' : 'var(--text-muted)',
                      cursor: 'pointer',
                      fontWeight: 600,
                      transition: '0.2s'
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="radius-filter" style={{ width: isMobile ? '100%' : '200px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '10px', textTransform: 'uppercase' }}>
              Search Radius
            </label>
            <select 
              value={radius} 
              onChange={(e) => setRadius(e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '10px',
                background: 'var(--bg-card)',
                color: '#fff',
                border: '1px solid var(--border-subtle)',
                fontSize: '1rem'
              }}
            >
              {RADII.map(r => <option key={r} value={r}>{r} km</option>)}
              <option value="500">All Karnataka</option>
            </select>
          </div>
        </div>

        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(350px, 1fr))', 
          gap: '20px' 
        }}>
          {matches.map(m => (
            <MatchRequestCard 
              key={m.id} 
              request={m} 
              onJoin={() => setJoiningMatch(m)}
            />
          ))}
        </div>
      </div>

      {joiningMatch && (
        <MatchJoinFlow 
          match={joiningMatch} 
          onClose={() => setJoiningMatch(null)} 
          onSuccess={() => {
            setJoiningMatch(null);
            fetchMatches(location, selectedSport, radius);
          }}
        />
      )}
    </div>
  );
}