import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { BLOG_POSTS } from '@/data/blogPosts';
import { setPageMeta } from '@/lib/seo';

export default function Blog() {
  useEffect(() => {
    setPageMeta({
      title: 'Blog — Tips for Turf Booking & Finding Players | Book Arena',
      description: 'Read simple guides and tips for booking sports turfs and finding players for your matches.',
      keywords: 'turf booking blog, sports booking tips, find players, book arena blog',
      canonicalUrl: 'https://bookarena.in/blog'
    });
  }, []);

  return (
    <div className="page-wrapper">
      <Navbar />

      <main style={{ paddingTop: '120px', paddingBottom: '5rem' }}>
        <div className="container">
          <div className="section-header">
            <div className="section-tag">📝 Guides</div>
            <h1 className="section-title">Book Arena Blog</h1>
            <p className="section-subtitle">Practical tips for turf booking and match planning</p>
          </div>

          <div className="grid-2" style={{ gap: '1.5rem' }}>
            {BLOG_POSTS.map((post) => (
              <Link
                key={post.slug}
                to={`/blog/${post.slug}`}
                className="card"
                style={{ padding: '1.5rem', textDecoration: 'none' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    {new Date(post.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{post.readTime}</div>
                </div>

                <h2 style={{ marginTop: '0.75rem', marginBottom: '0.5rem' }}>{post.title}</h2>
                <p style={{ color: 'var(--text-muted)', marginBottom: 0, lineHeight: 1.7 }}>{post.excerpt}</p>
              </Link>
            ))}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

