import { useEffect } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { setPageMeta } from '@/lib/seo';

export default function DeleteAccount() {
  useEffect(() => {
    setPageMeta({
      title: 'Delete your account — Book Arena',
      description: 'How to delete your Book Arena account and what happens to your data.',
      keywords: 'delete account, book arena account deletion',
      canonicalUrl: 'https://bookarena.in/delete-account'
    });
  }, []);

  return (
    <div className="page-wrapper">
      <Navbar />
      <main style={{ paddingTop: '120px', paddingBottom: '5rem' }}>
        <div className="container">
          <div className="card" style={{ padding: '3rem', maxWidth: '900px', margin: '0 auto' }}>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.2rem', fontWeight: 800, marginBottom: '1.5rem' }}>Delete your Book Arena account</h1>
            <div className="legal-content" style={{ lineHeight: '1.8', color: 'var(--text-primary)' }}>
              <h2 style={{ margin: '1rem 0', color: 'var(--emerald-400)' }}>In the app</h2>
              <ol style={{ paddingLeft: '1.5rem' }}>
                <li>Open the Book My Arena app and sign in.</li>
                <li>Go to Profile and tap <strong>Delete account</strong>.</li>
                <li>Type DELETE to confirm.</li>
              </ol>
              <h2 style={{ margin: '1.5rem 0 1rem', color: 'var(--emerald-400)' }}>Without the app</h2>
              <p>Email <a href="mailto:support@bookmyarena.in?subject=Delete%20my%20account">support@bookmyarena.in</a> from the email address on your account with the subject “Delete my account”. We will confirm and complete the deletion.</p>
              <h2 style={{ margin: '1.5rem 0 1rem', color: 'var(--emerald-400)' }}>What is deleted, and what is kept</h2>
              <ul style={{ paddingLeft: '1.5rem', listStyleType: 'disc' }}>
                <li>Deleted: your name, email address, phone number, profile picture, Google sign-in link and notification token.</li>
                <li>Kept: booking, payment and refund records, which we must retain for accounting, tax and dispute purposes. After deletion they are no longer linked to a sign-in.</li>
                <li>Deletion cannot be completed while you have upcoming confirmed bookings. Cancel them first (where the cancellation window allows) or contact us.</li>
              </ul>
              <p style={{ marginTop: '1.5rem' }}>See our <a href="/privacy">Privacy Policy</a> for more.</p>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
