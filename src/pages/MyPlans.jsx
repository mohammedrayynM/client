import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { apiGet } from '@/lib/api';
import { formatPrice, formatDate } from '@/lib/constants';
import { setPageMeta } from '@/lib/seo';

export default function MyPlans() {
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    setPageMeta({
      title: 'My Plans — Book Arena',
      description: 'View and manage your Book Arena subscription plans.',
      keywords: 'book arena plans, subscriptions, sports plans',
      robots: 'noindex, nofollow',
      canonicalUrl: 'https://bookarena.in/my-plans'
    });

    const userData = localStorage.getItem('userData');
    if (!userData) {
      navigate('/login');
      return;
    }
    const user = JSON.parse(userData);
    loadPlans(user.id);
  }, []);

  async function loadPlans(userId) {
    try {
      const data = await apiGet(`/subscriptions/my-plans?user_id=${userId}`);
      setSubscriptions(data.subscriptions || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-wrapper">
      <Navbar />
      <div className="container" style={{ paddingTop: '120px', paddingBottom: '4rem' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.5rem', fontWeight: 800, marginBottom: '2rem' }}>
          My <span className="accent">Subscription Plans</span>
        </h1>

        {loading ? (
          <div className="flex-center" style={{ padding: '4rem' }}>
            <div className="loading-spinner" />
          </div>
        ) : subscriptions.length > 0 ? (
          <div className="grid-3" style={{ gap: '2rem' }}>
            {subscriptions.map(sub => {
              const expiryDate = new Date(sub.expiry_date);
              const daysRemaining = Math.ceil((expiryDate - new Date()) / (1000 * 60 * 60 * 24));
              
              return (
                <div key={sub.id} className="card" style={{ position: 'relative', overflow: 'hidden' }}>
                  <div className={`status-badge status-${sub.status === 'active' ? 'confirmed' : 'expired'}`} style={{ position: 'absolute', top: '15px', right: '15px' }}>
                    {sub.status.toUpperCase()}
                  </div>
                  
                  <div style={{ marginBottom: '1.5rem' }}>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>{sub.plan_name}</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>🏟️ {sub.turf_name} {sub.court_name && ` — ${sub.court_name}`}</p>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>⏰ Fixed Timing</span>
                      <span style={{ fontWeight: 700, color: 'var(--emerald-400)' }}>{sub.start_time.substring(0,5)} - {sub.end_time.substring(0,5)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>📅 Expiry Date</span>
                      <span style={{ fontWeight: 600 }}>{new Date(sub.expiry_date).toLocaleDateString()}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>⏳ Days Remaining</span>
                      <span style={{ fontWeight: 800, color: daysRemaining < 7 ? '#f87171' : 'var(--emerald-400)' }}>{daysRemaining} Days</span>
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1.5rem' }}>
                    <button className="btn btn-primary btn-sm" style={{ width: '100%' }}>Renew Plan</button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty-state">
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>💎</div>
            <h3>No active subscriptions</h3>
            <p>Subscribe to a daily slot to train consistently!</p>
            <button className="btn btn-primary" style={{ marginTop: '1.5rem' }} onClick={() => navigate('/turfs')}>Browse Turfs</button>
          </div>
        )}
      </div>
    </div>
  );
}
