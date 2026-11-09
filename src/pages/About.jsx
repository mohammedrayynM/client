
import { useEffect } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { setPageMeta } from '@/lib/seo';
import { Link } from 'react-router-dom';

const founderImage = '/images/about/hafiz-mohammed-rayyan-m-book-arena-founder.png';

export default function AboutUs() {
  useEffect(() => {
    setPageMeta({
      title: 'About Book Arena — Turf Booking Made Simple',
      description: 'Learn about Book Arena and how we help players discover and book sports turfs with instant confirmation and secure payments.',
      keywords: 'about book arena, turf booking platform, sports venue booking, book turfs online',
      canonicalUrl: 'https://bookarena.in/about',
      imageUrl: `https://bookarena.in${founderImage}`
    });
  }, []);

  return (
    <div className="page-wrapper">
      <Navbar />
      
      <main style={{ paddingTop: '120px', paddingBottom: '5rem' }}>
        <div className="container">
          <div className="grid-2 founder-about-layout" style={{ alignItems: 'center', marginBottom: '4rem' }}>
            <div>
              <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '3.5rem', fontWeight: 900, marginBottom: '1.5rem', lineHeight: '1.1' }}>
                Join the <span style={{ color: 'var(--emerald-400)' }}>Revolution</span> of Turf Booking.
              </h1>
              <p style={{ fontSize: '1.2rem', color: 'var(--text-muted)', marginBottom: '2rem' }}>
                BookArena.in is a platform built to seamlessly connect players and turf owners, making it easy for anyone to discover, book, and enjoy sports turfs at their convenience. The platform eliminates the hassle of phone calls and manual bookings by providing a smooth online experience for both users and turf owners. Whether you are looking to book a turf for a casual game or a competitive match, BookArena.in brings everything together in one place.
              </p>
              <div className="founder-about-copy">
                <span style={{ color: 'var(--emerald-400)', fontWeight: 700 }}>Founder &amp; CEO, Book Arena</span>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', margin: '0.5rem 0' }}>Hafiz Mohammed Rayyan M</h2>
                <p style={{ color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                  Hafiz founded Book Arena to make it easier to discover sports venues, activities, and recreational experiences and book them online.
                </p>
                <Link to="/about/founder" className="btn btn-secondary">Meet the founder</Link>
              </div>
            </div>
            <div className="card founder-about-photo" style={{ padding: '1rem', background: 'var(--gradient-emerald)', borderRadius: '24px' }}>
              <img src={founderImage}
                   alt="Hafiz Mohammed Rayyan M, Founder and CEO of Book Arena"
                   loading="lazy" decoding="async"
                   style={{ width: '100%', maxHeight: '640px', objectFit: 'cover', objectPosition: 'center 25%', borderRadius: '18px', display: 'block' }} />
            </div>
          </div>

          <div className="grid-3" style={{ gap: '2rem' }}>
            <div className="card" style={{ padding: '2rem' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🎯</div>
              <h3 style={{ marginBottom: '1rem' }}>Our Mission</h3>
              <p style={{ color: 'var(--text-muted)' }}>
                BookArena&apos;s mission is to build a strong sports community by making turf bookings fast, transparent, and enjoyable for every player and turf owner.
              </p>
            </div>
            <div className="card" style={{ padding: '2rem' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🌟</div>
              <h3 style={{ marginBottom: '1rem' }}>Our Vision</h3>
              <p style={{ color: 'var(--text-muted)' }}>
                The vision of BookArena is to become the most trusted sports booking platform across Tamil Nadu and beyond.
              </p>
            </div>
            <div className="card" style={{ padding: '2rem' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🤝</div>
              <h3 style={{ marginBottom: '1rem' }}>Built for Players & Owners</h3>
              <p style={{ color: 'var(--text-muted)' }}>
                From finding a venue to confirming a slot online, BookArena helps players get on the field faster and helps turf owners manage bookings with clarity and confidence.
              </p>
            </div>
          </div>

          <div className="card" style={{ marginTop: '4rem', padding: '3rem', textAlign: 'center', background: 'var(--gradient-dark)' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', marginBottom: '1.5rem' }}>Want to reach us?</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', maxWidth: '600px', margin: '0 auto 2rem' }}>
              For support, partnerships, or any other inquiries, feel free to contact us directly.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '3rem', flexWrap: 'wrap' }}>
              <div>
                <div style={{ color: 'var(--emerald-400)', fontWeight: 700 }}>Email</div>
                <div>mohamnedrayyan97@gmail.com</div>
              </div>
              <div>
                <div style={{ color: 'var(--emerald-400)', fontWeight: 700 }}>Phone</div>
                <div>+91 89034 95256</div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
