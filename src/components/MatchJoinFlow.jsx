import { useEffect, useState } from 'react';
import { apiGet, apiPost } from '@/lib/api';
import { formatPrice } from '@/lib/constants';

function parseRoles(match) {
  try {
    return Array.isArray(match.roles_needed) ? match.roles_needed : (typeof match.roles_needed === 'string' ? JSON.parse(match.roles_needed || '[]') : []);
  } catch (e) { return []; }
}

export default function MatchJoinFlow({ match, invite, onClose, onSuccess }) {
  // Invitations created from a booking name no roles: there is nothing to pick, so go straight to payment as a plain "Player"
  const [step, setStep] = useState(parseRoles(match).length ? 1 : 2);
  const [selectedRole, setSelectedRole] = useState(parseRoles(match).length ? '' : 'Player');
  const [receipt, setReceipt] = useState(null);
  const [paymentType, setPaymentType] = useState('advance');
  const [contributionPayOption, setContributionPayOption] = useState('full'); // full | half
  const [loading, setLoading] = useState(false);

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  let roles = [];
  try {
    roles = Array.isArray(match.roles_needed) 
      ? match.roles_needed 
      : (typeof match.roles_needed === 'string' 
          ? JSON.parse(match.roles_needed || '[]') 
          : []);
  } catch (e) {
    console.error('Failed to parse roles_needed in MatchJoinFlow:', e);
    roles = [];
  }
  const userData = JSON.parse(localStorage.getItem('userData') || '{}');

  const requiresContributionPayment = Number(match?.contribution_amount || 0) > 0;
  const advancePercent = Number(match.turf_advance_percent ?? 50);
  const baseContribution = Number((invite && invite.share_amount) ?? match.contribution_amount ?? 0);
  const payAmount = requiresContributionPayment
    ? (contributionPayOption === 'half' ? Math.round((baseContribution * (advancePercent / 100)) * 100) / 100 : baseContribution)
    : (paymentType === 'advance' ? Number(match.advance_amount || 0) : Number(match.split_amount || 0));

  const ensureLoggedIn = () => {
    const token = localStorage.getItem('userToken');
    const user = JSON.parse(localStorage.getItem('userData') || '{}');
    if (!token || !user?.id) {
      alert('Please login to join this match.');
      const redirect = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = `/login?redirect=${redirect}`;
      return false;
    }
    return true;
  };

  const loadRazorpay = () => {
    return new Promise((resolve) => {
      if (typeof window !== 'undefined' && window.Razorpay) return resolve(true);
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleJoin = async () => {
    setLoading(true);
    try {
      if (!ensureLoggedIn()) return;

      if (requiresContributionPayment) {
        const ok = await loadRazorpay();
        if (!ok) {
          alert('Payment SDK could not be loaded. Please disable ad-blocker and try again.');
          return;
        }

        // always the full share: a spot is only taken by a fully verified payment of that share
        const order = await apiPost(`/match-requests/${match.id}/join/create-order`, {
          role: selectedRole,
          payment_option: 'full'
        });

        const options = {
          key: order.key_id,
          amount: Math.round(order.amount * 100),
          currency: order.currency || 'INR',
          name: 'Book Arena',
          description: `Join match at ${match.turf_name || 'venue'}`,
          order_id: order.order_id,
          handler: async function (response) {
            try {
              await apiPost('/match-requests/join/verify', {
                match_player_id: order.match_player_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              });
              try { const r = await apiGet(`/match-requests/receipt/${order.match_player_id}`); setReceipt(r.receipt); } catch (e) { /* the confirmation below still shows */ }
              setStep(3);
            } catch (e) {
              alert(e.message || 'We could not confirm your payment yet. If money was deducted you will be added automatically, or it is refunded.');
            }
          },
          prefill: {
            name: userData?.name,
            email: userData?.email,
          },
          theme: { color: '#10b981' },
        };

        const rzp = new window.Razorpay(options);
        rzp.open();
        return;
      }

      // Legacy join (no payment)
      await apiPost('/match-requests/join', {
        match_id: match.id,
        user_id: userData.id,
        role: selectedRole,
        payment_type: paymentType
      });
      setStep(3); // Celebration
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="celebration-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="card" style={{ 
        maxWidth: '500px', 
        width: '95%', 
        padding: isMobile ? '1.5rem 1rem' : '2.5rem', 
        position: 'relative',
        maxHeight: '90vh',
        overflowY: 'auto'
      }}>
        <button className="close-btn" onClick={onClose} style={{ position: 'absolute', top: '20px', right: '20px', background: 'none', border: 'none', fontSize: '1.5rem', color: '#fff', cursor: 'pointer' }}>×</button>

        {step === 1 && (
          <div className="step-content">
            <h2 style={{ marginBottom: '1rem', textAlign: 'center' }}>Step 1: Pick Your Role</h2>
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: '2rem' }}>Which position would you like to play?</p>
            
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1rem' }}>
              {roles.map(role => (
                <div 
                  key={role} 
                  className={`role-card ${selectedRole === role ? 'active' : ''}`}
                  onClick={() => setSelectedRole(role)}
                  style={{
                    padding: '1rem',
                    borderRadius: '16px',
                    border: `2px solid ${selectedRole === role ? 'var(--emerald-500)' : 'var(--border-subtle)'}`,
                    background: selectedRole === role ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.03)',
                    cursor: 'pointer',
                    textAlign: 'center',
                    fontWeight: 700
                  }}
                >
                  {role}
                </div>
              ))}
            </div>

            <button 
              className="btn btn-primary" 
              style={{ width: '100%', marginTop: '2rem' }}
              disabled={!selectedRole}
              onClick={() => setStep(2)}
            >
              Continue to Payment
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="step-content">
            <h2 style={{ marginBottom: '1rem', textAlign: 'center' }}>
              {requiresContributionPayment ? 'Step 2: Pay & Join' : 'Step 2: Choose Payment'}
            </h2>
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: '2rem' }}>
              {requiresContributionPayment ? 'Pay your contribution to confirm your slot.' : 'How would you like to pay your share?'}
            </p>

            {requiresContributionPayment ? (
              <div style={{ display: 'grid', gap: '1rem' }}>
                <div
                  className={`payment-option-card ${contributionPayOption === 'full' ? 'active' : ''}`}
                  onClick={() => setContributionPayOption('full')}
                  style={{
                    padding: '1.25rem',
                    borderRadius: '16px',
                    border: `2px solid ${contributionPayOption === 'full' ? 'var(--emerald-500)' : 'var(--border-subtle)'}`,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 800 }}>Pay Full Amount</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Slot confirmed after payment</div>
                  </div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 900 }}>₹{baseContribution}</div>
                </div>

              </div>
            ) : (
              <div className="payment-options" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div 
                  className={`payment-option-card ${paymentType === 'advance' ? 'active' : ''}`}
                  onClick={() => setPaymentType('advance')}
                  style={{
                    padding: '1.25rem',
                    borderRadius: '16px',
                    border: `2px solid ${paymentType === 'advance' ? 'var(--emerald-500)' : 'var(--border-subtle)'}`,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 800 }}>Advance Payment</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Secure your slot now</div>
                  </div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 900 }}>₹{match.advance_amount}</div>
                </div>

                <div 
                  className={`payment-option-card ${paymentType === 'split' ? 'active' : ''}`}
                  onClick={() => setPaymentType('split')}
                  style={{
                    padding: '1.25rem',
                    borderRadius: '16px',
                    border: `2px solid ${paymentType === 'split' ? 'var(--emerald-400)' : 'var(--border-subtle)'}`,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 800 }}>Split Payment</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Pay remaining at venue</div>
                  </div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 900 }}>₹{match.split_amount}</div>
                </div>
              </div>
            )}

            <div style={{ marginTop: '2rem', background: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span>Selected Role</span>
                <span style={{ fontWeight: 700 }}>{selectedRole}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Total Due</span>
                <span style={{ fontWeight: 900, color: 'var(--emerald-400)', fontSize: '1.2rem' }}>₹{payAmount}</span>
              </div>
            </div>

            <button 
              className="btn btn-primary" 
              style={{ width: '100%', marginTop: '2rem' }}
              disabled={loading}
              onClick={handleJoin}
            >
              {loading ? 'Processing...' : (requiresContributionPayment ? 'Pay & Join' : 'Confirm & Join Match')}
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="step-content" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '5rem', marginBottom: '1.5rem' }}>🎉</div>
            <h2 style={{ marginBottom: '0.5rem' }}>You're In!</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.25rem' }}>Payment confirmed — you joined the match at {match.turf_name}.</p>

            {receipt && receipt.state === 'paid' && (
              <div style={{ textAlign: 'left', background: 'rgba(0,0,0,0.25)', borderRadius: 16, padding: '1rem 1.25rem', marginBottom: '1.25rem', fontSize: '0.9rem', display: 'grid', gap: 6 }}>
                <div style={{ fontWeight: 800, color: 'var(--emerald-400)' }}>Payment receipt</div>
                {[['Booking reference', receipt.booking_reference], ['Venue', receipt.venue], ['Sport', receipt.sport], ['Date', receipt.date], ['Time', receipt.time], ['Participant', receipt.participant_name],
                  ['Amount paid', `₹${receipt.amount}`], receipt.coupon_code ? ['Coupon', `${receipt.coupon_code} (your share of the discount: ₹${receipt.discount_allocated})`] : null,
                  ['Transaction', receipt.transaction_reference], ['Status', 'Paid'], ['Confirmed', receipt.confirmed_at ? new Date(receipt.confirmed_at).toLocaleString() : '']].filter(Boolean).map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><span style={{ color: 'var(--text-muted)' }}>{k}</span><span style={{ fontWeight: 700, textAlign: 'right', overflowWrap: 'anywhere' }}>{v}</span></div>
                ))}
                <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: 4 }}>You can find this receipt again under your bookings.</div>
              </div>
            )}
            
            <div style={{ background: 'rgba(16,185,129,0.1)', padding: '1.5rem', borderRadius: '16px', marginBottom: '2rem' }}>
              <div style={{ fontWeight: 800, color: 'var(--emerald-400)', marginBottom: '0.5rem' }}>+50 Karma Points Earned</div>
              <div style={{ fontSize: '0.85rem' }}>Your karma helps you join more matches!</div>
            </div>

            <div style={{ display: 'grid', gap: '1rem' }}>
              <button className="btn btn-primary" style={{ background: '#25D366', borderColor: '#25D366' }}>
                Join WhatsApp Group
              </button>
              <button className="btn btn-secondary" onClick={onSuccess}>
                Back to Feed
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
