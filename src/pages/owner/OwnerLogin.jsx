
import { useEffect, useState } from 'react';
import { useNavigate as useRouter } from 'react-router-dom';
import { Link } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import { apiPost } from '@/lib/api';
import { setPageMeta } from '@/lib/seo';

export default function OwnerLoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
  // Password Reset and Show/Hide States
  const [mode, setMode] = useState('login'); // 'login' | 'forgot' | 'reset'
  const [showPassword, setShowPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetForm, setResetForm] = useState({ otp: '', password: '', confirmPassword: '' });

  useEffect(() => {
    setPageMeta({
      title: 'Owner Login — Book Arena',
      description: 'Owner login to manage turfs, courts, pricing, and bookings on Book Arena.',
      keywords: 'book arena owner login, turf owner panel',
      robots: 'noindex, nofollow',
      canonicalUrl: 'https://bookarena.in/owner/login'
    });
  }, []);

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      const data = await apiPost('/owners/login', { email: form.username, password: form.password });
      if (!data?.token || !data?.owner?.id) {
        throw new Error('The server did not return a valid owner session. Please try again.');
      }
      localStorage.setItem('token', data.token);
      localStorage.setItem('owner', JSON.stringify(data.owner));
      router('/owner/dashboard');
    } catch (err) {
      setError(err.message || 'Owner login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleRequestOtp(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      await apiPost('/owners/forgot-password', { email: forgotEmail });
      setSuccessMsg('A 6-digit password reset OTP has been sent to your email.');
      setMode('reset');
    } catch (err) {
      setError(err.message || 'Failed to request OTP');
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword(e) {
    e.preventDefault();
    if (resetForm.password !== resetForm.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      await apiPost('/owners/reset-password', {
        email: forgotEmail,
        otp: resetForm.otp,
        password: resetForm.password
      });
      setSuccessMsg('Your password has been reset successfully! You can now log in.');
      setMode('login');
      setForm({ username: forgotEmail, password: '' });
      setResetForm({ otp: '', password: '', confirmPassword: '' });
    } catch (err) {
      setError(err.message || 'Failed to reset password');
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
              {mode === 'login' && 'Owner Login'}
              {mode === 'forgot' && 'Forgot Password'}
              {mode === 'reset' && 'Reset Password'}
            </h1>
            <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>
              {mode === 'login' && 'Manage your turfs and bookings'}
              {mode === 'forgot' && 'Recover owner panel account'}
              {mode === 'reset' && 'Set a new password'}
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

          {successMsg && (
            <div style={{
              background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: 'var(--radius-md)', padding: '0.75rem 1rem', marginBottom: '1.5rem',
              color: '#34d399', fontSize: '0.9rem'
            }}>
              ✅ {successMsg}
            </div>
          )}

          {mode === 'login' && (
            <form onSubmit={handleLogin} id="owner-login-form">
              <div className="form-group">
                <label className="form-label">Email or Phone</label>
                <input type="text" className="form-input" placeholder="Enter your registered email or phone"
                  value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
              </div>
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="form-label">Password</label>
                  <button type="button" onClick={() => { setError(''); setSuccessMsg(''); setMode('forgot'); }} style={{
                    background: 'none', border: 'none', color: 'var(--emerald-400)',
                    cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, padding: 0, marginBottom: '0.5rem'
                  }}>
                    Forgot Password?
                  </button>
                </div>
                <div style={{ position: 'relative' }}>
                  <input type={showPassword ? "text" : "password"} className="form-input" placeholder="••••••••"
                    value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required style={{ paddingRight: '40px' }} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} style={{
                    position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: 'var(--text-muted)'
                  }}>
                    {showPassword ? '👁️' : '🙈'}
                  </button>
                </div>
              </div>
              <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: '1rem' }} disabled={loading}>
                {loading ? 'Signing In...' : '🔐 Sign In'}
              </button>
            </form>
          )}

          {mode === 'forgot' && (
            <form onSubmit={handleRequestOtp} id="owner-forgot-form">
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                Enter your registered email address below, and we will send you a 6-digit OTP to reset your password.
              </p>
              <div className="form-group">
                <label className="form-label">Registered Email</label>
                <input type="email" className="form-input" placeholder="owner@example.com"
                  value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} required />
              </div>
              <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: '1rem' }} disabled={loading}>
                {loading ? 'Sending OTP...' : '📧 Request OTP'}
              </button>
              <button type="button" className="btn btn-secondary btn-lg" style={{ width: '100%', marginTop: '0.75rem' }} onClick={() => { setError(''); setSuccessMsg(''); setMode('login'); }} disabled={loading}>
                Cancel
              </button>
            </form>
          )}

          {mode === 'reset' && (
            <form onSubmit={handleResetPassword} id="owner-reset-form">
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                Enter the 6-digit OTP sent to your email <strong>{forgotEmail}</strong> and your new password.
              </p>
              <div className="form-group">
                <label className="form-label">6-Digit OTP *</label>
                <input type="text" className="form-input" placeholder="123456" maxLength={6}
                  value={resetForm.otp} onChange={(e) => setResetForm({ ...resetForm, otp: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">New Password *</label>
                <input type="password" className="form-input" placeholder="••••••••" minLength={6}
                  value={resetForm.password} onChange={(e) => setResetForm({ ...resetForm, password: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Confirm New Password *</label>
                <input type="password" className="form-input" placeholder="••••••••" minLength={6}
                  value={resetForm.confirmPassword} onChange={(e) => setResetForm({ ...resetForm, confirmPassword: e.target.value })} required />
              </div>
              <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: '1rem' }} disabled={loading}>
                {loading ? 'Resetting Password...' : '💾 Reset Password'}
              </button>
              <button type="button" className="btn btn-secondary btn-lg" style={{ width: '100%', marginTop: '0.75rem' }} onClick={() => { setError(''); setSuccessMsg(''); setMode('forgot'); }} disabled={loading}>
                Back to Request OTP
              </button>
            </form>
          )}

          <p style={{ textAlign: 'center', marginTop: '1.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Don&apos;t have an account?{' '}
            <Link to="/owner/register" style={{ color: 'var(--emerald-400)', fontWeight: 600 }}>
              Register Here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
