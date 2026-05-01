'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';
import { formatPrice, formatCompactNumber, formatDate, getSportInfo, AMENITIES_LIST } from '@/lib/constants';

export default function OwnerDashboard() {
  const router = useRouter();
  const [owner, setOwner] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [turfs, setTurfs] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [earnings, setEarnings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Turf form state
  const [showTurfForm, setShowTurfForm] = useState(false);
  const [editingTurf, setEditingTurf] = useState(null);
  const [turfForm, setTurfForm] = useState({
    name: '', location: '', address: '', sport_type: 'cricket',
    price_per_hour: '', description: '', images: [], amenities: [],
    open_time: '06:00', close_time: '23:00',
    markup_type: 'fixed', markup_value: '200',
    latitude: '', longitude: ''
  });

  // Slot blocking
  const [blockForm, setBlockForm] = useState({ turf_id: '', block_date: '', time_slot: '', reason: '' });

  // Special pricing
  const [specialPricingMode, setSpecialPricingMode] = useState('day'); // 'day', 'date'
  const [specialPricingTurf, setSpecialPricingTurf] = useState('');
  const [specialPricingDay, setSpecialPricingDay] = useState('');
  const [specialPricingDate, setSpecialPricingDate] = useState('');
  const [specialPricingTimeSlot, setSpecialPricingTimeSlot] = useState('');
  const [specialPricingPrice, setSpecialPricingPrice] = useState('');
  const [specialPricingList, setSpecialPricingList] = useState([]);
  const [specialPricingLoading, setSpecialPricingLoading] = useState(false);

  // Coupon management
  const [coupons, setCoupons] = useState([]);
  const [couponForm, setCouponForm] = useState({
    code: '',
    discount_type: 'flat',
    discount_value: '',
    expiry_date: '',
    turf_id: '',
    max_uses: '',
    min_booking_amount: '',
    offer_percentage: '',
    offer_label: ''
  });
  const [couponLoading, setCouponLoading] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const ownerData = localStorage.getItem('owner');
    if (!token || !ownerData) {
      router.push('/owner/login');
      return;
    }
    setOwner(JSON.parse(ownerData));
    loadData();
    
    // Expose loadCoupons to window for script execution
    window.__loadCoupons = loadCoupons;
  }, []);

  // Load coupons when switching to coupons tab
  useEffect(() => {
    if (activeTab === 'coupons') {
      loadCoupons();
    }
  }, [activeTab]);

  async function loadData() {
    try {
      const [turfsData, bookingsData, earningsData] = await Promise.all([
        apiGet('/owners/turfs').catch(() => ({ turfs: [] })),
        apiGet('/owners/bookings').catch(() => ({ bookings: [] })),
        apiGet('/owners/earnings').catch(() => null),
      ]);
      setTurfs(turfsData.turfs || []);
      setBookings(bookingsData.bookings || []);
      setEarnings(earningsData);
    } catch (err) {
      console.log('Using demo data');
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('owner');
    router.push('/owner/login');
  }

  async function handleSaveTurf(e) {
    e.preventDefault();
    try {
      if (editingTurf) {
        await apiPut(`/owners/turfs/${editingTurf.id}`, turfForm);
      } else {
        await apiPost('/owners/turfs', turfForm);
      }
      setShowTurfForm(false);
      setEditingTurf(null);
      resetTurfForm();
      loadData();
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleDeleteTurf(id) {
    if (!confirm('Are you sure you want to delete this turf?')) return;
    try {
      await apiDelete(`/owners/turfs/${id}`);
      loadData();
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleBlockSlot(e) {
    e.preventDefault();
    try {
      await apiPost(`/owners/turfs/${blockForm.turf_id}/block-slot`, {
        block_date: blockForm.block_date,
        time_slot: blockForm.time_slot,
        reason: blockForm.reason,
      });
      alert('Slot blocked successfully!');
      setBlockForm({ turf_id: '', block_date: '', time_slot: '', reason: '' });
    } catch (err) {
      alert(err.message);
    }
  }

  async function loadSpecialPricing(turfId) {
    if (!turfId) {
      setSpecialPricingList([]);
      return;
    }
    setSpecialPricingLoading(true);
    try {
      const data = await apiGet(`/owners/turfs/${turfId}/special-pricing`);
      setSpecialPricingList(data.specialPricing || []);
    } catch (err) {
      console.error(err);
      setSpecialPricingList([]);
    } finally {
      setSpecialPricingLoading(false);
    }
  }

  async function handleSaveSpecialPricing(e) {
    e.preventDefault();
    if (!specialPricingTurf || !specialPricingTimeSlot || !specialPricingPrice) {
      alert('Please fill all required fields');
      return;
    }

    const dayOfWeek = specialPricingMode === 'day' ? parseInt(specialPricingDay) : null;
    const specificDate = specialPricingMode === 'date' ? specialPricingDate : null;

    try {
      await apiPost(`/owners/turfs/${specialPricingTurf}/special-pricing`, {
        day_of_week: dayOfWeek,
        specific_date: specificDate,
        time_slot: specialPricingTimeSlot,
        special_price: parseFloat(specialPricingPrice),
        offer_percentage: couponForm.offer_percentage ? parseInt(couponForm.offer_percentage) : null,
        offer_label: couponForm.offer_label || null
      });
      alert('Special pricing saved successfully!');
      setSpecialPricingPrice('');
      loadSpecialPricing(specialPricingTurf);
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleDeleteSpecialPricing(id) {
    if (!confirm('Delete this special pricing?')) return;
    try {
      await apiDelete(`/owners/turfs/${specialPricingTurf}/special-pricing/${id}`);
      alert('Special pricing deleted!');
      loadSpecialPricing(specialPricingTurf);
    } catch (err) {
      alert(err.message);
    }
  }

  async function loadCoupons() {
    try {
      const data = await apiGet('/coupons');
      setCoupons(data.coupons || []);
    } catch (err) {
      console.error('Failed to load coupons:', err);
      setCoupons([]);
    }
  }

  const DAYS_OF_WEEK = [
    { value: 0, label: 'Sunday' },
    { value: 1, label: 'Monday' },
    { value: 2, label: 'Tuesday' },
    { value: 3, label: 'Wednesday' },
    { value: 4, label: 'Thursday' },
    { value: 5, label: 'Friday' },
    { value: 6, label: 'Saturday' },
  ];

  const getSpecialPricingSlots = (turfId) => {
    const turf = turfs.find(t => t.id == turfId);
    if (!turf) return [];
    
    const startHour = parseInt((turf.open_time || '06:00').split(':')[0]);
    const endHour = parseInt((turf.close_time || '23:00').split(':')[0]);
    
    const slots = [];
    for (let h = startHour; h < endHour; h++) {
      const start = h >= 12 ? `${h === 12 ? 12 : h - 12}:00 PM` : `${h === 0 ? 12 : h}:00 AM`;
      const end = h + 1 >= 12 ? `${h + 1 === 12 ? 12 : h + 1 - 12}:00 PM` : `${h + 1 === 0 ? 12 : h + 1}:00 AM`;
      slots.push(`${start} - ${end}`);
    }
    return slots;
  };

  const specialPricingSlots = specialPricingTurf ? getSpecialPricingSlots(specialPricingTurf) : [];

  function resetTurfForm() {
    setTurfForm({ 
      name: '', location: '', address: '', sport_type: 'cricket', price_per_hour: '', 
      description: '', images: [], amenities: [], open_time: '06:00', close_time: '23:00',
      markup_type: 'fixed', markup_value: '200', latitude: '', longitude: ''
    });
  }

  function editTurf(turf) {
    setEditingTurf(turf);
    setTurfForm({
      name: turf.name, location: turf.location, address: turf.address || '',
      sport_type: turf.sport_type, price_per_hour: turf.price_per_hour,
      description: turf.description || '', images: turf.images || [], amenities: turf.amenities || [],
      open_time: turf.open_time || '06:00', close_time: turf.close_time || '23:00',
      markup_type: turf.markup_type || 'fixed', markup_value: turf.markup_value || 0,
      latitude: turf.latitude || '', longitude: turf.longitude || ''
    });
    setShowTurfForm(true);
  }

  function toggleAmenity(amenity) {
    setTurfForm(prev => ({
      ...prev,
      amenities: prev.amenities.includes(amenity)
        ? prev.amenities.filter(a => a !== amenity)
        : [...prev.amenities, amenity]
    }));
  }

  const getDynamicSlots = (turfId) => {
    const turf = turfs.find(t => t.id == turfId);
    if (!turf) return [];
    
    const startHour = parseInt((turf.open_time || '06:00').split(':')[0]);
    const endHour = parseInt((turf.close_time || '23:00').split(':')[0]);
    
    const slots = [];
    for (let h = startHour; h < endHour; h++) {
      slots.push(`${h.toString().padStart(2, '0')}:00 - ${(h + 1).toString().padStart(2, '0')}:00`);
    }
    return slots;
  };

  const allSlots = blockForm.turf_id ? getDynamicSlots(blockForm.turf_id) : [];

  const tabs = [
    { key: 'dashboard', label: '📊 Dashboard', icon: '📊' },
    { key: 'turfs', label: '🏟️ My Turfs', icon: '🏟️' },
    { key: 'bookings', label: '📋 Bookings', icon: '📋' },
    { key: 'slots', label: '🔒 Slot Control', icon: '🔒' },
    { key: 'pricing', label: '💲 Special Pricing', icon: '💲' },
    { key: 'coupons', label: '🎟️ Coupons', icon: '🎟️' },
    { key: 'earnings', label: '💰 Earnings', icon: '💰' },
  ];

  if (loading) return <div className="loading-container"><div className="loader"></div></div>;

  return (
    <div className="dashboard">
      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <Link href="/" className="navbar-logo" style={{ fontSize: '1.2rem' }}>
            <img src="/images/logo.png" alt="Logo" style={{ width: 32, height: 32, borderRadius: '4px' }} />
            Book <span className="accent">Arena</span>
          </Link>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.5rem' }}>Owner Panel</p>
        </div>

        <ul className="sidebar-nav">
          {tabs.map(tab => (
            <li key={tab.key}>
              <a
                className={activeTab === tab.key ? 'active' : ''}
                onClick={() => { setActiveTab(tab.key); setSidebarOpen(false); }}
                style={{ cursor: 'pointer' }}
              >
                <span>{tab.icon}</span>
                <span>{tab.label.split(' ').slice(1).join(' ')}</span>
              </a>
            </li>
          ))}
          <li style={{ marginTop: '2rem' }}>
            <a onClick={handleLogout} style={{ cursor: 'pointer', color: '#f87171' }}>
              <span>🚪</span>
              <span>Logout</span>
            </a>
          </li>
        </ul>
      </aside>

      {/* Main Content */}
      <main className="dashboard-main">
        {/* Mobile Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
          <button className="nav-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
            <span></span><span></span><span></span>
          </button>
          <div style={{ textAlign: sidebarOpen ? 'left' : 'right', flex: 1 }}>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {tabs.find(t => t.key === activeTab)?.label || 'Dashboard'}
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Welcome back, {owner?.name || 'Owner'} 👋
            </p>
          </div>
        </div>

        {/* ═══════ DASHBOARD TAB ═══════ */}
        {activeTab === 'dashboard' && (
          <div>
            <div className="grid-5" style={{ marginBottom: '2rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
              {[
                { icon: '🏟️', label: 'My Turfs', value: turfs.length },
                { icon: '📋', label: 'Total Bookings', value: bookings.length },
                { icon: '📅', label: 'Net Earnings (Total)', value: formatCompactNumber(earnings?.total || 0) },
                { icon: '📊', label: 'This Month', value: formatCompactNumber(earnings?.monthly || 0) },
                { icon: '💰', label: "Today's Earnings", value: formatCompactNumber(earnings?.today || 0) },
              ].map((stat, i) => (
                <div key={i} className="stat-card">
                  <div className="stat-icon">{stat.icon}</div>
                  <div className="stat-value">{stat.value}</div>
                  <div className="stat-label">{stat.label}</div>
                </div>
              ))}
            </div>

            {/* Recent Bookings */}
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-primary)' }}>
              Recent Bookings
            </h3>
            {bookings.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Booking ID</th>
                      <th>User Name</th>
                      <th>Time Slot</th>
                      <th>Payment ID</th>
                      <th>Status</th>
                      <th>Final Earned Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bookings.slice(0, 5).map(b => (
                      <tr key={b.id}>
                        <td style={{ fontWeight: 600, color: 'var(--text-muted)' }}>#{b.id}</td>
                        <td>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{b.customer_name}</div>
                        </td>
                        <td style={{ color: 'var(--emerald-400)' }}>{formatDate(b.booking_date)}<br/>{b.time_slot}</td>
                        <td style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--text-muted)' }}>{b.payment_id || '—'}</td>
                        <td><span className={`status-badge status-${b.status}`}>{b.status}</span></td>
                        <td style={{ color: 'var(--emerald-400)', fontWeight: 800 }}>{formatPrice(b.netAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-icon">📋</div>
                <h3>No bookings yet</h3>
                <p>Bookings will appear here once customers start booking</p>
              </div>
            )}
          </div>
        )}

        {/* ═══════ TURFS TAB ═══════ */}
        {activeTab === 'turfs' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>Your Turfs</h3>
              <button className="btn btn-primary" onClick={() => { resetTurfForm(); setEditingTurf(null); setShowTurfForm(true); }}>
                ➕ Add New Turf
              </button>
            </div>

            {showTurfForm && (
              <div className="card" style={{ marginBottom: '2rem', border: '1px solid var(--emerald-500)' }}>
                <h3 style={{ marginBottom: '1.5rem' }}>{editingTurf ? 'Edit Turf' : 'Add New Turf'}</h3>
                <form onSubmit={handleSaveTurf}>
                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">Turf Name *</label>
                      <input type="text" className="form-input" placeholder="e.g. Ryzon Arena"
                        value={turfForm.name} onChange={(e) => setTurfForm({ ...turfForm, name: e.target.value })} required />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Sport Type / Play Zone *</label>
                      <select className="form-input" 
                        value={['cricket', 'football', 'badminton', 'tennis', 'basketball', 'volleyball', 'box cricket'].includes(turfForm.sport_type?.toLowerCase()) ? turfForm.sport_type.toLowerCase() : 'custom'}
                        onChange={(e) => setTurfForm({ ...turfForm, sport_type: e.target.value === 'custom' ? '' : e.target.value })}>
                        <option value="cricket">Cricket</option>
                        <option value="football">Football</option>
                        <option value="badminton">Badminton</option>
                        <option value="tennis">Tennis</option>
                        <option value="basketball">Basketball</option>
                        <option value="volleyball">Volleyball</option>
                        <option value="box cricket">Box Cricket</option>
                        <option value="custom">+ Add New Sport / Custom Play Zone</option>
                      </select>
                      {!['cricket', 'football', 'badminton', 'tennis', 'basketball', 'volleyball', 'box cricket'].includes(turfForm.sport_type?.toLowerCase()) && (
                        <input type="text" className="form-input" style={{ marginTop: '0.5rem' }} placeholder="Enter custom sport or play zone (e.g. Skating Arena)" 
                          value={turfForm.sport_type} onChange={(e) => setTurfForm({ ...turfForm, sport_type: e.target.value })} required />
                      )}
                    </div>
                  </div>
                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">City/Location *</label>
                      <input type="text" className="form-input" placeholder="e.g. Mumbai"
                        value={turfForm.location} onChange={(e) => setTurfForm({ ...turfForm, location: e.target.value })} required />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Base Price (Per Hour) *</label>
                      <input type="number" className="form-input" placeholder="₹"
                        value={turfForm.price_per_hour} onChange={(e) => setTurfForm({ ...turfForm, price_per_hour: e.target.value })} required />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Full Address *</label>
                    <input type="text" className="form-input" placeholder="Complete address for customers"
                      value={turfForm.address} onChange={(e) => setTurfForm({ ...turfForm, address: e.target.value })} required />
                  </div>
                  <div className="form-group" style={{ marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '10px' }}>
                      <label className="form-label" style={{ marginBottom: 0 }}>Map Coordinates *</label>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button 
                          type="button" 
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            const query = prompt("Enter a place name or address to search (e.g., 'Marina Beach, Chennai'):");
                            if (!query) return;
                            
                            const btn = document.getElementById('search-loc-btn');
                            const originalText = btn.innerHTML;
                            btn.innerHTML = 'Searching...';
                            
                            fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`)
                              .then(res => res.json())
                              .then(data => {
                                if (data && data.length > 0) {
                                  const place = data[0];
                                  setTurfForm(prev => ({ 
                                    ...prev, 
                                    latitude: parseFloat(place.lat).toFixed(6), 
                                    longitude: parseFloat(place.lon).toFixed(6),
                                    location: prev.location || place.display_name.split(',')[0],
                                    address: prev.address || place.display_name
                                  }));
                                  alert(`Found: ${place.display_name}`);
                                } else {
                                  alert("Could not find coordinates for that location. Try being more specific.");
                                }
                                btn.innerHTML = originalText;
                              })
                              .catch(err => {
                                alert("Error searching for location.");
                                btn.innerHTML = originalText;
                              });
                          }}
                          id="search-loc-btn"
                        >
                          🌍 Search Location
                        </button>

                        <button 
                          type="button" 
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            if (!navigator.geolocation) {
                              alert("Geolocation is not supported by your browser");
                              return;
                            }
                            const btn = document.getElementById('detect-btn');
                            btn.innerHTML = 'Detecting...';
                            navigator.geolocation.getCurrentPosition(
                              async (pos) => {
                                const lat = pos.coords.latitude;
                                const lng = pos.coords.longitude;
                                
                                // Try to reverse geocode to get city
                                try {
                                  const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`);
                                  const data = await res.json();
                                  const city = data.address?.city || data.address?.state_district || data.address?.town;
                                  const address = data.display_name;
                                  
                                  setTurfForm(prev => ({ 
                                    ...prev, 
                                    latitude: lat, 
                                    longitude: lng,
                                    location: prev.location || city || '',
                                    address: prev.address || address || ''
                                  }));
                                } catch (err) {
                                  setTurfForm(prev => ({ ...prev, latitude: lat, longitude: lng }));
                                }
                                btn.innerHTML = '📍 Location Detected';
                              },
                              (err) => {
                                alert("Please enable location access to use this feature");
                                btn.innerHTML = '📍 Use My Current Location';
                              }
                            );
                          }}
                          id="detect-btn"
                        >
                          📍 Use My Current Location
                        </button>
                      </div>
                    </div>
                    <div className="grid-2">
                      <input type="number" step="any" className="form-input" placeholder="Latitude (e.g. 13.0827)"
                        value={turfForm.latitude} onChange={(e) => setTurfForm({ ...turfForm, latitude: e.target.value })} required />
                      <input type="number" step="any" className="form-input" placeholder="Longitude (e.g. 80.2707)"
                        value={turfForm.longitude} onChange={(e) => setTurfForm({ ...turfForm, longitude: e.target.value })} required />
                    </div>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.5rem' }}>
                      You must provide precise coordinates. Use <strong>"Search Location"</strong> to search by name (e.g., Google Maps place name), or use <strong>"Use My Current Location"</strong> if you are physically at the turf.
                    </p>
                  </div>
                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">Opening Time</label>
                      <input type="time" className="form-input" value={turfForm.open_time}
                        onChange={(e) => setTurfForm({ ...turfForm, open_time: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Closing Time</label>
                      <input type="time" className="form-input" value={turfForm.close_time}
                        onChange={(e) => setTurfForm({ ...turfForm, close_time: e.target.value })} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Description</label>
                    <textarea className="form-input" rows="3" placeholder="Tell customers about your turf..."
                      value={turfForm.description} onChange={(e) => setTurfForm({ ...turfForm, description: e.target.value })}></textarea>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Images (Comma separated URLs)</label>
                    <input type="text" className="form-input" placeholder="https://image1.jpg, https://image2.jpg"
                      value={turfForm.images.join(', ')}
                      onChange={(e) => setTurfForm({ ...turfForm, images: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} />
                  </div>
                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">Markup Type (Display Discount)</label>
                      <select className="form-input" value={turfForm.markup_type || 'fixed'}
                        onChange={(e) => setTurfForm({ ...turfForm, markup_type: e.target.value })}>
                        <option value="fixed">Fixed (₹)</option>
                        <option value="percentage">Percentage (%)</option>
                      </select>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginTop: '0.2rem' }}>This adds to the base price for "Striked Price" display</p>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Markup Value *</label>
                      <input type="number" className="form-input" placeholder="e.g. 200"
                        value={turfForm.markup_value || ''} 
                        onChange={(e) => setTurfForm({ ...turfForm, markup_value: e.target.value })} 
                        required min="0" />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Amenities</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {AMENITIES_LIST.map(a => (
                        <button key={a} type="button"
                          className={`sport-chip ${turfForm.amenities.includes(a) ? 'active' : ''}`}
                          style={{ fontSize: '0.8rem', padding: '6px 14px' }}
                          onClick={() => toggleAmenity(a)}>
                          {turfForm.amenities.includes(a) ? '✓ ' : ''}{a}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <button type="submit" className="btn btn-primary" disabled={couponLoading}>
                      {editingTurf ? '💾 Update Turf' : '➕ Add Turf'}
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={() => { setShowTurfForm(false); setEditingTurf(null); }}>
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            <div className="grid-3">
              {turfs.map(turf => (
                <div key={turf.id} className="turf-card card">
                  <div className="turf-image" style={{ height: '140px', background: 'var(--bg-secondary)', borderRadius: '8px', marginBottom: '1rem', overflow: 'hidden' }}>
                    {turf.images && turf.images.length > 0 ? (
                      <img src={turf.images[0]} alt={turf.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: '2rem' }}>🏟️</div>
                    )}
                  </div>
                  <h4 style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.25rem' }}>{turf.name}</h4>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>📍 {turf.location}</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <span className="sport-chip" style={{ fontSize: '0.7rem' }}>{turf.sport_type.toUpperCase()}</span>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ textDecoration: 'line-through', color: 'var(--text-muted)', fontSize: '0.8rem' }}>{formatPrice(parseFloat(turf.price_per_hour || 0) + 200)}</div>
                      <div style={{ fontWeight: 700, color: 'var(--emerald-400)' }}>{formatPrice(turf.price_per_hour)}/hr</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => editTurf(turf)}>Edit</button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDeleteTurf(turf.id)}>🗑️</button>
                  </div>
                </div>
              ))}
            </div>
            {turfs.length === 0 && (
              <div className="empty-state">
                <div className="empty-icon">🏟️</div>
                <h3>No turfs added yet</h3>
                <p>Start by adding your first turf to receive bookings</p>
              </div>
            )}
          </div>
        )}

        {/* ═══════ BOOKINGS TAB ═══════ */}
        {activeTab === 'bookings' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>Booking History</h3>
            </div>
            {bookings.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Booking ID</th>
                      <th>Turf</th>
                      <th>Customer</th>
                      <th>Date & Slot</th>
                      <th>Payment ID</th>
                      <th>Status</th>
                      <th>Net Earnings</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bookings.map(b => (
                      <tr key={b.id}>
                        <td>#{b.id}</td>
                        <td>{b.turf_name}</td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{b.customer_name}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{b.customer_phone}</div>
                        </td>
                        <td>
                          <div style={{ fontSize: '0.9rem' }}>{formatDate(b.booking_date)}</div>
                          <div style={{ fontSize: '0.85rem', color: 'var(--emerald-400)' }}>{b.time_slot}</div>
                        </td>
                        <td style={{ fontSize: '0.75rem', fontFamily: 'monospace' }}>{b.payment_id || 'Pending/Demo'}</td>
                        <td><span className={`status-badge status-${b.status}`}>{b.status}</span></td>
                        <td style={{ fontWeight: 700, color: 'var(--emerald-400)' }}>{formatPrice(b.netAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-icon">📋</div>
                <h3>No bookings yet</h3>
                <p>Follow the tips below to increase your turf's visibility</p>
              </div>
            )}
          </div>
        )}

        {/* ═══════ SLOTS TAB ═══════ */}
        {activeTab === 'slots' && (
          <div>
            <div className="card" style={{ maxWidth: '600px', margin: '0 auto' }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: '1.5rem', textAlign: 'center' }}>
                🔒 Block Unavailability
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '2rem', textAlign: 'center' }}>
                Use this to block slots for maintenance or private bookings.
              </p>
              <form onSubmit={handleBlockSlot}>
                <div className="form-group">
                  <label className="form-label">Select Turf</label>
                  <select className="form-input" required value={blockForm.turf_id}
                    onChange={(e) => setBlockForm({ ...blockForm, turf_id: e.target.value })}>
                    <option value="">Choose a turf</option>
                    {turfs.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Date</label>
                    <input type="date" className="form-input" required value={blockForm.block_date}
                      onChange={(e) => setBlockForm({ ...blockForm, block_date: e.target.value })} min={new Date().toISOString().split('T')[0]} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Time Slot</label>
                    <select className="form-input" required value={blockForm.time_slot}
                      onChange={(e) => setBlockForm({ ...blockForm, time_slot: e.target.value })}>
                      <option value="">Select slot</option>
                      {allSlots.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Reason (Optional)</label>
                  <input type="text" className="form-input" placeholder="e.g. Maintenance"
                    value={blockForm.reason} onChange={(e) => setBlockForm({ ...blockForm, reason: e.target.value })} />
                </div>
                <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
                  Block Slot
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ═══════ PRICING TAB ═══════ */}
        {activeTab === 'pricing' && (
          <div>
            <div className="grid-2">
              <div className="card">
                <h3 style={{ marginBottom: '1.5rem' }}>💰 Set Special Pricing</h3>
                <form onSubmit={handleSaveSpecialPricing}>
                  <div className="form-group">
                    <label className="form-label">Choose Turf</label>
                    <select className="form-input" value={specialPricingTurf} 
                      onChange={(e) => { setSpecialPricingTurf(e.target.value); loadSpecialPricing(e.target.value); }} required>
                      <option value="">Select Turf</option>
                      {turfs.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>

                  <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                    <button type="button" 
                      className={`btn ${specialPricingMode === 'day' ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setSpecialPricingMode('day')} style={{ flex: 1 }}>
                      Day Basis
                    </button>
                    <button type="button" 
                      className={`btn ${specialPricingMode === 'date' ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setSpecialPricingMode('date')} style={{ flex: 1 }}>
                      Specific Date
                    </button>
                  </div>

                  {specialPricingMode === 'day' ? (
                    <div className="form-group">
                      <label className="form-label">Select Day</label>
                      <select className="form-input" value={specialPricingDay} onChange={(e) => setSpecialPricingDay(e.target.value)} required>
                        <option value="">Select Day</option>
                        {DAYS_OF_WEEK.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                      </select>
                    </div>
                  ) : (
                    <div className="form-group">
                      <label className="form-label">Select Date</label>
                      <input type="date" className="form-input" value={specialPricingDate} onChange={(e) => setSpecialPricingDate(e.target.value)} required />
                    </div>
                  )}

                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">Time Slot</label>
                      <select className="form-input" value={specialPricingTimeSlot} onChange={(e) => setSpecialPricingTimeSlot(e.target.value)} required>
                        <option value="">Select Slot</option>
                        {specialPricingSlots.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Special Price (₹)</label>
                      <input type="number" className="form-input" placeholder="₹" value={specialPricingPrice} 
                        onChange={(e) => setSpecialPricingPrice(e.target.value)} required />
                    </div>
                  </div>

                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">Offer Percentage (Optional)</label>
                      <input type="number" className="form-input" placeholder="e.g. 20"
                        value={couponForm.offer_percentage} onChange={(e) => setCouponForm({ ...couponForm, offer_percentage: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Offer Label (Optional)</label>
                      <input type="text" className="form-input" placeholder="e.g. Morning Deal"
                        value={couponForm.offer_label} onChange={(e) => setCouponForm({ ...couponForm, offer_label: e.target.value })} />
                    </div>
                  </div>

                  <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
                    Save Special Pricing
                  </button>
                </form>
              </div>

              <div className="card">
                <h3 style={{ marginBottom: '1.5rem' }}>📋 Existing Special Prices</h3>
                {specialPricingLoading ? (
                  <p>Loading...</p>
                ) : specialPricingList.length > 0 ? (
                  <div style={{ overflowY: 'auto', maxHeight: '400px' }}>
                    <table className="data-table" style={{ fontSize: '0.85rem' }}>
                      <thead>
                        <tr>
                          <th>Apply On</th>
                          <th>Slot</th>
                          <th>Price</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {specialPricingList.map(p => (
                          <tr key={p.id}>
                            <td>{p.specific_date ? formatDate(p.specific_date) : DAYS_OF_WEEK.find(d => d.value === p.day_of_week)?.label}</td>
                            <td>{p.time_slot}</td>
                            <td style={{ fontWeight: 700, color: 'var(--emerald-400)' }}>₹{p.special_price}</td>
                            <td>
                              <button className="btn btn-danger btn-sm" onClick={() => handleDeleteSpecialPricing(p.id)}>🗑️</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>No special pricing set for this turf</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══════ COUPONS TAB ═══════ */}
        {activeTab === 'coupons' && (
          <div>
            <div className="grid-2">
              <div className="card">
                <h3 style={{ marginBottom: '1.5rem' }}>🎟️ Create New Coupon</h3>
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  setCouponLoading(true);
                  try {
                    if (editingCoupon) {
                      await apiPut(`/coupons/${editingCoupon.id}`, couponForm);
                      alert('Coupon updated!');
                    } else {
                      await apiPost('/coupons', couponForm);
                      alert('Coupon created!');
                    }
                    setCouponForm({ code: '', discount_type: 'flat', discount_value: '', expiry_date: '', turf_id: '', max_uses: '', min_booking_amount: '' });
                    setEditingCoupon(null);
                    loadCoupons();
                  } catch (err) {
                    alert(err.message);
                  } finally {
                    setCouponLoading(false);
                  }
                }}>
                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">Coupon Code</label>
                      <input type="text" className="form-input" placeholder="e.g. WELCOME50" required
                        value={couponForm.code} onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value.toUpperCase() })} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Apply to Turf</label>
                      <select className="form-input" required value={couponForm.turf_id}
                        onChange={(e) => setCouponForm({ ...couponForm, turf_id: e.target.value })}>
                        <option value="">Select Turf</option>
                        {turfs.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">Discount Type</label>
                      <select className="form-input" value={couponForm.discount_type}
                        onChange={(e) => setCouponForm({ ...couponForm, discount_type: e.target.value })}>
                        <option value="flat">Flat (₹)</option>
                        <option value="percentage">Percentage (%)</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Discount Value</label>
                      <input type="number" className="form-input" placeholder="Value" required
                        value={couponForm.discount_value} onChange={(e) => setCouponForm({ ...couponForm, discount_value: e.target.value })} />
                    </div>
                  </div>
                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">Expiry Date (Optional)</label>
                      <input type="date" className="form-input" 
                        value={couponForm.expiry_date} onChange={(e) => setCouponForm({ ...couponForm, expiry_date: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Max Uses (Optional)</label>
                      <input type="number" className="form-input" placeholder="e.g. 100"
                        value={couponForm.max_uses} onChange={(e) => setCouponForm({ ...couponForm, max_uses: e.target.value })} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Min Booking Amount (₹)</label>
                    <input type="number" className="form-input" placeholder="e.g. 500"
                      value={couponForm.min_booking_amount} onChange={(e) => setCouponForm({ ...couponForm, min_booking_amount: e.target.value })} />
                  </div>
                  <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }} disabled={couponLoading}>
                    {editingCoupon ? 'Update Coupon' : 'Create Coupon'}
                  </button>
                  {editingCoupon && (
                    <button type="button" className="btn btn-secondary" style={{ width: '100%', marginTop: '0.5rem' }} 
                      onClick={() => { setEditingCoupon(null); setCouponForm({ code: '', discount_type: 'flat', discount_value: '', expiry_date: '', turf_id: '', max_uses: '', min_booking_amount: '' }); }}>
                      Cancel Edit
                    </button>
                  )}
                </form>
              </div>

              <div className="card">
                <h3 style={{ marginBottom: '1.5rem' }}>🎟️ Active Coupons</h3>
                {coupons.length > 0 ? (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="data-table" style={{ fontSize: '0.8rem' }}>
                      <thead>
                        <tr>
                          <th>Code</th>
                          <th>Value</th>
                          <th>Turf</th>
                          <th>Expiry</th>
                          <th>Usage</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {coupons.map(coupon => (
                          <tr key={coupon.id}>
                            <td>
                              <span style={{ fontWeight: 800, color: 'var(--emerald-400)', fontFamily: 'monospace', letterSpacing: '1px' }}>
                                {coupon.code}
                              </span>
                            </td>
                            <td>
                              <span style={{ color: 'var(--gold-400)', fontWeight: 600 }}>
                                {coupon.discount_type === 'flat' ? `₹${coupon.discount_value}` : `${coupon.discount_value}%`}
                              </span>
                            </td>
                            <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{coupon.turf_name}</td>
                            <td style={{ fontSize: '0.85rem' }}>
                              {coupon.expiry_date ? (
                                <span style={{ color: coupon.is_expired ? '#f87171' : 'var(--text-secondary)' }}>
                                  {formatDate(coupon.expiry_date)}
                                </span>
                              ) : (
                                <span style={{ color: 'var(--text-muted)' }}>Never</span>
                              )}
                            </td>
                            <td style={{ fontSize: '0.85rem' }}>
                              {coupon.max_uses ? (
                                <span>{coupon.used_count}/{coupon.max_uses}</span>
                              ) : (
                                <span style={{ color: 'var(--text-muted)' }}>{coupon.used_count} used</span>
                              )}
                            </td>
                            <td>
                              <span className={`status-badge ${coupon.is_expired ? 'status-cancelled' : 'status-confirmed'}`}>
                                {coupon.is_expired ? 'Expired' : (coupon.is_active ? 'Active' : 'Inactive')}
                              </span>
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: '0.25rem' }}>
                                <button className="btn btn-secondary btn-sm"
                                  onClick={() => {
                                    setEditingCoupon(coupon);
                                    setCouponForm({
                                      code: coupon.code,
                                      discount_type: coupon.discount_type,
                                      discount_value: coupon.discount_value,
                                      expiry_date: coupon.expiry_date || '',
                                      turf_id: coupon.turf_id,
                                      max_uses: coupon.max_uses || '',
                                      min_booking_amount: coupon.min_booking_amount || ''
                                    });
                                  }}>
                                  ✏️
                                </button>
                                <button className="btn btn-danger btn-sm"
                                  onClick={async () => {
                                    if (!confirm('Delete this coupon?')) return;
                                    try {
                                      await apiDelete(`/coupons/${coupon.id}`);
                                      alert('Coupon deleted!');
                                      loadCoupons();
                                    } catch (err) {
                                      alert(err.message);
                                    }
                                  }}>
                                  🗑️
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="empty-state" style={{ padding: '2rem' }}>
                    <div className="empty-icon">🎟️</div>
                    <h3>No coupons yet</h3>
                    <p>Create coupons to offer discounts to your customers</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══════ EARNINGS TAB ═══════ */}
        {activeTab === 'earnings' && (
          <div>
            <div className="grid-3" style={{ marginBottom: '2rem' }}>
              <div className="stat-card">
                <div className="stat-icon">📈</div>
                <div className="stat-value">{formatPrice(earnings?.total || 0)}</div>
                <div className="stat-label">Total Net Earnings</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">📅</div>
                <div className="stat-value">{formatPrice(earnings?.monthly || 0)}</div>
                <div className="stat-label">This Month Net Earnings</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">💰</div>
                <div className="stat-value">{formatPrice(earnings?.today || 0)}</div>
                <div className="stat-label">Today's Net Earnings</div>
              </div>
            </div>

            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 700, marginBottom: '1.5rem', color: 'var(--text-primary)' }}>
              📅 Daily Earnings (Current Month)
            </h3>
            
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Net Earnings</th>
                    <th>Payment Status</th>
                    <th>Progress Bar</th>
                  </tr>
                </thead>
                <tbody>
                  {earnings?.daily?.length > 0 ? (
                    earnings.daily.map((d, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 600 }}>{new Date(d.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })}</td>
                        <td style={{ color: 'var(--emerald-400)', fontWeight: 800 }}>{formatPrice(d.earnings)}</td>
                        <td>
                          {d.status === 'paid' ? (
                            <span className="status-badge status-confirmed" title={`Paid at: ${d.paid_at ? new Date(d.paid_at).toLocaleString() : 'N/A'}`}>Paid</span>
                          ) : (
                            <span className="status-badge status-pending">Not Paid</span>
                          )}
                        </td>
                        <td style={{ width: '30%' }}>
                          <div style={{ background: 'var(--bg-secondary)', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ 
                              background: 'var(--emerald-500)', 
                              height: '100%', 
                              width: `${Math.min(100, (d.earnings / Math.max(1000, ...earnings.daily.map(x => x.earnings))) * 100)}%` 
                            }}></div>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="3" style={{ textAlign: 'center', padding: '2rem' }}>No data for this month yet</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            <p style={{ marginTop: '2rem', color: 'var(--text-muted)', fontSize: '0.9rem', fontStyle: 'italic' }}>
              Note: Earnings shown are net after platform commission and any service fees.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
