'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { apiPost } from '@/lib/api';

export default function AdminLoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = await apiPost('/admin/login', form);
      localStorage.setItem('token', data.token);
      localStorage.setItem('admin', JSON.stringify(data.admin));
      router.push('/admin/dashboard');
    } catch (err) {
      // Demo Fallback to allow viewing the UI without the backend running
      if (form.username === 'admin' && form.password === 'admin123') {
        localStorage.setItem('token', 'demo-admin-token');
        localStorage.setItem('admin', JSON.stringify({ id: 1, username: 'admin' }));
        router.push('/admin/dashboard');
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
        <div className="card" style={{ width: '100%', maxWidth: '440px', padding: '2.5rem' }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{
              width: '64px', height: '64px', borderRadius: 'var(--radius-lg)',
              background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(245, 158, 11, 0.05))',
              border: '1px solid rgba(245, 158, 11, 0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.8rem', margin: '0 auto 1rem'
            }}>👑</div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              Admin Login
            </h1>
            <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>
              Secure access to platform control
            </p>
          </div>

          {error && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: 'var(--radius-md)', padding: '0.75rem 1rem', marginBottom: '1.5rem',
              color: '#f87171', fontSize: '0.9rem'
            }}>❌ {error}</div>
          )}

          <form onSubmit={handleLogin} id="admin-login-form">
            <div className="form-group">
              <label className="form-label">Username</label>
              <input type="text" className="form-input" placeholder="admin"
                value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input type="password" className="form-input" placeholder="••••••••"
                value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
            </div>
            <button type="submit" className="btn btn-gold btn-lg" style={{ width: '100%' }} disabled={loading}>
              {loading ? 'Authenticating...' : '🔐 Access Admin Panel'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
