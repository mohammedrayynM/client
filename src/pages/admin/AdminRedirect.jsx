
import { useEffect } from 'react';
import { useNavigate as useRouter } from 'react-router-dom';
import { setPageMeta } from '@/lib/seo';

export default function AdminRootRedirect() {
  const router = useRouter();

  useEffect(() => {
    setPageMeta({
      title: 'Admin — Book Arena',
      description: 'Admin entry route for Book Arena.',
      keywords: 'book arena admin',
      robots: 'noindex, nofollow',
      canonicalUrl: 'https://bookarena.in/admin'
    });
    router('/admin/login', { replace: true });
  }, [router]);

  return (
    <div className="loading-page">
      <div className="loading-spinner" />
      <p style={{ color: 'var(--text-muted)' }}>Redirecting to Admin Login...</p>
    </div>
  );
}
