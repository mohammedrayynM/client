import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { apiPost, apiGet } from '@/lib/api';
import {
  VENUE_CATEGORIES,
  SUPPORTED_COUNTRIES,
  AMENITIES_LIST,
  formatPrice,
} from '@/lib/constants';
import TurfImageUpload from '@/components/TurfImageUpload';

export default function VenueRegistrationWizard({
  initialDraft = null,
  owner = null,
  onCancel,
  onComplete,
}) {
  const [currentStep, setCurrentStep] = useState(initialDraft?.registration_step || 1);
  const [savingDraft, setSavingDraft] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form State
  const [formData, setFormData] = useState(() => {
    const draft = initialDraft?.draft_data || initialDraft || {};
    const defaultCountry = SUPPORTED_COUNTRIES.find(c => c.code === (draft.country_code || 'IN')) || SUPPORTED_COUNTRIES[0];
    return {
      id: initialDraft?.id || null,
      name: draft.name || '',
      country_code: defaultCountry.code,
      currency_code: draft.currency_code || defaultCountry.currency,
      timezone: draft.timezone || defaultCountry.timezone,
      state: draft.state || '',
      city: draft.city || '',
      address: draft.address || '',
      latitude: draft.latitude || '',
      longitude: draft.longitude || '',
      contact_phone: draft.contact_phone || owner?.phone || '',
      contact_email: draft.contact_email || owner?.email || '',
      // Categories & Booking Model
      categories: Array.isArray(draft.categories) && draft.categories.length > 0
        ? draft.categories
        : (draft.category ? [draft.category] : ['sports_court']),
      booking_model: draft.booking_model || 'SLOT',
      enabled_capabilities: Array.isArray(draft.enabled_capabilities) && draft.enabled_capabilities.length > 0
        ? draft.enabled_capabilities
        : ['court_management', 'slot_scheduling', 'price_per_slot'],
      // Operations & Pricing
      sport_type: draft.sport_type || 'cricket',
      price_per_hour: draft.price_per_hour || '',
      slot_duration: draft.slot_duration || 60,
      open_time: draft.open_time || '06:00',
      close_time: draft.close_time || '23:00',
      is_24_hours: !!draft.is_24_hours,
      description: draft.description || '',
      amenities: Array.isArray(draft.amenities) ? draft.amenities : [],
      photos: Array.isArray(draft.photos) ? draft.photos : (Array.isArray(draft.images) ? draft.images : []),
      coverImage: draft.coverImage || draft.images?.[0] || '',
      photosCount: draft.photosCount || (draft.images?.length || 0),
    };
  });

  // Map and Address Refs
  const mapContainerRef = useRef(null);
  const leafletMapRef = useRef(null);
  const markerRef = useRef(null);
  const [showMapModal, setShowMapModal] = useState(false);
  const [mapSearchQuery, setMapSearchQuery] = useState('');
  const [mapLoading, setMapLoading] = useState(false);

  // Sync currency and timezone when country changes
  const handleCountryChange = (countryCode) => {
    const c = SUPPORTED_COUNTRIES.find(sc => sc.code === countryCode);
    if (!c) return;
    setFormData(prev => ({
      ...prev,
      country_code: c.code,
      currency_code: c.currency,
      timezone: c.timezone,
    }));
  };

  // Toggle Category selection
  const handleCategoryToggle = (catId) => {
    setFormData(prev => {
      let updatedCats = prev.categories.includes(catId)
        ? prev.categories.filter(c => c !== catId)
        : [...prev.categories, catId];

      if (updatedCats.length === 0) {
        updatedCats = [catId]; // Keep at least one
      }

      // Determine default booking model and capabilities
      const primaryCat = VENUE_CATEGORIES[updatedCats[0]] || VENUE_CATEGORIES.sports_court;
      const combinedCapabilities = new Set();
      updatedCats.forEach(catKey => {
        (VENUE_CATEGORIES[catKey]?.capabilities || []).forEach(cap => combinedCapabilities.add(cap));
      });

      return {
        ...prev,
        categories: updatedCats,
        booking_model: primaryCat.defaultBookingModel,
        enabled_capabilities: Array.from(combinedCapabilities),
      };
    });
  };

  // Toggle Amenity
  const handleAmenityToggle = (amenity) => {
    setFormData(prev => ({
      ...prev,
      amenities: prev.amenities.includes(amenity)
        ? prev.amenities.filter(a => a !== amenity)
        : [...prev.amenities, amenity],
    }));
  };

  // Leaflet Map Init
  const initMap = (lat = 12.9716, lng = 77.5946) => {
    if (!mapContainerRef.current) return;
    if (leafletMapRef.current) {
      leafletMapRef.current.remove();
      leafletMapRef.current = null;
    }

    const map = L.map(mapContainerRef.current).setView([lat, lng], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    const pinIcon = L.divIcon({
      className: 'venue-pin-marker',
      html: '<div style="width:20px;height:20px;background:#10b981;border:3px solid #fff;border-radius:50%;box-shadow:0 0 10px rgba(0,0,0,0.5);"></div>',
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });

    const marker = L.marker([lat, lng], { draggable: true, icon: pinIcon }).addTo(map);
    markerRef.current = marker;

    marker.on('dragend', () => {
      const pos = marker.getLatLng();
      reverseGeocode(pos.lat, pos.lng);
    });

    map.on('click', (e) => {
      marker.setLatLng(e.latlng);
      reverseGeocode(e.latlng.lat, e.latlng.lng);
    });

    leafletMapRef.current = map;
  };

  const reverseGeocode = async (lat, lng) => {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=jsonv2&addressdetails=1`, {
        headers: { 'Accept-Language': 'en' },
      });
      if (!res.ok) return;
      const data = await res.json();
      const addr = data.address || {};
      const detectedCity = addr.city || addr.town || addr.village || addr.state_district || '';
      const detectedState = addr.state || '';

      setFormData(prev => ({
        ...prev,
        latitude: Number(lat).toFixed(6),
        longitude: Number(lng).toFixed(6),
        address: prev.address || data.display_name || '',
        city: prev.city || detectedCity,
        state: prev.state || detectedState,
      }));
    } catch {
      // ignore geocode error
    }
  };

  const handleSearchOnMap = async () => {
    if (!mapSearchQuery.trim()) return;
    setMapLoading(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(mapSearchQuery)}&format=json&limit=1`, {
        headers: { 'Accept-Language': 'en' },
      });
      const data = await res.json();
      if (data && data.length > 0) {
        const item = data[0];
        const lat = parseFloat(item.lat);
        const lng = parseFloat(item.lon);
        if (leafletMapRef.current && markerRef.current) {
          leafletMapRef.current.setView([lat, lng], 15);
          markerRef.current.setLatLng([lat, lng]);
          reverseGeocode(lat, lng);
        }
      } else {
        alert('Location not found. Try searching with a nearby landmark or city name.');
      }
    } catch {
      alert('Map search failed. Please try again.');
    } finally {
      setMapLoading(false);
    }
  };

  useEffect(() => {
    if (showMapModal) {
      setTimeout(() => {
        const initialLat = parseFloat(formData.latitude) || 12.9716;
        const initialLng = parseFloat(formData.longitude) || 77.5946;
        initMap(initialLat, initialLng);
      }, 200);
    }
  }, [showMapModal]);

  // Save Draft Handler
  const handleSaveDraft = async () => {
    setErrorMsg('');
    setSavingDraft(true);
    try {
      const payload = {
        name: formData.name || 'Untitled Venue Draft',
        category: formData.categories[0] || 'sports_court',
        categories: formData.categories,
        booking_model: formData.booking_model,
        country_code: formData.country_code,
        currency_code: formData.currency_code,
        timezone: formData.timezone,
        state: formData.state,
        city: formData.city,
        address: formData.address,
        latitude: formData.latitude,
        longitude: formData.longitude,
        registration_step: currentStep,
        draft_data: formData,
      };

      const res = await apiPost('/owners/venues/draft', payload);
      if (res.venue?.id) {
        setFormData(prev => ({ ...prev, id: res.venue.id }));
      }
      setSuccessMsg('Draft saved successfully! You can resume setup at any time.');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to save draft. Please check your inputs.');
    } finally {
      setSavingDraft(false);
    }
  };

  // Final Submit Handler
  const handleSubmitForApproval = async (e) => {
    e?.preventDefault();
    setErrorMsg('');

    // Validation
    if (!formData.name.trim()) {
      setErrorMsg('Please enter a venue or business name in Step 1.');
      setCurrentStep(1);
      return;
    }
    if (!formData.city.trim() || !formData.address.trim()) {
      setErrorMsg('Please complete the city and address fields in Step 1.');
      setCurrentStep(1);
      return;
    }
    if (!formData.categories || formData.categories.length === 0) {
      setErrorMsg('Please select at least one venue category in Step 2.');
      setCurrentStep(2);
      return;
    }
    if (!formData.price_per_hour || Number(formData.price_per_hour) <= 0) {
      setErrorMsg('Please specify a valid base price in Step 3.');
      setCurrentStep(3);
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        draft_id: formData.id || undefined,
        name: formData.name.trim(),
        location: formData.city.trim(),
        address: formData.address.trim(),
        state: formData.state.trim(),
        country_code: formData.country_code,
        currency_code: formData.currency_code,
        timezone: formData.timezone,
        latitude: formData.latitude ? parseFloat(formData.latitude) : null,
        longitude: formData.longitude ? parseFloat(formData.longitude) : null,
        category: formData.categories[0] || 'sports_court',
        categories: formData.categories,
        booking_model: formData.booking_model || 'SLOT',
        enabled_capabilities: formData.enabled_capabilities || [],
        sport_type: formData.sport_type || 'cricket',
        price_per_hour: parseFloat(formData.price_per_hour),
        slot_duration: parseInt(formData.slot_duration, 10) || 60,
        open_time: formData.open_time || '06:00',
        close_time: formData.close_time || '23:00',
        is_24_hours: !!formData.is_24_hours,
        description: formData.description || '',
        amenities: formData.amenities || [],
        images: formData.photos && formData.photos.length > 0 ? formData.photos : (formData.coverImage ? [formData.coverImage] : []),
        photos: formData.photos || [],
        coverImage: formData.coverImage || '',
      };

      const result = await apiPost('/owners/turfs', payload);
      if (onComplete) {
        onComplete(result.turf || result);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Submission failed. Please check required fields.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="venue-wizard-container" style={{
      maxWidth: '1000px',
      margin: '0 auto',
      background: 'var(--bg-card, #131d2f)',
      border: '1px solid var(--border-default, rgba(255, 255, 255, 0.08))',
      borderRadius: '20px',
      padding: '2rem',
      boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
    }}>
      {/* Wizard Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '1.5rem', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <span style={{
            display: 'inline-block',
            padding: '0.25rem 0.75rem',
            borderRadius: '999px',
            fontSize: '0.75rem',
            fontWeight: 700,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            background: 'rgba(16, 185, 129, 0.15)',
            color: '#10b981',
            marginBottom: '0.5rem'
          }}>
            Venue Setup Wizard
          </span>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, color: '#fff' }}>
            {formData.id ? 'Continue Venue Setup' : 'Register Your Venue'}
          </h2>
          <p style={{ color: 'var(--text-muted, #94a3b8)', fontSize: '0.9rem', marginTop: '0.25rem', marginBottom: 0 }}>
            Configure your location, category-specific booking model, pricing, and submission details.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleSaveDraft}
            disabled={savingDraft || submitting}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          >
            {savingDraft ? 'Saving Draft...' : '💾 Save Draft'}
          </button>
          {onCancel && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={onCancel}
              disabled={submitting}
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Progress Stepper */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '2rem' }}>
        {[
          { step: 1, title: 'Location & Info', icon: '📍' },
          { step: 2, title: 'Category & Model', icon: '🏷️' },
          { step: 3, title: 'Operations & Media', icon: '⚙️' },
          { step: 4, title: 'Review & Submit', icon: '🚀' },
        ].map((s) => {
          const isActive = currentStep === s.step;
          const isDone = currentStep > s.step;
          return (
            <div
              key={s.step}
              onClick={() => setCurrentStep(s.step)}
              style={{
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                padding: '0.75rem 1rem',
                borderRadius: '12px',
                background: isActive
                  ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(16, 185, 129, 0.05))'
                  : isDone
                  ? 'rgba(255, 255, 255, 0.04)'
                  : 'rgba(255, 255, 255, 0.02)',
                border: isActive
                  ? '1px solid #10b981'
                  : isDone
                  ? '1px solid rgba(16, 185, 129, 0.3)'
                  : '1px solid rgba(255, 255, 255, 0.06)',
                transition: 'all 0.2s ease',
              }}
            >
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                background: isDone ? '#10b981' : isActive ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255, 255, 255, 0.08)',
                color: isDone ? '#000' : '#fff',
                fontWeight: 700,
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {isDone ? '✓' : s.step}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted, #94a3b8)', textTransform: 'uppercase' }}>Step {s.step}</div>
                <div style={{ fontSize: '0.85rem', fontWeight: isActive ? 700 : 500, color: isActive ? '#fff' : 'var(--text-secondary, #cbd5e1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {s.title}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Messages */}
      {errorMsg && (
        <div style={{
          padding: '0.9rem 1.25rem',
          borderRadius: '12px',
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          color: '#fca5a5',
          fontSize: '0.9rem',
          marginBottom: '1.5rem',
        }}>
          ⚠️ {errorMsg}
        </div>
      )}
      {successMsg && (
        <div style={{
          padding: '0.9rem 1.25rem',
          borderRadius: '12px',
          background: 'rgba(16, 185, 129, 0.1)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          color: '#6ee7b7',
          fontSize: '0.9rem',
          marginBottom: '1.5rem',
        }}>
          {successMsg}
        </div>
      )}

      {/* STEP 1: Location & Business Information */}
      {currentStep === 1 && (
        <div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.25rem', color: '#fff' }}>
            📍 Step 1: Location & Business Information
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 600, color: '#e2e8f0' }}>Venue / Business Name *</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Apex Sports Arena or Wonder Fun Park"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 600, color: '#e2e8f0' }}>Country *</label>
              <select
                className="form-input"
                value={formData.country_code}
                onChange={e => handleCountryChange(e.target.value)}
              >
                {SUPPORTED_COUNTRIES.map(c => (
                  <option key={c.code} value={c.code}>
                    {c.name} ({c.currency})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 600, color: '#e2e8f0' }}>Operating Currency</label>
              <input
                type="text"
                className="form-input"
                value={formData.currency_code}
                readOnly
                style={{ background: 'rgba(255,255,255,0.05)', cursor: 'not-allowed' }}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Auto-configured based on country</span>
            </div>

            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 600, color: '#e2e8f0' }}>Venue Timezone</label>
              <input
                type="text"
                className="form-input"
                value={formData.timezone}
                onChange={e => setFormData({ ...formData, timezone: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 600, color: '#e2e8f0' }}>State / Province *</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Karnataka / Dubai / California"
                value={formData.state}
                onChange={e => setFormData({ ...formData, state: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 600, color: '#e2e8f0' }}>City *</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Bengaluru / Dubai"
                value={formData.city}
                onChange={e => setFormData({ ...formData, city: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label className="form-label" style={{ fontWeight: 600, color: '#e2e8f0' }}>Complete Street Address *</label>
            <textarea
              className="form-input"
              rows="3"
              placeholder="e.g. Survey #42, Main Ring Road, near Tech Park..."
              value={formData.address}
              onChange={e => setFormData({ ...formData, address: e.target.value })}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 600, color: '#e2e8f0' }}>Contact Phone</label>
              <input
                type="text"
                className="form-input"
                placeholder="+91 9876543210"
                value={formData.contact_phone}
                onChange={e => setFormData({ ...formData, contact_phone: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 600, color: '#e2e8f0' }}>Contact Email</label>
              <input
                type="email"
                className="form-input"
                placeholder="contact@myvenue.com"
                value={formData.contact_email}
                onChange={e => setFormData({ ...formData, contact_email: e.target.value })}
              />
            </div>

            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowMapModal(true)}
                style={{ height: '46px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
              >
                🗺️ Pin Precise Location on Map
              </button>
            </div>
          </div>

          {formData.latitude && formData.longitude && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              padding: '0.75rem 1rem',
              borderRadius: '10px',
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.2)',
              marginBottom: '1.5rem',
              fontSize: '0.85rem',
              color: '#6ee7b7'
            }}>
              <span>📍 Coordinates Pinned:</span>
              <strong>Lat: {formData.latitude}, Lng: {formData.longitude}</strong>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2rem' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                if (!formData.name.trim()) {
                  setErrorMsg('Please enter venue name before proceeding.');
                  return;
                }
                setErrorMsg('');
                setCurrentStep(2);
              }}
              style={{ padding: '0.8rem 2rem' }}
            >
              Continue to Step 2: Categories →
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: Category & Booking Model */}
      {currentStep === 2 && (
        <div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem', color: '#fff' }}>
            🏷️ Step 2: Select Venue Categories & Capabilities
          </h3>
          <p style={{ color: 'var(--text-muted, #94a3b8)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            Select one or more categories that describe your business. Your dashboard and booking flows will be custom-tailored to these selections.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
            {Object.values(VENUE_CATEGORIES).map((cat) => {
              const isSelected = formData.categories.includes(cat.id);
              return (
                <div
                  key={cat.id}
                  onClick={() => handleCategoryToggle(cat.id)}
                  style={{
                    cursor: 'pointer',
                    borderRadius: '16px',
                    padding: '1.5rem',
                    background: isSelected
                      ? 'linear-gradient(145deg, rgba(16, 185, 129, 0.15), rgba(16, 185, 129, 0.03))'
                      : 'rgba(255, 255, 255, 0.03)',
                    border: isSelected
                      ? `2px solid ${cat.badgeColor}`
                      : '1px solid rgba(255, 255, 255, 0.08)',
                    boxShadow: isSelected ? `0 10px 25px -5px rgba(16, 185, 129, 0.2)` : 'none',
                    transition: 'all 0.25s ease',
                    position: 'relative',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <span style={{ fontSize: '2.5rem' }}>{cat.icon}</span>
                    <span style={{
                      padding: '0.3rem 0.75rem',
                      borderRadius: '999px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      background: isSelected ? cat.badgeColor : 'rgba(255,255,255,0.08)',
                      color: isSelected ? '#000' : 'var(--text-muted)',
                    }}>
                      Model: {cat.defaultBookingModel}
                    </span>
                  </div>

                  <h4 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#fff', marginBottom: '0.5rem' }}>
                    {cat.title}
                  </h4>
                  <p style={{ color: 'var(--text-muted, #94a3b8)', fontSize: '0.85rem', lineHeight: '1.4', marginBottom: '1rem' }}>
                    {cat.description}
                  </p>

                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                      Examples:
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                      {cat.examples.map(ex => (
                        <span key={ex} style={{ fontSize: '0.72rem', background: 'rgba(255,255,255,0.05)', padding: '0.2rem 0.5rem', borderRadius: '4px', color: '#cbd5e1' }}>
                          {ex}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div style={{
                    marginTop: '1.25rem',
                    paddingTop: '0.75rem',
                    borderTop: '1px solid rgba(255,255,255,0.06)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}>
                    <span style={{ fontSize: '0.8rem', color: isSelected ? '#10b981' : 'var(--text-muted)' }}>
                      {isSelected ? '✓ Selected' : 'Click to select'}
                    </span>
                    <div style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      border: isSelected ? 'none' : '2px solid rgba(255,255,255,0.2)',
                      background: isSelected ? '#10b981' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#000',
                      fontWeight: 800,
                      fontSize: '0.7rem',
                    }}>
                      {isSelected ? '✓' : ''}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Primary Booking Model Selection */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: '14px',
            padding: '1.25rem',
            marginBottom: '1.5rem',
          }}>
            <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#fff', marginBottom: '0.5rem' }}>
              ⚙️ Primary Booking Flow Engine
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
              {[
                { id: 'SLOT', label: 'Time-Slot Booking (SLOT)', desc: 'Court/turf booking by hour/slot' },
                { id: 'TICKET', label: 'Ticket / Visitor Pass (TICKET)', desc: 'General entry pass with capacity limit' },
                { id: 'SESSION', label: 'Scheduled Sessions (SESSION)', desc: 'Pre-timed classes, batches, or coaching' },
              ].map(model => (
                <label
                  key={model.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.6rem',
                    padding: '0.8rem',
                    borderRadius: '8px',
                    background: formData.booking_model === model.id ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                    border: formData.booking_model === model.id ? '1px solid #10b981' : '1px solid rgba(255,255,255,0.06)',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="radio"
                    name="booking_model"
                    value={model.id}
                    checked={formData.booking_model === model.id}
                    onChange={() => setFormData({ ...formData, booking_model: model.id })}
                    style={{ marginTop: '0.2rem' }}
                  />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#fff' }}>{model.label}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{model.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setCurrentStep(1)}
            >
              ← Back to Location
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                if (formData.categories.length === 0) {
                  setErrorMsg('Please select at least one category.');
                  return;
                }
                setErrorMsg('');
                setCurrentStep(3);
              }}
              style={{ padding: '0.8rem 2rem' }}
            >
              Continue to Step 3: Operations →
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Operations, Pricing & Media */}
      {currentStep === 3 && (
        <div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.25rem', color: '#fff' }}>
            ⚙️ Step 3: Operating Hours, Pricing & Amenities
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 600, color: '#e2e8f0' }}>
                Base Price per Slot / Entry ({formData.currency_code}) *
              </label>
              <input
                type="number"
                className="form-input"
                placeholder={`e.g. 1000 in ${formData.currency_code}`}
                value={formData.price_per_hour}
                onChange={e => setFormData({ ...formData, price_per_hour: e.target.value })}
                required
                min="0"
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Displayed as: {formatPrice(formData.price_per_hour || 0, formData.currency_code)}
              </span>
            </div>

            {formData.booking_model === 'SLOT' && (
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600, color: '#e2e8f0' }}>Slot Duration (Minutes)</label>
                <select
                  className="form-input"
                  value={formData.slot_duration}
                  onChange={e => setFormData({ ...formData, slot_duration: parseInt(e.target.value, 10) })}
                >
                  <option value="30">30 minutes</option>
                  <option value="60">60 minutes (1 hour)</option>
                  <option value="90">90 minutes (1.5 hours)</option>
                  <option value="120">120 minutes (2 hours)</option>
                </select>
              </div>
            )}

            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 600, color: '#e2e8f0' }}>Open Time</label>
              <input
                type="time"
                className="form-input"
                value={formData.open_time}
                onChange={e => setFormData({ ...formData, open_time: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 600, color: '#e2e8f0' }}>Close Time</label>
              <input
                type="time"
                className="form-input"
                value={formData.close_time}
                onChange={e => setFormData({ ...formData, close_time: e.target.value })}
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', color: '#e2e8f0' }}>
              <input
                type="checkbox"
                checked={formData.is_24_hours}
                onChange={e => setFormData({ ...formData, is_24_hours: e.target.checked })}
              />
              <span style={{ fontWeight: 600 }}>Venue operates 24 Hours / Round-the-Clock</span>
            </label>
          </div>

          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label className="form-label" style={{ fontWeight: 600, color: '#e2e8f0' }}>Venue Description</label>
            <textarea
              className="form-input"
              rows="3"
              placeholder="Highlight special features, rules, court dimensions, safety measures, or admission policies..."
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          {/* Amenities Multi-Select */}
          <div className="form-group" style={{ marginBottom: '2rem' }}>
            <label className="form-label" style={{ fontWeight: 600, color: '#e2e8f0', marginBottom: '0.75rem', display: 'block' }}>
              Available Amenities & Facilities
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {AMENITIES_LIST.map(amenity => {
                const isSelected = formData.amenities.includes(amenity);
                return (
                  <button
                    key={amenity}
                    type="button"
                    onClick={() => handleAmenityToggle(amenity)}
                    style={{
                      padding: '0.5rem 0.9rem',
                      borderRadius: '8px',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: isSelected ? '1px solid #10b981' : '1px solid rgba(255,255,255,0.1)',
                      background: isSelected ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255,255,255,0.03)',
                      color: isSelected ? '#34d399' : 'var(--text-secondary, #cbd5e1)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {isSelected ? '✓ ' : '+ '} {amenity}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Media / Photos Upload */}
          <div className="form-group" style={{ marginBottom: '2rem' }}>
            <label className="form-label" style={{ fontWeight: 600, color: '#e2e8f0', marginBottom: '0.75rem', display: 'block' }}>
              Venue Photos & Cover Image
            </label>
            <TurfImageUpload
              photos={formData.photos}
              coverImage={formData.coverImage}
              onChange={({ photos, coverImage, photosCount }) => {
                setFormData(prev => ({
                  ...prev,
                  photos,
                  coverImage,
                  photosCount,
                }));
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setCurrentStep(2)}
            >
              ← Back to Categories
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                if (!formData.price_per_hour || Number(formData.price_per_hour) <= 0) {
                  setErrorMsg('Please specify a base price.');
                  return;
                }
                setErrorMsg('');
                setCurrentStep(4);
              }}
              style={{ padding: '0.8rem 2rem' }}
            >
              Review & Submit →
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: Review & Submit */}
      {currentStep === 4 && (
        <div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem', color: '#fff' }}>
            🚀 Step 4: Review & Submit for Approval
          </h3>
          <p style={{ color: 'var(--text-muted, #94a3b8)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            Please review the details below before submitting. Once submitted, our admin team will review and approve your venue so it can go live to customers.
          </p>

          <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            padding: '1.5rem',
            marginBottom: '1.5rem',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '1.5rem',
          }}>
            <div>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>Venue Name</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff', marginTop: '0.2rem' }}>{formData.name || '—'}</div>

              <div style={{ marginTop: '1rem', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>Location</div>
              <div style={{ fontSize: '0.9rem', color: '#e2e8f0', marginTop: '0.2rem' }}>
                {formData.address || '—'}, {formData.city}, {formData.state} ({formData.country_code})
              </div>

              <div style={{ marginTop: '1rem', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>Currency & Timezone</div>
              <div style={{ fontSize: '0.9rem', color: '#e2e8f0', marginTop: '0.2rem' }}>
                {formData.currency_code} · {formData.timezone}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>Selected Categories</div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.4rem' }}>
                {formData.categories.map(c => {
                  const catObj = VENUE_CATEGORIES[c];
                  return (
                    <span key={c} style={{
                      padding: '0.3rem 0.75rem',
                      borderRadius: '6px',
                      background: 'rgba(16, 185, 129, 0.15)',
                      color: '#34d399',
                      fontSize: '0.8rem',
                      fontWeight: 700
                    }}>
                      {catObj?.icon} {catObj?.title || c}
                    </span>
                  );
                })}
              </div>

              <div style={{ marginTop: '1rem', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>Booking Model & Pricing</div>
              <div style={{ fontSize: '0.95rem', color: '#fff', fontWeight: 700, marginTop: '0.2rem' }}>
                Model: <span style={{ color: '#10b981' }}>{formData.booking_model}</span> · Base Price: <span style={{ color: '#f59e0b' }}>{formatPrice(formData.price_per_hour, formData.currency_code)}</span>
              </div>

              <div style={{ marginTop: '1rem', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>Hours & Amenities</div>
              <div style={{ fontSize: '0.85rem', color: '#cbd5e1', marginTop: '0.2rem' }}>
                {formData.is_24_hours ? '24 Hours Open' : `${formData.open_time} - ${formData.close_time}`} · {formData.amenities.length} Amenities
              </div>
            </div>
          </div>

          <div style={{
            padding: '1.25rem',
            borderRadius: '12px',
            background: 'rgba(59, 130, 246, 0.08)',
            border: '1px solid rgba(59, 130, 246, 0.25)',
            marginBottom: '2rem',
          }}>
            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#93c5fd' }}>
              🛡️ Safe & Verified Approval Workflow
            </h4>
            <p style={{ margin: '0.4rem 0 0', fontSize: '0.85rem', color: '#bfdbfe', lineHeight: '1.5' }}>
              Upon submission, your venue will enter <strong>Pending Approval</strong>. You can configure individual courts, attractions, and ticket types in your owner panel while our compliance team verifies your business details. Once approved, the venue is automatically published to customer search and bookings.
            </p>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setCurrentStep(3)}
              disabled={submitting}
            >
              ← Back to Edit
            </button>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleSaveDraft}
                disabled={savingDraft || submitting}
              >
                {savingDraft ? 'Saving Draft...' : '💾 Save Draft'}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSubmitForApproval}
                disabled={submitting}
                style={{
                  padding: '0.85rem 2.2rem',
                  fontSize: '1rem',
                  fontWeight: 800,
                  boxShadow: '0 4px 15px rgba(16, 185, 129, 0.4)',
                }}
              >
                {submitting ? 'Submitting...' : '🚀 Submit for Approval'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Map Modal */}
      {showMapModal && (
        <div className="modal-overlay" onClick={() => setShowMapModal(false)}>
          <div
            className="modal"
            style={{ maxWidth: '850px', width: '95%', padding: '1.5rem', background: 'var(--bg-card, #131d2f)' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: '#fff' }}>
                📍 Pin Exact Venue Location
              </h3>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowMapModal(false)}>
                ✕ Close
              </button>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              <input
                type="text"
                className="form-input"
                placeholder="Search area, landmark, or street..."
                value={mapSearchQuery}
                onChange={e => setMapSearchQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSearchOnMap(); }}
              />
              <button type="button" className="btn btn-primary" onClick={handleSearchOnMap} disabled={mapLoading}>
                {mapLoading ? 'Searching...' : 'Search'}
              </button>
            </div>

            <div
              ref={mapContainerRef}
              style={{
                width: '100%',
                height: '380px',
                borderRadius: '12px',
                border: '1px solid rgba(255,255,255,0.1)',
                marginBottom: '1rem',
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Click anywhere on map or drag the pin to set the exact coordinates.
              </div>
              <button type="button" className="btn btn-primary" onClick={() => setShowMapModal(false)}>
                Confirm Location
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
