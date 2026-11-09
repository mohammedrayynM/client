import React, { useState, useEffect } from 'react';
import { apiGet, apiPut } from '@/lib/api';
import { formatDate, formatPrice, VENUE_CATEGORIES } from '@/lib/constants';

export default function AdminApprovals({ onUpdateCount }) {
  const [loading, setLoading] = useState(true);
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

  const loadApprovals = async () => {
    setLoading(true);
    try {
      const res = await apiGet('/admin/pending-approvals');
      if (res.success) {
        setPendingVenues(res.pendingVenues || []);
        setPendingCourts(res.pendingCourts || []);
        if (onUpdateCount) {
          onUpdateCount((res.pendingVenues?.length || 0) + (res.pendingCourts?.length || 0));
        }
      }
    } catch (err) {
      console.error('Error fetching pending approvals:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApprovals();
  }, []);

  const openActionModal = (type, item, status) => {
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

    setActionModal(prev => ({ ...prev, submitting: true }));
    try {
      if (type === 'venue') {
        await apiPut(`/admin/turfs/${item.id}/approval`, {
          approval_status: status,
          admin_feedback: feedback,
        });
      } else {
        await apiPut(`/admin/courts/${item.id}/approval`, {
          approval_status: status,
          admin_feedback: feedback,
        });
      }
      setActionModal({ isOpen: false, type: 'venue', item: null, status: 'APPROVED', feedback: '', submitting: false });
      loadApprovals();
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
