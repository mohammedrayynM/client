'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import Navbar from '@/components/Navbar';

function SuccessContent() {
  const searchParams = useSearchParams();
  const bookingId = searchParams.get('id');

  return (
    <div className="success-container">
      <div className="success-card">
        <div className="success-icon">✅</div>

        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: '2rem',
          fontWeight: 800,
          color: 'var(--text-primary)',
          marginBottom: '0.75rem'
        }}>
          Booking Confirmed!
        </h1>

        <p style={{
          color: 'var(--text-secondary)',
          fontSize: '1.05rem',
          lineHeight: 1.7,
          marginBottom: '1.5rem'
        }}>
          Your turf has been successfully booked. 
          Get ready to play! 🎉
        </p>

        {bookingId && bookingId !== 'demo' && (
          <div style={{
            background: 'var(--bg-surface)',
            borderRadius: 'var(--radius-md)',
            padding: '1rem',
            marginBottom: '1.5rem'
          }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Booking ID</p>
            <p style={{
              color: 'var(--emerald-400)',
              fontFamily: 'var(--font-display)',
              fontSize: '1.3rem',
              fontWeight: 700
            }}>
              #{bookingId}
            </p>
          </div>
        )}

        <div style={{
          background: 'rgba(16, 185, 129, 0.08)',
          border: '1px solid rgba(16, 185, 129, 0.2)',
          borderRadius: 'var(--radius-md)',
          padding: '1rem',
          marginBottom: '2rem',
          textAlign: 'left'
        }}>
          <p style={{ color: 'var(--emerald-300)', fontWeight: 600, marginBottom: '0.5rem' }}>
            📋 What&apos;s Next?
          </p>
          <ul style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.8, paddingLeft: '1.2rem' }}>
            <li>A confirmation SMS/email will be sent shortly</li>
            <li>Arrive 10 minutes before your slot time</li>
            <li>Carry a valid ID for verification</li>
            <li>Have a great game! 🏏</li>
          </ul>
        </div>

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          <Link href="/turfs" className="btn btn-primary">
            Book Another Turf
          </Link>
          <Link href="/" className="btn btn-secondary">
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function BookingSuccessPage() {
  return (
    <div className="page-wrapper">
      <Navbar />
      <Suspense fallback={
        <div className="loading-page">
          <div className="loading-spinner" />
        </div>
      }>
        <SuccessContent />
      </Suspense>
    </div>
  );
}
