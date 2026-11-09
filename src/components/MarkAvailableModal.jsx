import { useState, useEffect } from 'react';
import { apiPost } from '@/lib/api';
import { SPORTS } from '@/lib/constants';

export default function MarkAvailableModal({ isOpen, onClose, onSuccess, prefilledData }) {
  const [formData, setFormData] = useState({
    sport_type: prefilledData?.sport_type || 'cricket',
    turf_id: prefilledData?.turf_id || '',
    preferred_location: prefilledData?.preferred_location || '',
    availability_date: prefilledData?.availability_date || new Date().toISOString().split('T')[0],
    availability_start: prefilledData?.availability_start || '18:00',
    availability_end: prefilledData?.availability_end || '20:00',
    role: prefilledData?.role || '',
    skill_level: 'all'
  });

  const [loading, setLoading] = useState(false);
  const sportsList = Object.values(SPORTS);

  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const userData = JSON.parse(localStorage.getItem('userData') || '{}');
      const token = localStorage.getItem('userToken');
      if (!token || !userData?.id) {
        alert('Please login to mark yourself available.');
        window.location.href = '/login';
        return;
      }
      await apiPost('/player-availability/create', { ...formData });

      alert('✅ You\'re now available! Other players can find you.');
      setFormData({
        sport_type: 'cricket',
        turf_id: '',
        preferred_location: '',
        availability_date: new Date().toISOString().split('T')[0],
        availability_start: '18:00',
        availability_end: '20:00',
        role: '',
        skill_level: 'all'
      });
      onClose();
      onSuccess();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '1rem'
    }}>
      <div style={{
        background: 'var(--bg-primary)',
        borderRadius: '20px',
        padding: isMobile ? '1.5rem 1rem' : '2rem',
        maxWidth: '500px',
        width: '95%',
        maxHeight: '90vh',
        overflowY: 'auto',
        border: '1px solid var(--border-subtle)'
      }}>
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1.5rem',
            right: '1.5rem',
            background: 'none',
            border: 'none',
            fontSize: '1.5rem',
            color: '#fff',
            cursor: 'pointer'
          }}
        >
          ×
        </button>

        <h2 style={{ marginTop: 0, marginBottom: '0.5rem' }}>
          ✅ Mark Yourself Available
        </h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
          Let others find and invite you to join their matches
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '1.5rem' }}>
          {/* Sport */}
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Sport</label>
            <select
              name="sport_type"
              value={formData.sport_type}
              onChange={handleChange}
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)',
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
                fontSize: '1rem'
              }}
            >
              {sportsList.map(sport => (
                <option key={sport.label} value={sport.label.toLowerCase()}>
                  {sport.emoji} {sport.label}
                </option>
              ))}
            </select>
          </div>

          {/* Role */}
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Role/Position</label>
            <input
              type="text"
              name="role"
              value={formData.role}
              onChange={handleChange}
              placeholder="e.g., Batsman, Goalkeeper, etc."
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)',
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
                fontSize: '1rem'
              }}
            />
          </div>

          {/* Skill Level */}
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Skill Level</label>
            <select
              name="skill_level"
              value={formData.skill_level}
              onChange={handleChange}
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)',
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
                fontSize: '1rem'
              }}
            >
              <option value="all">All Levels</option>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>

          {/* Date */}
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Date</label>
            <input
              type="date"
              name="availability_date"
              value={formData.availability_date}
              onChange={handleChange}
              min={new Date().toISOString().split('T')[0]}
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)',
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
                fontSize: '1rem'
              }}
            />
          </div>

          {/* Time Range */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>From</label>
              <input
                type="time"
                name="availability_start"
                value={formData.availability_start}
                onChange={handleChange}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  fontSize: '1rem'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>To</label>
              <input
                type="time"
                name="availability_end"
                value={formData.availability_end}
                onChange={handleChange}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  fontSize: '1rem'
                }}
              />
            </div>
          </div>

          {/* Preferred Location */}
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Preferred Location (Optional)</label>
            <input
              type="text"
              name="preferred_location"
              value={formData.preferred_location}
              onChange={handleChange}
              placeholder="e.g., Bangalore, South Delhi"
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)',
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
                fontSize: '1rem'
              }}
            />
          </div>

          {/* Buttons */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1rem', marginTop: '2rem' }}>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              style={{ width: '100%' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%' }}
              disabled={loading}
            >
              {loading ? 'Marking...' : 'Mark Available'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
