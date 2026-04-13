'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { apiPost } from '@/lib/api';

export default function OwnerRegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  async function handleRegister(e) {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await apiPost('/owners/register', {
        name: form.name, email: form.email, phone: form.phone, password: form.password
      });
      setSuccess(true);
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="page-wrapper">
        <Navbar />
        <div className="success-container">
          <div className="success-card">
            <div className="success-icon">🎉</div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
              Registration Successful!
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', lineHeight: 1.7, marginBottom: '2rem' }}>
              Your account has been created. Please wait for admin approval before you can start managing turfs.
            </p>
            <Link href="/owner/login" className="btn btn-primary btn-lg">
              Go to Login →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrapper">
      <Navbar />
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--gradient-hero)', paddingTop: '80px', padding: '100px 1rem 2rem'
      }}>
        <div className="card" style={{ width: '100%', maxWidth: '500px', padding: '2.5rem' }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{
              width: '64px', height: '64px', borderRadius: 'var(--radius-lg)',
              background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: '1.8rem', margin: '0 auto 1rem'
            }}>🚀</div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              Register as Owner
            </h1>
            <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>
              List your turf and start earning
            </p>
          </div>

          {error && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: 'var(--radius-md)', padding: '0.75rem 1rem', marginBottom: '1.5rem',
              color: '#f87171', fontSize: '0.9rem'
            }}>❌ {error}</div>
          )}

          <form onSubmit={handleRegister} id="owner-register-form">
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input type="text" className="form-input" placeholder="Your full name"
                value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input type="email" className="form-input" placeholder="owner@example.com"
                value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </div>
            <div className="form-group">
              <label className="form-label">Phone Number</label>
              <input type="tel" className="form-input" placeholder="+91 98765 43210"
                value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Password</label>
                <input type="password" className="form-input" placeholder="••••••••"
                  value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} />
              </div>
              <div className="form-group">
                <label className="form-label">Confirm Password</label>
                <input type="password" className="form-input" placeholder="••••••••"
                  value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} required />
              </div>
            </div>
            <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={loading}>
              {loading ? 'Registering...' : '🚀 Create Account'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: '1.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Already have an account?{' '}
            <Link href="/owner/login" style={{ color: 'var(--emerald-400)', fontWeight: 600 }}>Sign In</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
