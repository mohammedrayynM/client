'use client';

import { useState } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export default function ContactUs() {
  const [formData, setFormData] = useState({ name: '', email: '', message: '' });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
    // Real logic would go here
  };

  return (
    <div className="page-wrapper">
      <Navbar />
      
      <main style={{ paddingTop: '120px', paddingBottom: '5rem' }}>
        <div className="container">
          <div className="grid-2" style={{ gap: '4rem' }}>
            <div>
              <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '3rem', fontWeight: 900, marginBottom: '1.5rem' }}>
                Get in <span style={{ color: 'var(--emerald-400)' }}>Touch</span>.
              </h1>
              <p style={{ fontSize: '1.1rem', color: 'var(--text-muted)', marginBottom: '3rem' }}>
                Have questions about a booking? Or want to list your turf? Our team is available 24/7 to help you out.
              </p>

              <div style={{ display: 'grid', gap: '2rem' }}>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'var(--card-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', border: '1px solid var(--border-subtle)' }}>📧</div>
                  <div>
                    <div style={{ fontWeight: 600 }}>Email Us</div>
                    <div style={{ color: 'var(--text-muted)' }}>mohamnedrayyan97@gmail.com</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'var(--card-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', border: '1px solid var(--border-subtle)' }}>📞</div>
                  <div>
                    <div style={{ fontWeight: 600 }}>Call Support</div>
                    <div style={{ color: 'var(--text-muted)' }}>+91 89034 95256</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'var(--card-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', border: '1px solid var(--border-subtle)' }}>📍</div>
                  <div>
                    <div style={{ fontWeight: 600 }}>Main Office</div>
                    <div style={{ color: 'var(--text-muted)' }}>123 Sports Complex Road, Bangalore, India</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="card" style={{ padding: '2.5rem' }}>
              {submitted ? (
                <div style={{ textAlign: 'center', padding: '2rem' }}>
                  <div style={{ fontSize: '4rem', marginBottom: '1.5rem' }}>✅</div>
                  <h2 style={{ marginBottom: '1rem' }}>Message Sent!</h2>
                  <p style={{ color: 'var(--text-muted)' }}>We'll get back to you within 24 hours.</p>
                  <button className="btn btn-primary" style={{ marginTop: '2rem' }} onClick={() => setSubmitted(false)}>Send Another</button>
                </div>
              ) : (
                <form onSubmit={handleSubmit}>
                  <div className="form-group">
                    <label className="form-label">Full Name</label>
                    <input type="text" className="form-input" placeholder="Enter your name" required 
                           value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email Address</label>
                    <input type="email" className="form-input" placeholder="name@example.com" required 
                           value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Your Message</label>
                    <textarea className="form-input" style={{ minHeight: '150px' }} placeholder="How can we help?" required 
                              value={formData.message} onChange={e => setFormData({...formData, message: e.target.value})} />
                  </div>
                  <button type="submit" className="btn btn-primary" style={{ width: '100%', height: '56px', fontSize: '1rem' }}>Send Message 🚀</button>
                </form>
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
