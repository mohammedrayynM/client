
import { useEffect, useState, Suspense } from 'react';
import { useNavigate as useRouter, useSearchParams } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { setPageMeta } from '@/lib/seo';
import { apiPost } from '@/lib/api';

function LoginContent() {
  const router = useRouter();
  const [searchParams] = useSearchParams();
  const redirectParams = searchParams.get('redirect');
  const bookingLoginRequired = searchParams.get('reason') === 'booking';
  const getRedirectTarget = () => {
    if (!redirectParams || !redirectParams.startsWith('/') || redirectParams.startsWith('//')) return '/profile';
    try {
      const target = new URL(redirectParams, window.location.origin);
      if (target.origin !== window.location.origin) return '/profile';
      return `${target.pathname}${target.search}${target.hash}`;
    } catch {
      return '/profile';
    }
  };
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setPageMeta({
      title: 'Login / Sign Up — Book Arena',
      description: 'Login or create your Book Arena account to book turfs, join matches, and manage your receipts.',
      keywords: 'book arena login, sign up, user account, turf booking account',
      robots: 'noindex, nofollow',
      canonicalUrl: 'https://bookarena.in/login'
    });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const bodyParams = isLogin ? { email: formData.email, password: formData.password } : formData;
      const data = await apiPost(isLogin ? '/users/login' : '/users/register', bodyParams);

      // Save token and user details to localStorage
      localStorage.setItem('userToken', data.token);
      localStorage.setItem('userData', JSON.stringify(data.user));

      // Redirect back if applicable, otherwise to home or profile
      if (redirectParams) {
        router(getRedirectTarget());
      } else {
        router('/profile');
      }
      // Reload navbar
      setTimeout(() => window.location.reload(), 500);
      
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    setLoading(true);
    setError('');
    try {
      const data = await apiPost('/users/google-login', { idToken: credentialResponse.credential });

      localStorage.setItem('userToken', data.token);
      localStorage.setItem('userData', JSON.stringify(data.user));

      if (redirectParams) {
        router(getRedirectTarget());
      } else {
        router('/profile');
      }
      setTimeout(() => window.location.reload(), 500);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = (provider) => {
    if (provider === 'Facebook') {
      alert(`${provider} Login will be fully activated once OAuth API keys are configured by the admin. Please use your email to register and login for now.`);
    }
  };

  return (
    <div className="page-wrapper" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '120px 20px 60px', background: 'var(--bg-default)' }}>
        
        <div style={{
          width: '100%', maxWidth: '420px',
          background: 'var(--bg-surface)', padding: '2rem',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-subtle)',
          boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
        }}>
          
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {isLogin ? 'Welcome Back' : 'Create Account'}
            </h1>
            <p style={{ color: 'var(--text-secondary)' }}>
              {isLogin ? 'Log in to securely manage your bookings' : 'Join us to book your favorite turfs'}
            </p>
          </div>
          {bookingLoginRequired && (
            <p role="status" style={{ padding: '0.85rem 1rem', marginBottom: '1.25rem', border: '1px solid rgba(16,185,129,.45)', borderRadius: '10px', background: 'rgba(16,185,129,.1)', color: 'var(--text-primary)', textAlign: 'center' }}>
              Please log in to continue with your booking.
            </p>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem', alignItems: 'center' }}>
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => setError('Google Login Failed')}
              theme="filled_blue"
              shape="pill"
              text="continue_with"
              width="360"
              useOneTap
              auto_select
            />
            
            <button 
              type="button" 
              onClick={() => handleSocialLogin('Facebook')}
              style={{
                width: '100%', padding: '10px', background: 'var(--bg-card)', color: 'var(--text-primary)',
                border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                cursor: 'pointer', fontWeight: 600, transition: '0.2s',
                height: '40px'
              }}
              onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--text-muted)'}
              onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--border-subtle)'}
            >
              <img src="https://www.svgrepo.com/show/475647/facebook-color.svg" alt="Facebook" loading="lazy" decoding="async" style={{ width: 18, height: 18 }} />
              Facebook
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem' }}>
            <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600 }}>OR CONTINUE WITH EMAIL</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
          </div>

          {error && (
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#ef4444', padding: '10px', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.9rem', textAlign: 'center' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {!isLogin && (
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Full Name</label>
                <input 
                  type="text" 
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid var(--border-subtle)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                  placeholder="John Doe"
                  required
                />
              </div>
            )}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Email Address</label>
              <input 
                type="email" 
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid var(--border-subtle)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                placeholder="you@example.com"
                required
              />
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Password</label>
              <input 
                type="password" 
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
                style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid var(--border-subtle)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                placeholder="••••••••"
                required
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '14px', fontSize: '1rem', fontWeight: 700 }} disabled={loading}>
              {loading ? 'Processing...' : (isLogin ? 'Log In' : 'Sign Up')}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: '1.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button 
              type="button" 
              onClick={() => { setIsLogin(!isLogin); setError(''); }}
              style={{ background: 'none', border: 'none', color: 'var(--emerald-400)', fontWeight: 700, cursor: 'pointer' }}
            >
              {isLogin ? 'Sign up' : 'Log in'}
            </button>
          </p>

        </div>
      </div>
      <Footer />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="page-wrapper"><Navbar /><div className="flex-center" style={{ minHeight: '60vh' }}><div className="loading-spinner" /></div></div>}>
      <LoginContent />
    </Suspense>
  );
}
