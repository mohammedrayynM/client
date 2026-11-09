import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { setJsonLd, setPageMeta } from '@/lib/seo';

const founderName = 'Hafiz Mohammed Rayyan M';
const founderUrl = 'https://bookarena.in/about/founder';
const founderImage = 'https://bookarena.in/images/about/hafiz-mohammed-rayyan-m-book-arena-founder.png';
const organizationId = 'https://bookarena.in/#organization';

export default function FounderProfile() {
  useEffect(() => {
    setPageMeta({
      title: `${founderName} — Founder & CEO of Book Arena`,
      description: `Meet ${founderName}, Founder & CEO of Book Arena, a platform for discovering and booking sports venues and recreational activities.`,
      canonicalUrl: founderUrl,
      imageUrl: founderImage,
      type: 'profile'
    });
    setJsonLd({
      id: 'founder-profile',
      data: {
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'Organization',
            '@id': organizationId,
            name: 'Book Arena',
            url: 'https://bookarena.in/',
            founder: { '@id': `${founderUrl}#person` }
          },
          {
            '@type': 'Person',
            '@id': `${founderUrl}#person`,
            name: founderName,
            jobTitle: 'Founder & CEO',
            image: founderImage,
            url: founderUrl,
            worksFor: { '@id': organizationId }
          },
          {
            '@type': 'WebPage',
            '@id': `${founderUrl}#webpage`,
            url: founderUrl,
            name: `${founderName} — Founder & CEO of Book Arena`,
            description: `Meet ${founderName}, Founder & CEO of Book Arena, a platform for discovering and booking sports venues and recreational activities.`,
            primaryImageOfPage: { '@type': 'ImageObject', url: founderImage },
            mainEntity: { '@id': `${founderUrl}#person` },
            about: { '@id': organizationId }
          }
        ]
      }
    });
  }, []);

  return (
    <div className="page-wrapper">
      <Navbar />
      <main className="founder-profile-page" style={{ paddingTop: '120px', paddingBottom: '5rem' }}>
        <div className="container">
          <nav aria-label="Breadcrumb" style={{ marginBottom: '1.5rem', color: 'var(--text-muted)' }}>
            <Link to="/about">About Book Arena</Link> <span aria-hidden="true">/</span> Founder
          </nav>
          <article className="founder-profile-card">
            <div className="founder-profile-image">
              <img
                src="/images/about/hafiz-mohammed-rayyan-m-book-arena-founder.png"
                alt="Hafiz Mohammed Rayyan M, Founder and CEO of Book Arena"
                width="768"
                height="1024"
                fetchPriority="high"
              />
            </div>
            <div className="founder-profile-copy">
              <p className="section-tag">Book Arena leadership</p>
              <h1>{founderName}</h1>
              <p className="founder-profile-title">Founder &amp; CEO, Book Arena</p>
              <p>
                Hafiz Mohammed Rayyan M is the Founder &amp; CEO of Book Arena, a sports and activity booking platform designed to make it easier for people to discover venues, explore activities, and book experiences online. Through Book Arena, he aims to simplify access to sports facilities, amusement parks, and recreational experiences through technology.
              </p>
              <p>
                Learn more about the platform on the <a href="https://bookarena.in/">official Book Arena website</a>, or visit the <Link to="/about">About Book Arena page</Link>.
              </p>
            </div>
          </article>
        </div>
      </main>
      <Footer />
    </div>
  );
}
