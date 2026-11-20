import React, { useState, useEffect } from 'react';
import { apiGet, apiPut } from '@/lib/api';
import { formatDate, formatPrice, VENUE_CATEGORIES } from '@/lib/constants';

export default function AdminApprovals({ onUpdateCount }) {
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [pendingVenues, setPendingVenues] = useState([]);
  const [pendingCourts, setPendingCourts] = useState([]);
  const [activeSubTab, setActiveSubTab] = useState('venues'); // 'venues' | 'courts'

  // Action Modal State
  const [actionModal, setActionModal] = useState({
    isOpen: false,
    type: 'venue', // 'venue' | 'court'
    item: null,
    status: 'APPROVED', // 'APPROVED' | 'ACTION_REQUIRED' | 'REJECTED'
    feedback: '',
    submitting: false,
  });

  // Billing Model assignment state (required when approving a venue)
  const [billingModel, setBillingModel] = useState('PERCENTAGE'); // 'PERCENTAGE' | 'FLAT' | 'SUBSCRIPTION'
  const [commissionPercent, setCommissionPercent] = useState('5');
  const [flatFee, setFlatFee] = useState('50');
  const [subscriptionAmount, setSubscriptionAmount] = useState('799');
  const [subscriptionPeriod, setSubscriptionPeriod] = useState('MONTHLY');
  const [subscriptionPolicy, setSubscriptionPolicy] = useState('DEDUCT_FROM_PROCEEDS');
  const [subscriptionStartDate, setSubscriptionStartDate] = useState(() => new Date().toISOString().slice(0, 10));

  const loadApprovals = async () => {
    setLoading(true);
    setFetchError('');
    try {
      const res = await apiGet('/admin/pending-approvals');
      if (res && res.success) {
        const venues = res.pendingVenues || res.pending_turfs || [];
        const courts = res.pendingCourts || res.pending_courts || [];
        setPendingVenues(venues);
        setPendingCourts(courts);
        if (onUpdateCount) {
          onUpdateCount(venues.length + courts.length);
        }
      } else {
        throw new Error(res?.error || 'Failed to retrieve pending approvals');
      }
    } catch (err) {
      console.error('Error fetching pending approvals:', err);
      setFetchError(err.message || 'Failed to load approvals. Please check your connection and retry.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApprovals();
  }, []);

  const openActionModal = (type, item, status) => {
    // Pre-populate billing fields if item has existing values
    if (type === 'venue') {
      const existingModel = item.billing_model === 'MONTHLY' ? 'SUBSCRIPTION' : (item.billing_model || 'PERCENTAGE');
      setBillingModel(existingModel);
      if (item.commission_percentage != null) setCommissionPercent(String(item.commission_percentage));
      if (item.route_flat_amount != null) setFlatFee(String(item.route_flat_amount));
      if (item.monthly_subscription_amount != null) setSubscriptionAmount(String(item.monthly_subscription_amount));
      if (item.subscription_start_date) {
        const sDate = String(item.subscription_start_date).slice(0, 10);
        setSubscriptionStartDate(sDate);
      } else {
        setSubscriptionStartDate(new Date().toISOString().slice(0, 10));
      }
    }

    setActionModal({
      isOpen: true,
      type,
      item,
      status,
      feedback: item.admin_feedback || '',
      submitting: false,
    });
  };

  const handleConfirmAction = async () => {
    const { type, item, status, feedback } = actionModal;
    if (!item) return;

    // Validate billing inputs if approving a venue
    let billing_config = null;
    if (type === 'venue' && status === 'APPROVED') {
      if (billingModel === 'PERCENTAGE') {
        const val = parseFloat(commissionPercent);
        if (isNaN(val) || val < 0 || val > 100) {
          alert('Please enter a valid commission percentage between 0 and 100%.');
          return;
        }
        billing_config = {
          billing_model: 'PERCENTAGE',
          commission_percent: val,
        };
      } else if (billingModel === 'FLAT') {
        const val = parseFloat(flatFee);
        if (isNaN(val) || val < 0) {
          alert('Please enter a valid non-negative fixed fee amount.');
          return;
        }
        billing_config = {
          billing_model: 'FLAT',
          flat_fee: val,
        };
      } else if (billingModel === 'SUBSCRIPTION') {
        const val = parseFloat(subscriptionAmount);
        if (isNaN(val) || val <= 0) {
          alert('Please enter a valid positive subscription amount.');
          return;
        }
        if (!subscriptionStartDate) {
          alert('Please select a valid subscription start date.');
          return;
        }
        billing_config = {
          billing_model: 'SUBSCRIPTION',
          subscription_amount: val,
          subscription_period: subscriptionPeriod,
          subscription_policy: subscriptionPolicy,
          subscription_start_date: subscriptionStartDate,
        };
      }
    }

    setActionModal(prev => ({ ...prev, submitting: true }));
    try {
      if (type === 'venue') {
        await apiPut(`/admin/turfs/${item.id}/approval`, {
          approval_status: status,
          status,
          admin_feedback: feedback,
          billing_config,
        });
      } else {
        await apiPut(`/admin/courts/${item.id}/approval`, {
          approval_status: status,
          status,
          admin_feedback: feedback,
        });
      }
      setActionModal({ isOpen: false, type: 'venue', item: null, status: 'APPROVED', feedback: '', submitting: false });
      await loadApprovals();
    } catch (err) {
      alert(err.message || 'Action failed. Please try again.');
      setActionModal(prev => ({ ...prev, submitting: false }));
    }
  };

  return (
    <div>
      {/* Header and Sub-Tabs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff', margin: 0 }}>
            🛡️ Review & Approval Center
          </h2>
          <p style={{ color: 'var(--text-muted, #94a3b8)', fontSize: '0.85rem', marginTop: '0.25rem', marginBottom: 0 }}>
            Review new venue registrations, categories, and newly created courts before they become bookable.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className={`btn btn-sm ${activeSubTab === 'venues' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveSubTab('venues')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            🏟️ Pending Venues ({pendingVenues.length})
          </button>
          <button
            className={`btn btn-sm ${activeSubTab === 'courts' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveSubTab('courts')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            🎾 Pending Courts ({pendingCourts.length})
          </button>
          <button className="btn btn-sm btn-secondary" onClick={loadApprovals}>
            🔄 Refresh
          </button>
        </div>
      </div>

      {fetchError && (
        <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <strong style={{ color: '#ef4444', display: 'block', marginBottom: '0.25rem' }}>⚠️ Unable to load pending approvals</strong>
            <span style={{ color: '#fca5a5', fontSize: '0.85rem' }}>{fetchError}</span>
          </div>
          <button className="btn btn-sm btn-secondary" onClick={loadApprovals}>Retry</button>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <div className="loader"></div>
        </div>
      ) : activeSubTab === 'venues' ? (
        /* PENDING VENUES LIST */
        pendingVenues.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '3.5rem 1rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎉</div>
            <h3 style={{ color: '#fff', fontWeight: 700 }}>No Pending Venues</h3>
            <p style={{ color: 'var(--text-muted)' }}>All venue registrations have been reviewed and approved.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '1.25rem' }}>
            {pendingVenues.map(venue => {
              const catObj = VENUE_CATEGORIES[venue.category] || VENUE_CATEGORIES.sports_court;
              return (
                <div
                  key={venue.id}
                  className="card"
                  style={{
                    padding: '1.5rem',
                    background: 'var(--bg-card, #131d2f)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '16px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                    <div style={{ flex: 1, minWidth: '280px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', margin: 0 }}>
                          {venue.name}
                        </h3>
                        <span style={{
                          padding: '0.2rem 0.6rem',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          background: 'rgba(245, 158, 11, 0.15)',
                          color: '#fbbf24',
                          border: '1px solid rgba(245, 158, 11, 0.3)'
                        }}>
                          {venue.approval_status || 'PENDING_APPROVAL'}
                        </span>
                        <span style={{
                          padding: '0.2rem 0.6rem',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          background: 'rgba(16, 185, 129, 0.15)',
                          color: '#34d399'
                        }}>
                          {catObj?.icon} {catObj?.shortTitle || venue.category}
                        </span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginTop: '0.75rem', fontSize: '0.85rem' }}>
                        <div>
                          <span style={{ color: 'var(--text-muted)' }}>Owner: </span>
                          <strong style={{ color: '#fff' }}>{venue.owner_name}</strong> ({venue.owner_email || '—'}, {venue.owner_phone || '—'})
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-muted)' }}>Location: </span>
                          <strong style={{ color: '#fff' }}>{venue.city}, {venue.state || ''} ({venue.country_code || 'IN'})</strong>
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-muted)' }}>Booking Model: </span>
                          <strong style={{ color: '#10b981' }}>{venue.booking_model || 'SLOT'}</strong>
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-muted)' }}>Currency: </span>
                          <strong style={{ color: '#fbbf24' }}>{venue.currency_code || 'INR'}</strong> ({venue.timezone || 'UTC'})
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-muted)' }}>Base Price: </span>
                          <strong style={{ color: '#fff' }}>{formatPrice(venue.price_per_hour, venue.currency_code)}</strong>
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-muted)' }}>Submitted: </span>
                          <span style={{ color: '#cbd5e1' }}>{formatDate(venue.created_at)}</span>
                        </div>
                      </div>

                      <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        <strong>Address: </strong>{venue.address}
                      </div>

                      {venue.admin_feedback && (
                        <div style={{
                          marginTop: '0.75rem',
                          padding: '0.6rem 0.9rem',
                          borderRadius: '8px',
                          background: 'rgba(239, 68, 68, 0.08)',
                          border: '1px solid rgba(239, 68, 68, 0.2)',
                          color: '#fca5a5',
                          fontSize: '0.8rem'
                        }}>
                          <strong>Previous Feedback: </strong>{venue.admin_feedback}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <button
                        className="btn btn-sm"
                        style={{ background: '#10b981', color: '#000', fontWeight: 700 }}
                        onClick={() => openActionModal('venue', venue, 'APPROVED')}
                      >
                        ✓ Approve & Activate
                      </button>
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => openActionModal('venue', venue, 'ACTION_REQUIRED')}
                      >
                        ⚠️ Request Corrections
                      </button>
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => openActionModal('venue', venue, 'REJECTED')}
                      >
                        ✕ Reject
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* PENDING COURTS LIST */
        pendingCourts.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '3.5rem 1rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎾</div>
            <h3 style={{ color: '#fff', fontWeight: 700 }}>No Pending Courts</h3>
            <p style={{ color: 'var(--text-muted)' }}>All added courts have been reviewed and approved.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '1.25rem' }}>
            {pendingCourts.map(court => (
              <div
                key={court.id}
                className="card"
                style={{
                  padding: '1.5rem',
                  background: 'var(--bg-card, #131d2f)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '16px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                  <div style={{ flex: 1, minWidth: '280px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                      <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff', margin: 0 }}>
                        {court.name}
                      </h3>
                      <span style={{
                        padding: '0.2rem 0.6rem',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        background: 'rgba(245, 158, 11, 0.15)',
                        color: '#fbbf24',
                        border: '1px solid rgba(245, 158, 11, 0.3)'
                      }}>
                        {court.approval_status || 'PENDING_APPROVAL'}
                      </span>
                      <span style={{
                        padding: '0.2rem 0.6rem',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        background: 'rgba(59, 130, 246, 0.15)',
                        color: '#60a5fa'
                      }}>
                        {court.sport_type}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginTop: '0.75rem', fontSize: '0.85rem' }}>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Parent Venue: </span>
                        <strong style={{ color: '#fff' }}>{court.turf_name}</strong> ({court.city})
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Owner: </span>
                        <strong style={{ color: '#fff' }}>{court.owner_name}</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Price per Hour: </span>
                        <strong style={{ color: '#10b981' }}>{formatPrice(court.price_per_hour, court.currency_code)}</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Slot Duration: </span>
                        <strong style={{ color: '#cbd5e1' }}>{court.slot_duration} minutes</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Operating Hours: </span>
                        <span style={{ color: '#cbd5e1' }}>{court.open_time} - {court.close_time}</span>
                      </div>
                    </div>

                    {court.admin_feedback && (
                      <div style={{
                        marginTop: '0.75rem',
                        padding: '0.6rem 0.9rem',
                        borderRadius: '8px',
                        background: 'rgba(239, 68, 68, 0.08)',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        color: '#fca5a5',
                        fontSize: '0.8rem'
                      }}>
                        <strong>Previous Feedback: </strong>{court.admin_feedback}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button
                      className="btn btn-sm"
                      style={{ background: '#10b981', color: '#000', fontWeight: 700 }}
                      onClick={() => openActionModal('court', court, 'APPROVED')}
                    >
                      ✓ Approve Court
                    </button>
                    <button
                      className="btn btn-sm btn-secondary"
                      onClick={() => openActionModal('court', court, 'ACTION_REQUIRED')}
                    >
                      ⚠️ Request Change
                    </button>
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => openActionModal('court', court, 'REJECTED')}
                    >
                      ✕ Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Action Dialog Modal */}
      {actionModal.isOpen && (
        <div className="modal-overlay" onClick={() => setActionModal(prev => ({ ...prev, isOpen: false }))}>
          <div
            className="modal"
            style={{ maxWidth: '540px', padding: '1.75rem', background: 'var(--bg-card, #131d2f)' }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ color: '#fff', fontWeight: 800, margin: '0 0 0.5rem 0' }}>
              {actionModal.status === 'APPROVED' && '✓ Approve '}
              {actionModal.status === 'ACTION_REQUIRED' && '⚠️ Request Corrections: '}
              {actionModal.status === 'REJECTED' && '✕ Reject '}
              {actionModal.item?.name}
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
              {actionModal.status === 'APPROVED' &&
                'Approving this resource will make it active and immediately available for customer searches and bookings.'}
              {actionModal.status === 'ACTION_REQUIRED' &&
                'Enter clear guidance for the owner on what adjustments, documents, or details are required before approval.'}
              {actionModal.status === 'REJECTED' &&
                'Explain why this submission does not meet Book Arena standards. The owner will see this message.'}
            </p>

            {/* Billing Model Assignment (Required when approving a venue) */}
            {actionModal.status === 'APPROVED' && actionModal.type === 'venue' && (
              <div style={{
                marginBottom: '1.5rem',
                padding: '1.25rem',
                background: 'rgba(16, 185, 129, 0.05)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                borderRadius: '12px'
              }}>
                <h4 style={{ color: '#34d399', fontSize: '0.95rem', fontWeight: 800, margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  ⚙️ Assign Platform Billing Model *
                </h4>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '0 0 1rem 0' }}>
                  Select the billing model and rate that applies to this venue. This configuration is audited and will be visible in the owner's dashboard.
                </p>

                {/* Billing Model Tabs / Radios */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginBottom: '1.25rem' }}>
                  <button
                    type="button"
                    onClick={() => setBillingModel('PERCENTAGE')}
                    style={{
                      padding: '0.6rem 0.5rem',
                      borderRadius: '8px',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      textAlign: 'center',
                      background: billingModel === 'PERCENTAGE' ? '#10b981' : 'rgba(255,255,255,0.05)',
                      color: billingModel === 'PERCENTAGE' ? '#000' : '#cbd5e1',
                      border: billingModel === 'PERCENTAGE' ? '1px solid #10b981' : '1px solid rgba(255,255,255,0.1)',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    📊 Commission (%)
                  </button>
                  <button
                    type="button"
                    onClick={() => setBillingModel('FLAT')}
                    style={{
                      padding: '0.6rem 0.5rem',
                      borderRadius: '8px',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      textAlign: 'center',
                      background: billingModel === 'FLAT' ? '#10b981' : 'rgba(255,255,255,0.05)',
                      color: billingModel === 'FLAT' ? '#000' : '#cbd5e1',
                      border: billingModel === 'FLAT' ? '1px solid #10b981' : '1px solid rgba(255,255,255,0.1)',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    🏷️ Fixed Fee (₹)
                  </button>
                  <button
                    type="button"
                    onClick={() => setBillingModel('SUBSCRIPTION')}
                    style={{
                      padding: '0.6rem 0.5rem',
                      borderRadius: '8px',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      textAlign: 'center',
                      background: billingModel === 'SUBSCRIPTION' ? '#10b981' : 'rgba(255,255,255,0.05)',
                      color: billingModel === 'SUBSCRIPTION' ? '#000' : '#cbd5e1',
                      border: billingModel === 'SUBSCRIPTION' ? '1px solid #10b981' : '1px solid rgba(255,255,255,0.1)',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    📅 Monthly Sub (₹)
                  </button>
                </div>

                {/* Model-specific Fields */}
                {billingModel === 'PERCENTAGE' && (
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontWeight: 600, color: '#e2e8f0', fontSize: '0.85rem' }}>
                      Platform Commission Percentage (%) *
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      className="form-input"
                      placeholder="e.g. 5.0"
                      value={commissionPercent}
                      onChange={e => setCommissionPercent(e.target.value)}
                      required
                    />
                    <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>
                      Example: 5% of each successful booking amount is retained by the platform.
                    </small>
                  </div>
                )}

                {billingModel === 'FLAT' && (
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontWeight: 600, color: '#e2e8f0', fontSize: '0.85rem' }}>
                      Fixed Platform Fee per Booking (₹) *
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      className="form-input"
                      placeholder="e.g. 50"
                      value={flatFee}
                      onChange={e => setFlatFee(e.target.value)}
                      required
                    />
                    <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>
                      Example: ₹50 fixed fee per successful booking is retained by the platform.
                    </small>
                  </div>
                )}

                {billingModel === 'SUBSCRIPTION' && (
                  <div style={{ display: 'grid', gap: '0.75rem' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontWeight: 600, color: '#e2e8f0', fontSize: '0.85rem' }}>
                        Monthly Subscription Amount (₹) *
                      </label>
                      <input
                        type="number"
                        step="1"
                        min="1"
                        className="form-input"
                        placeholder="e.g. 799"
                        value={subscriptionAmount}
                        onChange={e => setSubscriptionAmount(e.target.value)}
                        required
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontWeight: 600, color: '#e2e8f0', fontSize: '0.85rem' }}>
                          Collection Policy *
                        </label>
                        <select
                          className="form-input"
                          value={subscriptionPolicy}
                          onChange={e => setSubscriptionPolicy(e.target.value)}
                        >
                          <option value="DEDUCT_FROM_PROCEEDS">Deduct from booking proceeds</option>
                          <option value="SEPARATE">Owner pays separately</option>
                        </select>
                      </div>

                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontWeight: 600, color: '#e2e8f0', fontSize: '0.85rem' }}>
                          Start Date *
                        </label>
                        <input
                          type="date"
                          className="form-input"
                          value={subscriptionStartDate}
                          onChange={e => setSubscriptionStartDate(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label className="form-label" style={{ fontWeight: 600, color: '#e2e8f0' }}>
                Admin Notes & Owner Feedback {actionModal.status !== 'APPROVED' ? '*' : '(Optional)'}
              </label>
              <textarea
                className="form-input"
                rows="4"
                placeholder={
                  actionModal.status === 'APPROVED'
                    ? 'Optional approval note or welcome message...'
                    : 'Specify corrections required (e.g. upload high-res photos, clarify address, check price)...'
                }
                value={actionModal.feedback}
                onChange={e => setActionModal({ ...actionModal, feedback: e.target.value })}
                required={actionModal.status !== 'APPROVED'}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setActionModal(prev => ({ ...prev, isOpen: false }))}
                disabled={actionModal.submitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`btn ${
                  actionModal.status === 'APPROVED'
                    ? 'btn-primary'
                    : actionModal.status === 'REJECTED'
                    ? 'btn-danger'
                    : 'btn-secondary'
                }`}
                onClick={handleConfirmAction}
                disabled={actionModal.submitting || (actionModal.status !== 'APPROVED' && !actionModal.feedback.trim())}
                style={{
                  fontWeight: 700,
                  ...(actionModal.status === 'APPROVED' ? { background: '#10b981', color: '#000' } : {}),
                }}
              >
                {actionModal.submitting ? 'Updating...' : `Confirm ${actionModal.status}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
