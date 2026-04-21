'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';
import { formatPrice, formatCompactNumber, formatDate, getSportInfo, AMENITIES_LIST } from '@/lib/constants';

export default function AdminDashboard() {
  const router = useRouter();
  const [admin, setAdmin] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const [turfs, setTurfs] = useState([]);
  const [owners, setOwners] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Turf form
  const [showTurfForm, setShowTurfForm] = useState(false);
  const [editingTurf, setEditingTurf] = useState(null);
  const [turfForm, setTurfForm] = useState({
    name: '', location: '', address: '', sport_type: 'cricket',
    price_per_hour: '', description: '', images: [], amenities: []
  });

  // Turf Analytics
  const [selectedTurfAnalytics, setSelectedTurfAnalytics] = useState(null);
  const [turfEarnings, setTurfEarnings] = useState(null);

  // Commission
  const [commission, setCommission] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    const adminData = localStorage.getItem('admin');
    if (!token || !adminData) {
      router.push('/admin/login');
      return;
    }
    setAdmin(JSON.parse(adminData));
    loadAllData();
  }, []);

  async function loadAllData() {
    try {
      const [dashData, turfsData, ownersData, bookingsData] = await Promise.all([
        apiGet('/admin/dashboard').catch(() => ({ stats: {} })),
        apiGet('/admin/turfs').catch(() => ({ turfs: [] })),
        apiGet('/admin/owners').catch(() => ({ owners: [] })),
        apiGet('/admin/bookings').catch(() => ({ bookings: [] })),
      ]);
      setStats(dashData.stats || {});
      setTurfs(turfsData.turfs || []);
      setOwners(ownersData.owners || []);
      setBookings(bookingsData.bookings || []);
      setCommission(dashData.stats?.commission_percent?.toString() || '10');
    } catch (err) {
      console.log('Using empty data');
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('admin');
    router.push('/admin/login');
  }

  // Turf CRUD
  async function handleSaveTurf(e) {
    e.preventDefault();
    try {
      if (editingTurf) {
        await apiPut(`/admin/turfs/${editingTurf.id}`, turfForm);
      } else {
        await apiPost('/admin/turfs', turfForm);
      }
      setShowTurfForm(false);
      setEditingTurf(null);
      loadAllData();
    } catch (err) { alert(err.message); }
  }

  async function handleDeleteTurf(id) {
    if (!confirm('Delete this turf?')) return;
    try { await apiDelete(`/admin/turfs/${id}`); loadAllData(); }
    catch (err) { alert(err.message); }
  }

  async function viewTurfAnalytics(turf) {
    try {
      const data = await apiGet(`/admin/turfs/${turf.id}/earnings`);
      setSelectedTurfAnalytics(turf);
      setTurfEarnings(data);
    } catch (err) {
      alert('Failed to load turf analytics: ' + err.message);
    }
  }

  async function handleDeleteTurfBookings(turfId) {
    if (!confirm('Are you absolutely sure you want to delete ALL bookings for this turf? This cannot be undone.')) return;
    try {
      await apiDelete(`/admin/turfs/${turfId}/bookings`);
      alert('All bookings for this turf deleted.');
      loadAllData();
      setSelectedTurfAnalytics(null);
    } catch (err) {
      alert(err.message);
    }
  }

  // Owner management
  async function approveOwner(id) {
    try { await apiPut(`/admin/owners/${id}/approve`); loadAllData(); }
    catch (err) { alert(err.message); }
  }

  async function rejectOwner(id) {
    try { await apiPut(`/admin/owners/${id}/reject`); loadAllData(); }
    catch (err) { alert(err.message); }
  }

  async function toggleBlockOwner(id, blocked) {
    try { await apiPut(`/admin/owners/${id}/block`, { is_blocked: !blocked }); loadAllData(); }
    catch (err) { alert(err.message); }
  }

  // Booking management
  async function cancelBooking(id) {
    if (!confirm('Cancel this booking?')) return;
    try { await apiPut(`/admin/bookings/${id}/cancel`); loadAllData(); }
    catch (err) { alert(err.message); }
  }

  // Commission update
  async function updateCommission() {
    try { await apiPut('/admin/settings/commission', { commission_percent: parseFloat(commission) }); alert('Commission updated!'); }
    catch (err) { alert(err.message); }
  }

  function editTurf(turf) {
    setEditingTurf(turf);
    setTurfForm({
      name: turf.name, location: turf.location, address: turf.address || '',
      sport_type: turf.sport_type, price_per_hour: turf.price_per_hour,
      description: turf.description || '', images: turf.images || [], amenities: turf.amenities || []
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

  const tabs = [
    { key: 'dashboard', icon: '📊', label: 'Dashboard' },
    { key: 'turfs', icon: '🏟️', label: 'Turfs' },
    { key: 'owners', icon: '👥', label: 'Owners' },
    { key: 'bookings', icon: '📋', label: 'Bookings' },
    { key: 'revenue', icon: '💰', label: 'Revenue' },
  ];

  return (
    <div className="dashboard">
      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <Link href="/" className="navbar-logo" style={{ fontSize: '1.2rem' }}>
            <img src="/images/logo.png" alt="Logo" style={{ width: 32, height: 32, borderRadius: '4px' }} />
            <span style={{ color: 'var(--emerald-400)' }}>Book </span>Arena
          </Link>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.5rem' }}>Platform Control</p>
        </div>

        <ul className="sidebar-nav">
          {tabs.map(tab => (
            <li key={tab.key}>
              <a className={activeTab === tab.key ? 'active' : ''}
                onClick={() => { setActiveTab(tab.key); setSidebarOpen(false); }}
                style={{ cursor: 'pointer' }}>
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </a>
            </li>
          ))}
          <li style={{ marginTop: '2rem' }}>
            <a onClick={handleLogout} style={{ cursor: 'pointer', color: '#f87171' }}>
              <span>🚪</span><span>Logout</span>
            </a>
          </li>
        </ul>
      </aside>

      {/* Main */}
      <main className="dashboard-main">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
          <button className="nav-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
            <span></span><span></span><span></span>
          </button>
          <div style={{ textAlign: sidebarOpen ? 'left' : 'right', flex: 1 }}>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {tabs.find(t => t.key === activeTab)?.icon} {tabs.find(t => t.key === activeTab)?.label}
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Welcome, {admin?.username || 'Admin'} 👑
            </p>
          </div>
        </div>

        {/* ═══════ DASHBOARD ═══════ */}
        {activeTab === 'dashboard' && (
          <div>
            <div className="grid-5" style={{ marginBottom: '2rem' }}>
              {[
                { icon: '🏟️', label: 'Total Turfs', value: stats?.total_turfs || 0, color: 'var(--emerald-400)' },
                { icon: '💹', label: 'Month Revenue', value: formatCompactNumber(stats?.monthly_revenue || 0), color: 'var(--gold-400)' },
                { icon: '📋', label: 'Total Bookings', value: stats?.total_bookings || 0, color: '#3b82f6' },
                { icon: '💰', label: 'Platform Revenue', value: formatCompactNumber(stats?.platform_revenue || 0), color: '#f87171' },
                { icon: '🛡️', label: 'Month Platform', value: formatCompactNumber(stats?.monthly_platform_revenue || 0), color: 'var(--emerald-400)' },
              ].map((s, i) => (
                <div key={i} className="stat-card">
                  <div className="stat-icon">{s.icon}</div>
                  <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
                  <div className="stat-label">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Quick Overview */}
            <div className="grid-2">
              <div className="card" style={{ padding: '1.5rem' }}>
                <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-primary)' }}>
                  📊 Revenue Details
                </h3>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Total Bookings Value</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{formatPrice(stats?.total_revenue || 0)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Commission ({stats?.commission_percent || 10}%)</span>
                  <span style={{ color: 'var(--emerald-400)', fontWeight: 600 }}>{formatPrice(stats?.platform_revenue || 0)}</span>
                </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Paid to Owners</span>
                      <span style={{ fontWeight: 600 }}>{formatPrice((stats?.total_revenue || 0) - (stats?.platform_revenue || 0))}</span>
                    </div>
                  </div>

                  <div className="card" style={{ padding: '1.5rem' }}>
                    <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-primary)' }}>
                      📈 This Month Revenue (Day by Day)
                    </h3>
                    <div style={{ maxHeight: '200px', overflowY: 'auto', paddingRight: '10px' }}>
                      {stats?.daily_revenue && stats.daily_revenue.length > 0 ? (
                        stats.daily_revenue.map((d, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{formatDate(d.date)}</span>
                            <span style={{ color: 'var(--emerald-400)', fontWeight: 700, fontSize: '0.9rem' }}>{formatPrice(d.total)}</span>
                          </div>
                        ))
                      ) : (
                        <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '20px' }}>No revenue recorded this month</p>
                      )}
                    </div>
                  </div>

                  <div className="card" style={{ padding: '1.5rem' }}>
                    <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-primary)' }}>
                      🕐 Recent Activity
                    </h3>
                {bookings.slice(0, 4).map(b => (
                  <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid var(--border-subtle)' }}>
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>{b.customer_name}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{b.turf_name}</div>
                    </div>
                    <span className={`status-badge status-${b.status}`} style={{ fontSize: '0.7rem' }}>{b.status}</span>
                  </div>
                ))}
                {bookings.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No recent activity</p>}
              </div>
            </div>
          </div>
        )}

        {/* ═══════ TURFS ═══════ */}
        {activeTab === 'turfs' && (
          <div>
            <div style={{ marginBottom: '1.5rem' }}>
              <button className="btn btn-primary" onClick={() => {
                setEditingTurf(null);
                setTurfForm({ name: '', location: '', address: '', sport_type: 'cricket', price_per_hour: '', description: '', images: [], amenities: [] });
                setShowTurfForm(!showTurfForm);
              }}>
                ➕ Add Turf
              </button>
            </div>

            {showTurfForm && (
              <div className="card" style={{ padding: '2rem', marginBottom: '2rem' }}>
                <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: '1.5rem' }}>
                  {editingTurf ? '✏️ Edit Turf' : '➕ Add Turf'}
                </h3>
                <form onSubmit={handleSaveTurf}>
                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">Turf Name *</label>
                      <input type="text" className="form-input" value={turfForm.name}
                        onChange={(e) => setTurfForm({ ...turfForm, name: e.target.value })} required />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Location *</label>
                      <input type="text" className="form-input" value={turfForm.location}
                        onChange={(e) => setTurfForm({ ...turfForm, location: e.target.value })} required />
                    </div>
                  </div>
                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">Sport Type *</label>
                      <select className="form-input" value={turfForm.sport_type}
                        onChange={(e) => setTurfForm({ ...turfForm, sport_type: e.target.value })}>
                        {['Cricket', 'Football', 'Badminton', 'Tennis', 'Basketball', 'Volleyball', 'Box Cricket'].map(s => (
                          <option key={s} value={s.toLowerCase()}>{s}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Price per Hour (₹) *</label>
                      <input type="number" className="form-input" value={turfForm.price_per_hour}
                        onChange={(e) => setTurfForm({ ...turfForm, price_per_hour: e.target.value })} required min="0" />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Description</label>
                    <textarea className="form-input" value={turfForm.description}
                      onChange={(e) => setTurfForm({ ...turfForm, description: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Image URLs (comma separated)</label>
                    <input type="text" className="form-input" value={turfForm.images.join(', ')}
                      onChange={(e) => setTurfForm({ ...turfForm, images: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} />
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
                    <button type="submit" className="btn btn-primary">{editingTurf ? '💾 Update' : '➕ Add'}</button>
                    <button type="button" className="btn btn-secondary" onClick={() => setShowTurfForm(false)}>Cancel</button>
                  </div>
                </form>
              </div>
            )}

            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr><th>ID</th><th>Name</th><th>Location</th><th>Sport</th><th>Price</th><th>Owner</th><th>This Month Revenue</th><th>Status</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {turfs.map(t => {
                    const sport = getSportInfo(t.sport_type);
                    return (
                      <tr key={t.id}>
                        <td>#{t.id}</td>
                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{t.name}</td>
                        <td>{t.location}</td>
                        <td>{sport.emoji} {sport.label}</td>
                        <td style={{ fontWeight: 700, color: 'var(--emerald-400)' }}>{formatPrice(t.price_per_hour)}</td>
                        <td>{t.owner_name || '—'}</td>
                        <td style={{ fontWeight: 700, color: 'var(--gold-400)' }}>{formatPrice(t.monthly_revenue)}</td>
                        <td><span className={`status-badge ${t.is_active ? 'status-confirmed' : 'status-cancelled'}`}>{t.is_active ? 'Active' : 'Inactive'}</span></td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => editTurf(t)}>✏️</button>
                            <button className="btn btn-primary btn-sm" onClick={() => viewTurfAnalytics(t)}>📊 Data</button>
                            <button className="btn btn-danger btn-sm" onClick={() => handleDeleteTurf(t.id)}>🗑️</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {turfs.length === 0 && <div className="empty-state"><div className="empty-icon">🏟️</div><h3>No turfs</h3></div>}
            </div>

            {selectedTurfAnalytics && (
              <div className="card" style={{ padding: '2rem', marginTop: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: '1.5rem', color: 'var(--text-primary)' }}>
                    📊 Analytics: {selectedTurfAnalytics.name}
                  </h3>
                  <button className="btn btn-secondary btn-sm" onClick={() => setSelectedTurfAnalytics(null)}>✖ Close</button>
                </div>
                
                <div className="grid-3" style={{ marginBottom: '1.5rem' }}>
                  <div className="stat-card">
                    <div className="stat-value" style={{ color: 'var(--emerald-400)' }}>{formatPrice(turfEarnings?.total || 0)}</div>
                    <div className="stat-label">Total Revenue</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value" style={{ color: 'var(--gold-400)' }}>{turfEarnings?.daily?.reduce((acc, d) => acc + d.total, 0) ? formatPrice(turfEarnings.daily.reduce((acc, d) => acc + d.total, 0)) : '₹0'}</div>
                    <div className="stat-label">30-Day Revenue</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value" style={{ color: '#3b82f6' }}>{turfEarnings?.monthly?.length > 0 ? formatPrice(turfEarnings.monthly[0].total) : '₹0'}</div>
                    <div className="stat-label">This Month Revenue</div>
                  </div>
                </div>

                <div className="grid-2">
                  <div>
                    <h4 style={{ marginBottom: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>Last 30 Days Revenue</h4>
                    <div style={{ maxHeight: '200px', overflowY: 'auto', marginBottom: '1.5rem', paddingRight: '10px' }}>
                      {turfEarnings?.daily?.length > 0 ? (
                        turfEarnings.daily.map((d, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--border-subtle)' }}>
                            <span style={{ color: 'var(--text-muted)' }}>{formatDate(d.date)}</span>
                            <span style={{ fontWeight: 600, color: 'var(--emerald-400)' }}>{formatPrice(d.total)}</span>
                          </div>
                        ))
                      ) : (
                        <p style={{ color: 'var(--text-muted)' }}>No revenue in last 30 days.</p>
                      )}
                    </div>
                  </div>
                  <div>
                    <h4 style={{ marginBottom: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>Monthly History</h4>
                    <div style={{ maxHeight: '200px', overflowY: 'auto', marginBottom: '1.5rem', paddingRight: '10px' }}>
                      {turfEarnings?.monthly?.length > 0 ? (
                        turfEarnings.monthly.map((m, i) => {
                          const dateObj = new Date(m.year, m.month - 1);
                          return (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--border-subtle)' }}>
                              <span style={{ color: 'var(--text-muted)' }}>{dateObj.toLocaleString('default', { month: 'long', year: 'numeric' })}</span>
                              <span style={{ fontWeight: 600, color: '#3b82f6' }}>{formatPrice(m.total)}</span>
                            </div>
                          );
                        })
                      ) : (
                        <p style={{ color: 'var(--text-muted)' }}>No monthly revenue recorded.</p>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ padding: '1.5rem', background: 'rgba(239,68,68,0.05)', borderRadius: '12px', border: '1px solid rgba(239,68,68,0.2)', marginTop: '2rem' }}>
                  <h4 style={{ color: '#ef4444', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '1.2rem' }}>⚠</span> Danger Zone
                  </h4>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                    This action will permanently delete <strong>all booking records, payments, and revenue history</strong> associated with <strong>{selectedTurfAnalytics.name}</strong>. This action is irreversible.
                  </p>
                  <button className="btn btn-danger" onClick={() => handleDeleteTurfBookings(selectedTurfAnalytics.id)}>
                    🗑️ Delete All Bookings Data
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════ OWNERS ═══════ */}
        {activeTab === 'owners' && (
          <div>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr><th>ID</th><th>Name</th><th>Email</th><th>Phone</th><th>Status</th><th>Registered</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {owners.map(o => (
                    <tr key={o.id}>
                      <td>#{o.id}</td>
                      <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{o.name}</td>
                      <td>{o.email}</td>
                      <td>{o.phone}</td>
                      <td>
                        {o.is_blocked ? (
                          <span className="status-badge status-cancelled">Blocked</span>
                        ) : o.is_approved ? (
                          <span className="status-badge status-confirmed">Approved</span>
                        ) : (
                          <span className="status-badge status-pending">Pending</span>
                        )}
                      </td>
                      <td>{formatDate(o.created_at)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                          {!o.is_approved && !o.is_blocked && (
                            <>
                              <button className="btn btn-primary btn-sm" onClick={() => approveOwner(o.id)}>✅ Approve</button>
                              <button className="btn btn-danger btn-sm" onClick={() => rejectOwner(o.id)}>❌ Reject</button>
                            </>
                          )}
                          <button
                            className={`btn btn-sm ${o.is_blocked ? 'btn-primary' : 'btn-danger'}`}
                            onClick={() => toggleBlockOwner(o.id, o.is_blocked)}
                          >
                            {o.is_blocked ? '🔓 Unblock' : '🔒 Block'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {owners.length === 0 && <div className="empty-state"><div className="empty-icon">👥</div><h3>No owners registered</h3></div>}
            </div>
          </div>
        )}

        {/* ═══════ BOOKINGS ═══════ */}
        {activeTab === 'bookings' && (
          <div>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr><th>ID</th><th>Customer</th><th>Turf</th><th>Date/Slot</th><th>Payment ID</th><th>Gross</th><th>Owner Net</th><th>Our Comm.</th><th>Status</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {bookings.map(b => {
                    const comm = (b.amount * (stats?.commission_percent || 10)) / 100;
                    return (
                    <tr key={b.id}>
                      <td>#{b.id}</td>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{b.customer_name}</div>
                        <div style={{ fontSize: '0.8rem' }}>{b.customer_phone}</div>
                      </td>
                      <td>{b.turf_name || `Turf #${b.turf_id}`}</td>
                      <td>{formatDate(b.booking_date)}<br/><span style={{ color: 'var(--emerald-400)' }}>{b.time_slot}</span></td>
                      <td style={{ fontSize: '0.75rem', fontFamily: 'monospace' }}>{b.payment_id || '—'}</td>
                      <td style={{ fontWeight: 700 }}>{formatPrice(b.amount)}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{formatPrice(b.amount - comm)}</td>
                      <td style={{ color: 'var(--emerald-400)', fontWeight: 800 }}>+{formatPrice(comm)}</td>
                      <td><span className={`status-badge status-${b.status}`}>{b.status}</span></td>
                      <td>
                        {b.status !== 'cancelled' && (
                          <button className="btn btn-danger btn-sm" onClick={() => cancelBooking(b.id)}>
                            Cancel
                          </button>
                        )}
                      </td>
                    </tr>
                  )})}
                </tbody>
              </table>
              {bookings.length === 0 && <div className="empty-state"><div className="empty-icon">📋</div><h3>No bookings yet</h3></div>}
            </div>
          </div>
        )}

        {/* ═══════ REVENUE ═══════ */}
        {activeTab === 'revenue' && (
          <div>
            <div className="grid-3" style={{ marginBottom: '2rem' }}>
              {[
                { icon: '💰', label: 'Total Bookings Value', value: formatCompactNumber(stats?.total_revenue || 0), color: 'var(--emerald-400)' },
                { icon: '👑', label: 'Platform Revenue', value: formatCompactNumber(stats?.platform_revenue || 0), color: 'var(--gold-400)' },
                { icon: '📊', label: 'Commission Rate', value: `${stats?.commission_percent || 10}%`, color: '#3b82f6' },
              ].map((s, i) => (
                <div key={i} className="stat-card">
                  <div className="stat-icon">{s.icon}</div>
                  <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
                  <div className="stat-label">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Commission Settings */}
            <div className="card" style={{ padding: '2rem', maxWidth: '500px' }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-primary)' }}>
                ⚙️ Commission Settings
              </h3>
              <div className="form-group">
                <label className="form-label">Commission Percentage (%)</label>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <input type="number" className="form-input" value={commission} min="0" max="100" step="0.5"
                    onChange={(e) => setCommission(e.target.value)} style={{ maxWidth: '150px' }} />
                  <button className="btn btn-primary" onClick={updateCommission}>💾 Update</button>
                </div>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                This percentage is deducted from each booking as platform fees
              </p>
            </div>

            {/* Service Fee Settings */}
            <div className="card" style={{ padding: '2rem', maxWidth: '500px', marginTop: '2rem' }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-primary)' }}>
                🛡️ Platform Service Fee (Admin Only)
              </h3>
              <div className="grid-2" style={{ gap: '1rem', marginBottom: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Fee Type</label>
                  <select 
                    className="form-input" 
                    value={stats?.service_fee_type || 'fixed'}
                    onChange={(e) => setStats({...stats, service_fee_type: e.target.value})}
                  >
                    <option value="fixed">Fixed Amount (₹)</option>
                    <option value="percentage">Percentage (%)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Fee Value</label>
                  <input 
                    type="number" 
                    className="form-input" 
                    value={stats?.service_fee || 20} 
                    min="0" 
                    onChange={(e) => setStats({...stats, service_fee: e.target.value})}
                  />
                </div>
              </div>
              <button 
                className="btn btn-primary" 
                style={{ width: '100%' }}
                onClick={async () => {
                  try {
                    await apiPut('/admin/settings/service-fee', { 
                      service_fee: parseFloat(stats.service_fee),
                      service_fee_type: stats.service_fee_type || 'fixed'
                    });
                    alert('Service fee updated!');
                    loadAllData();
                  } catch (err) { alert(err.message); }
                }}
              >
                💾 Save Service Fee Settings
              </button>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '1rem' }}>
                This fee is added to bookings AFTER all discounts. Turf owners cannot change this.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
