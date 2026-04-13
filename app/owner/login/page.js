'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { apiPost } from '@/lib/api';

export default function OwnerLoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = await apiPost('/owners/login', form);
      localStorage.setItem('token', data.token);
      localStorage.setItem('owner', JSON.stringify(data.owner));
      router.push('/owner/dashboard');
    } catch (err) {
      if ((form.username === 'owner@demo.com' || form.username === 'demo') && form.password === 'owner123') {
        localStorage.setItem('token', 'demo-owner-token');
        localStorage.setItem('owner', JSON.stringify({ id: 1, name: 'Demo Owner', email: 'owner@demo.com', phone: '9876543210' }));
        router.push('/owner/dashboard');
      } else {
        setError(err.message || 'Failed to connect to backend. Use demo credentials.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-wrapper">
      <Navbar />
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--gradient-hero)', paddingTop: '80px'
      }}>
        <div className="card" style={{ width: '100%', maxWidth: '450px', padding: '2.5rem' }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{
              width: '64px', height: '64px', borderRadius: 'var(--radius-lg)',
              background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: '1.8rem', margin: '0 auto 1rem'
            }}>🏢</div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              Owner Login
            </h1>
            <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>
              Manage your turfs and bookings
            </p>
          </div>

          {error && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: 'var(--radius-md)', padding: '0.75rem 1rem', marginBottom: '1.5rem',
              color: '#f87171', fontSize: '0.9rem'
            }}>
              ❌ {error}
            </div>
          )}

          <form onSubmit={handleLogin} id="owner-login-form">
            <div className="form-group">
              <label className="form-label">Username or Email</label>
              <input type="text" className="form-input" placeholder="Enter username or email"
                value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input type="password" className="form-input" placeholder="••••••••"
                value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
            </div>
            <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={loading}>
              {loading ? 'Signing In...' : '🔐 Sign In'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: '1.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Don&apos;t have an account?{' '}
            <Link href="/owner/register" style={{ color: 'var(--emerald-400)', fontWeight: 600 }}>
              Register Here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
