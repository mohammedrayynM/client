'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminRootRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/admin/login');
  }, [router]);

  return (
    <div className="loading-page">
      <div className="loading-spinner" />
      <p style={{ color: 'var(--text-muted)' }}>Redirecting to Admin Login...</p>
    </div>
  );
}
