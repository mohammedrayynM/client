import { useEffect } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { setPageMeta } from '@/lib/seo';

export default function PrivacyPolicy() {
  useEffect(() => {
    setPageMeta({
      title: 'Privacy Policy — Book Arena',
      description: 'Read Book Arena’s privacy policy covering information collection, usage, sharing, retention, cancellations and account deletion.',
      keywords: 'privacy policy, book arena privacy, turf booking privacy, delete account',
      canonicalUrl: 'https://bookarena.in/privacy'
    });
  }, []);

  return (
    <div className="page-wrapper">
      <Navbar />

      <main style={{ paddingTop: '120px', paddingBottom: '5rem' }}>
        <div className="container">
          <div className="card" style={{ padding: '3rem', maxWidth: '900px', margin: '0 auto' }}>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.5rem', fontWeight: 800, marginBottom: '1.5rem', background: 'var(--gradient-emerald)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Privacy Policy
            </h1>
            <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>Last Updated: October 18, 2026</p>

            <div className="legal-content" style={{ lineHeight: '1.8', color: 'var(--text-primary)' }}>
              <section style={{ marginBottom: '2rem' }}>
                <h2 style={{ marginBottom: '1rem', color: 'var(--emerald-400)' }}>1. Who we are</h2>
                <p>Book Arena (“we”, “us”) runs the Book Arena website and the Book My Arena mobile app, which let you find and book sports venues, courts and activities. This policy explains what personal information we handle and why. Questions: <a href="mailto:support@bookmyarena.in">support@bookmyarena.in</a>.</p>
              </section>

              <section style={{ marginBottom: '2rem' }}>
                <h2 style={{ marginBottom: '1rem', color: 'var(--emerald-400)' }}>2. Information we collect</h2>
                <ul style={{ paddingLeft: '1.5rem', listStyleType: 'disc' }}>
                  <li><strong>Account details</strong> — your name and email address, and your phone number if you give one when signing up or booking. If you sign up with email, your password is stored only as a one-way hash. If you use Google Sign-In, we receive your name, email address, profile picture and Google account ID from Google.</li>
                  <li><strong>Booking details</strong> — the venue, court, date and time slot you book, the amount, your booking history, cancellations and refunds, and any match or player requests you create or join.</li>
                  <li><strong>Payment details</strong> — payments are made through Razorpay. Card, UPI and bank details are entered on Razorpay’s screens and are not stored by us. We keep the order and payment reference numbers, amount and status so we can confirm bookings, issue refunds and reconcile accounts.</li>
                  <li><strong>Location</strong> — only if you allow it in the app, your device location is used to show venues near you. You can refuse or withdraw this permission in your device settings and still search by area.</li>
                  <li><strong>Notification token</strong> — if you allow notifications, a push token that identifies your device so we can send booking updates.</li>
                  <li><strong>Venue owners</strong> — business and venue details, venue photos and pricing, and the payout account details needed to receive your share of payments through Razorpay.</li>
                </ul>
              </section>

              <section style={{ marginBottom: '2rem' }}>
                <h2 style={{ marginBottom: '1rem', color: 'var(--emerald-400)' }}>3. How we use it</h2>
                <ul style={{ paddingLeft: '1.5rem', listStyleType: 'disc' }}>
                  <li>To create and secure your account and sign you in.</li>
                  <li>To process bookings and payments, send confirmations, reminders and receipts, and handle cancellations and refunds.</li>
                  <li>To show venues near you and relevant search results.</li>
                  <li>To prevent fraud, resolve disputes and meet our legal, tax and accounting obligations.</li>
                  <li>To contact you about your bookings and respond to support requests.</li>
                </ul>
              </section>

              <section style={{ marginBottom: '2rem' }}>
                <h2 style={{ marginBottom: '1rem', color: 'var(--emerald-400)' }}>4. Who we share it with</h2>
                <ul style={{ paddingLeft: '1.5rem', listStyleType: 'disc' }}>
                  <li><strong>The venue you book</strong> — your name, contact details and booking information, so the venue can host you.</li>
                  <li><strong>Razorpay</strong> — to take payments, issue refunds and pay out venue owners.</li>
                  <li><strong>Google</strong> — for Google Sign-In and for maps and place search.</li>
                  <li><strong>Notification, email and SMS providers</strong> — Expo (push notifications), an email delivery service and an SMS provider, which receive the contact details and message content needed to deliver booking messages.</li>
                  <li><strong>Authorities</strong> — where the law requires it.</li>
                </ul>
                <p>We do not sell your personal information.</p>
              </section>

              <section style={{ marginBottom: '2rem' }}>
                <h2 style={{ marginBottom: '1rem', color: 'var(--emerald-400)' }}>5. Cancellations and refunds</h2>
                <p>Customers can cancel a booking online at least 8 hours before the slot starts. A cancellation made at least 8 hours before the start receives a refund of 90% of the amount paid for the slot, and 10% is retained; within 8 hours of the start, online cancellation is not available. Refunds go back to the original payment method and can take several business days to reach your bank. If a venue cancels, or a payment is received for a slot that was taken at the same moment by someone else, you are refunded in full.</p>
              </section>

              <section style={{ marginBottom: '2rem' }}>
                <h2 style={{ marginBottom: '1rem', color: 'var(--emerald-400)' }}>6. How long we keep information</h2>
                <p>We keep your account information while your account is active. Booking, payment and refund records are kept for as long as needed for accounting, tax, fraud-prevention and dispute purposes, even after your account is deleted; once an account is deleted these records are no longer linked to a sign-in and your profile details are removed.</p>
              </section>

              <section style={{ marginBottom: '2rem' }}>
                <h2 style={{ marginBottom: '1rem', color: 'var(--emerald-400)' }}>7. Your choices and account deletion</h2>
                <ul style={{ paddingLeft: '1.5rem', listStyleType: 'disc' }}>
                  <li>You can see your bookings and profile in the app and on the website.</li>
                  <li>You can turn off location and notification permissions at any time in your device settings.</li>
                  <li><strong>Delete your account</strong> — in the app go to Profile → Delete account, or follow the steps on our <a href="/delete-account">account deletion page</a>, or email <a href="mailto:support@bookmyarena.in">support@bookmyarena.in</a> from the address on your account. Deletion removes your name, email, phone number, profile picture, Google link and notification token. It cannot be completed while you have upcoming confirmed bookings.</li>
                  <li>You can also email us to ask for a copy of, or a correction to, the personal information we hold about you.</li>
                </ul>
              </section>

              <section style={{ marginBottom: '2rem' }}>
                <h2 style={{ marginBottom: '1rem', color: 'var(--emerald-400)' }}>8. Security</h2>
                <p>We take reasonable measures to help protect information about you from loss, theft, misuse and unauthorised access. Payments are processed by Razorpay’s secure systems. No method of transmission or storage is completely secure.</p>
              </section>

              <section style={{ marginBottom: '2rem' }}>
                <h2 style={{ marginBottom: '1rem', color: 'var(--emerald-400)' }}>9. Changes to this policy</h2>
                <p>If we change this policy we will update the date at the top of this page and, where the change is significant, tell you in the app or by email.</p>
              </section>

              <section style={{ marginBottom: '2rem' }}>
                <h2 style={{ marginBottom: '1rem', color: 'var(--emerald-400)' }}>10. Contact</h2>
                <p>Book Arena — <a href="mailto:support@bookmyarena.in">support@bookmyarena.in</a></p>
              </section>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
