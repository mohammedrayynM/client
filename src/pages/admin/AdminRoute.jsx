import React, { useState, useEffect } from 'react';
import { apiGet, apiPut, apiPost } from '@/lib/api';
import { formatDate, formatPrice } from '@/lib/constants';

export default function AdminRoute() {
  const [loading, setLoading] = useState(true);
  const [turfs, setTurfs] = useState([]);
  const [selectedTurf, setSelectedTurf] = useState(null);
  const [transfers, setTransfers] = useState([]);
  const [auditLog, setAuditLog] = useState([]);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // Edit Config Modal State
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [configForm, setConfigForm] = useState({
    route_commission_type: 'percentage', // 'percentage' | 'flat' | 'subscription'
    route_split_percentage: '',
    route_flat_amount: '',
    monthly_subscription_amount: '',
    route_linked_account_id: '',
    route_environment: 'test',
    confirm_live_text: '',
  });
  const [savingConfig, setSavingConfig] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const loadTurfs = async () => {
    setLoading(true);
    try {
      const res = await apiGet('/admin/route/turfs');
      if (res.success) {
        setTurfs(res.turfs || []);
      }
    } catch (err) {
      console.error('Error fetching route turfs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTurfs();
  }, []);

  const loadTurfDetails = async (turfId) => {
    setDetailsLoading(true);
    try {
      const res = await apiGet(`/admin/route/turfs/${turfId}`);
      if (res.success) {
        setSelectedTurf(res.turf);
        setTransfers(res.transfers || []);
        setAuditLog(res.audit_log || []);
      }
    } catch (err) {
      alert(err.message || 'Failed to load turf route details');
    } finally {
      setDetailsLoading(false);
    }
  };

  const openConfigModal = (turf) => {
    setConfigForm({
      route_commission_type: turf.route_commission_type || 'percentage',
      route_split_percentage: turf.route_split_percentage ?? '',
      route_flat_amount: turf.route_flat_amount ?? '',
      monthly_subscription_amount: turf.monthly_subscription_amount ?? '',
      route_linked_account_id: turf.route_linked_account_id || '',
      route_environment: turf.route_environment || 'test',
      confirm_live_text: '',
    });
    setConfigModalOpen(true);
  };

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    if (!selectedTurf) return;
    const amount = configForm.route_commission_type === 'percentage' ? configForm.route_split_percentage
      : configForm.route_commission_type === 'flat' ? configForm.route_flat_amount : configForm.monthly_subscription_amount;
    if (amount === '' || amount === null || amount === undefined || !Number.isFinite(Number(amount)) || Number(amount) < 0) {
      alert('Enter a valid price or percentage for the selected billing model.');
      return;
    }
    setSavingConfig(true);
    try {
      const payload = {
        route_commission_type: configForm.route_commission_type,
        route_split_percentage: configForm.route_commission_type === 'percentage' ? Number(configForm.route_split_percentage) : undefined,
        route_flat_amount: configForm.route_commission_type === 'flat' ? Number(configForm.route_flat_amount) : undefined,
        monthly_subscription_amount: configForm.route_commission_type === 'subscription' ? Number(configForm.monthly_subscription_amount) : undefined,
        route_linked_account_id: configForm.route_linked_account_id.trim(),
        route_environment: configForm.route_environment,
        confirm_live_text: configForm.confirm_live_text,
      };

      const res = await apiPut(`/admin/route/turfs/${selectedTurf.id}/config`, payload);
      if (res.success) {
        setConfigModalOpen(false);
        loadTurfDetails(selectedTurf.id);
        loadTurfs();
      }
    } catch (err) {
      alert(err.message || 'Failed to save configuration');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedTurf) return;
    setActionLoading(true);
    try {
      await apiPost(`/admin/route/turfs/${selectedTurf.id}/approve`, {});
      loadTurfDetails(selectedTurf.id);
      loadTurfs();
    } catch (err) {
      alert(err.message || 'Approval failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleEnable = async () => {
    if (!selectedTurf) return;
    setActionLoading(true);
    try {
      if (selectedTurf.route_enabled) {
        await apiPost(`/admin/route/turfs/${selectedTurf.id}/disable`, {});
      } else {
        await apiPost(`/admin/route/turfs/${selectedTurf.id}/enable`, {});
      }
      loadTurfDetails(selectedTurf.id);
      loadTurfs();
    } catch (err) {
      alert(err.message || 'Toggle failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReconcile = async () => {
    if (!selectedTurf) return;
    setActionLoading(true);
    try {
      const res = await apiPost(`/admin/route/turfs/${selectedTurf.id}/reconcile`, {});
      const todo = res.needs_action || [];
      alert(todo.length
        ? `Checked ${res.scanned} payment(s) from the last 30 days. ${todo.length} need attention:\n\n${todo.slice(0, 8).map((t) => `• ${t.payment_id}: ${t.reason}`).join('\n')}${todo.length > 8 ? `\n…and ${todo.length - 8} more` : ''}\n\nOpen Finance → Payment lookup to review and confirm each one. Nothing was transferred automatically.`
        : `Checked ${res.scanned} payment(s) from the last 30 days. Everything is reconciled.${(res.unreadable || []).length ? ` (${res.unreadable.length} could not be read from Razorpay right now.)` : ''}`);
      loadTurfDetails(selectedTurf.id);
    } catch (err) {
      alert(err.message || 'Reconciliation failed');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff', margin: 0 }}>
            ⚡ Razorpay Route & Payment Distribution
          </h2>
          <p style={{ color: 'var(--text-muted, #94a3b8)', fontSize: '0.85rem', marginTop: '0.25rem', marginBottom: 0 }}>
            Configure venue monetization models, bind official Razorpay linked accounts, and monitor automated split transfers.
          </p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={loadTurfs}>
          🔄 Refresh
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selectedTurf ? '1fr 1.3fr' : '1fr', gap: '1.5rem' }}>
        {/* Venues Table */}
        <div className="card" style={{ padding: '1.25rem', background: 'var(--bg-card, #131d2f)' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff', marginBottom: '1rem' }}>
            Venue Accounts & Monetization
          </h3>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}><div className="loader"></div></div>
          ) : turfs.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No venues found.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Venue</th>
                    <th>Linked Account</th>
                    <th>Model</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {turfs.map(t => {
                    const isSelected = selectedTurf?.id === t.id;
                    return (
                      <tr
                        key={t.id}
                        style={{ background: isSelected ? 'rgba(16, 185, 129, 0.08)' : 'transparent', cursor: 'pointer' }}
                        onClick={() => loadTurfDetails(t.id)}
                      >
                        <td>
                          <div style={{ fontWeight: 700, color: '#fff' }}>{t.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.owner_name}</div>
                        </td>
                        <td>
                          {t.route_linked_account_id ? (
                            <code style={{ fontSize: '0.75rem', background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: '4px', color: '#60a5fa' }}>
                              {t.route_linked_account_id}
                            </code>
                          ) : (
                            <span style={{ fontSize: '0.75rem', color: '#f87171' }}>Not linked</span>
                          )}
                        </td>
                        <td>
                          <span style={{
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: 'rgba(255,255,255,0.05)',
                            color: '#cbd5e1'
                          }}>
                            {t.route_commission_type === 'percentage' && `${t.route_split_percentage || 0}%`}
                            {t.route_commission_type === 'flat' && `₹${t.route_flat_amount || 0}/bk`}
                            {t.route_commission_type === 'subscription' && 'Subscription'}
                            {!t.route_commission_type && 'None'}
                          </span>
                        </td>
                        <td>
                          <span style={{
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '999px',
                            background: t.route_enabled ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                            color: t.route_enabled ? '#34d399' : '#f87171',
                          }}>
                            {t.route_enabled ? '● Active' : '○ Disabled'}
                          </span>
                        </td>
                        <td>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTurf(t);
                              openConfigModal(t);
                            }}
                          >
                            ⚙️ Setup
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Selected Venue Route Details */}
        {selectedTurf && (
          <div style={{ display: 'grid', gap: '1.25rem' }}>
            <div className="card" style={{ padding: '1.5rem', background: 'var(--bg-card, #131d2f)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
                <div>
                  <span style={{
                    fontSize: '0.75rem',
                    textTransform: 'uppercase',
                    fontWeight: 700,
                    letterSpacing: '0.05em',
                    color: selectedTurf.route_environment === 'live' ? '#ef4444' : '#60a5fa'
                  }}>
                    {selectedTurf.route_environment?.toUpperCase()} ENVIRONMENT
                  </span>
                  <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#fff', margin: '0.2rem 0' }}>
                    {selectedTurf.name}
                  </h3>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Owner: <strong>{selectedTurf.owner_name}</strong>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => openConfigModal(selectedTurf)}
                  >
                    ✏️ Edit Config
                  </button>
                  {selectedTurf.route_status === 'configured' && (
                    <button
                      className="btn btn-sm"
                      style={{ background: '#3b82f6', color: '#fff', fontWeight: 700 }}
                      onClick={handleApprove}
                      disabled={actionLoading}
                    >
                      ✓ Sign Off / Approve
                    </button>
                  )}
                  {selectedTurf.route_status === 'approved' && (
                    <button
                      className="btn btn-sm"
                      style={{
                        background: selectedTurf.route_enabled ? '#ef4444' : '#10b981',
                        color: selectedTurf.route_enabled ? '#fff' : '#000',
                        fontWeight: 700
                      }}
                      onClick={handleToggleEnable}
                      disabled={actionLoading}
                    >
                      {selectedTurf.route_enabled ? 'Disable Route' : 'Activate Live Route'}
                    </button>
                  )}
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={handleReconcile}
                    disabled={actionLoading}
                  >
                    🔄 Reconcile
                  </button>
                </div>
              </div>

              {/* Status and Config Details */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '12px' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Linked Account ID</div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#60a5fa', marginTop: '0.2rem' }}>
                    {selectedTurf.route_linked_account_id || 'Not configured'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Monetization Model</div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#34d399', marginTop: '0.2rem' }}>
                    {selectedTurf.route_commission_type === 'percentage' && `${selectedTurf.route_split_percentage}% Platform Commission`}
                    {selectedTurf.route_commission_type === 'flat' && `₹${selectedTurf.route_flat_amount} Flat Fee per Booking`}
                    {selectedTurf.route_commission_type === 'subscription' && `Monthly Subscription (₹${selectedTurf.monthly_subscription_amount ?? 'Not configured'}/mo)`}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Route State</div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#fff', marginTop: '0.2rem' }}>
                    {selectedTurf.route_status} {selectedTurf.route_enabled ? '(Active)' : '(Inactive)'}
                  </div>
                </div>
              </div>
            </div>

            {/* Split Transfers Ledger */}
            <div className="card" style={{ padding: '1.25rem', background: 'var(--bg-card, #131d2f)' }}>
              <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#fff', marginBottom: '0.75rem' }}>
                Split Transfers Ledger (Recent 20)
              </h4>
              {transfers.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No split transfers recorded for this venue yet.</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="data-table" style={{ fontSize: '0.8rem' }}>
                    <thead>
                      <tr>
                        <th>Transfer ID</th>
                        <th>Booking ID</th>
                        <th>Gross</th>
                        <th>Transferred</th>
                        <th>Fee</th>
                        <th>Status</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transfers.map(tr => (
                        <tr key={tr.id}>
                          <td><code>{tr.transfer_id || '—'}</code></td>
                          <td><code>{tr.booking_id}</code></td>
                          <td>₹{tr.amount}</td>
                          <td style={{ color: '#10b981', fontWeight: 700 }}>₹{tr.transferred_amount || tr.amount}</td>
                          <td style={{ color: '#fbbf24' }}>₹{tr.platform_fee || 0}</td>
                          <td>
                            <span style={{
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              background: tr.transfer_status === 'processed' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                              color: tr.transfer_status === 'processed' ? '#34d399' : '#f87171'
                            }}>
                              {tr.transfer_status}
                            </span>
                          </td>
                          <td>{formatDate(tr.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Configuration Modal */}
      {configModalOpen && (
        <div className="modal-overlay" onClick={() => setConfigModalOpen(false)}>
          <div
            className="modal"
            style={{ maxWidth: '580px', padding: '1.75rem', background: 'var(--bg-card, #131d2f)' }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ color: '#fff', fontWeight: 800, margin: '0 0 0.5rem 0' }}>
              ⚙️ Configure Razorpay Route: {selectedTurf?.name}
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              Select a mutually exclusive monetization model and specify the verified Razorpay Linked Account ID.
            </p>

            <form onSubmit={handleSaveConfig}>
              {/* Linked Account ID */}
              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="form-label" style={{ fontWeight: 600, color: '#e2e8f0' }}>
                  Razorpay Linked Account ID *
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="acc_XXXXXXXXXXXXXX"
                  value={configForm.route_linked_account_id}
                  onChange={e => setConfigForm({ ...configForm, route_linked_account_id: e.target.value })}
                  required
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Provided by Razorpay dashboard after owner completes linked account KYC.
                </span>
              </div>

              {/* Monetization Model Selection */}
              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="form-label" style={{ fontWeight: 600, color: '#e2e8f0' }}>
                  Monetization Billing Model *
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                  {[
                    { id: 'percentage', label: 'Percentage (%)', desc: 'Deduct % per booking' },
                    { id: 'flat', label: 'Flat Fee (₹)', desc: 'Fixed fee per booking' },
                    { id: 'subscription', label: 'Subscription', desc: 'Deduct from proceeds' },
                  ].map(m => (
                    <label
                      key={m.id}
                      style={{
                        padding: '0.75rem',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        border: configForm.route_commission_type === m.id ? '1px solid #10b981' : '1px solid rgba(255,255,255,0.08)',
                        background: configForm.route_commission_type === m.id ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255,255,255,0.02)',
                        textAlign: 'center',
                      }}
                    >
                      <input
                        type="radio"
                        name="commission_type"
                        value={m.id}
                        checked={configForm.route_commission_type === m.id}
                        onChange={() => setConfigForm({ ...configForm, route_commission_type: m.id })}
                        style={{ display: 'none' }}
                      />
                      <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#fff' }}>{m.label}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{m.desc}</div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Conditional Model Input */}
              {configForm.route_commission_type === 'percentage' && (
                <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                  <label className="form-label" style={{ fontWeight: 600, color: '#e2e8f0' }}>Platform Commission (%)</label>
                  <input
                    type="number"
                    className="form-input"
                    step="0.1"
                    min="0"
                    max="100"
                    value={configForm.route_split_percentage}
                    onChange={e => setConfigForm({ ...configForm, route_split_percentage: e.target.value })}
                    required
                  />
                </div>
              )}

              {configForm.route_commission_type === 'flat' && (
                <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                  <label className="form-label" style={{ fontWeight: 600, color: '#e2e8f0' }}>Flat Platform Fee per Booking (₹)</label>
                  <input
                    type="number"
                    className="form-input"
                    min="0"
                    value={configForm.route_flat_amount}
                    onChange={e => setConfigForm({ ...configForm, route_flat_amount: e.target.value })}
                    required
                  />
                </div>
              )}

              {configForm.route_commission_type === 'subscription' && (
                <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                  <label className="form-label" style={{ fontWeight: 600, color: '#e2e8f0' }}>Monthly Subscription Fee (₹)</label>
                  <input
                    type="number"
                    className="form-input"
                    min="0"
                    value={configForm.monthly_subscription_amount}
                    onChange={e => setConfigForm({ ...configForm, monthly_subscription_amount: e.target.value })}
                    required
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Deducted from owner booking proceeds until the monthly cycle fee is satisfied.
                  </span>
                </div>
              )}

              {/* Environment Selection */}
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="form-label" style={{ fontWeight: 600, color: '#e2e8f0' }}>Environment</label>
                <select
                  className="form-input"
                  value={configForm.route_environment}
                  onChange={e => setConfigForm({ ...configForm, route_environment: e.target.value })}
                >
                  <option value="test">Test / Sandbox (Mock Transfers)</option>
                  <option value="live">Live (Real Banking Transfers)</option>
                </select>
              </div>

              {configForm.route_environment === 'live' && (
                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                  <label className="form-label" style={{ fontWeight: 600, color: '#f87171' }}>
                    Type "ENABLE LIVE PAYOUTS" to confirm live mode:
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="ENABLE LIVE PAYOUTS"
                    value={configForm.confirm_live_text}
                    onChange={e => setConfigForm({ ...configForm, confirm_live_text: e.target.value })}
                    required
                  />
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setConfigModalOpen(false)}
                  disabled={savingConfig}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={savingConfig}
                >
                  {savingConfig ? 'Saving...' : '💾 Save Configuration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
