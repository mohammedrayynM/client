import { useEffect, useMemo } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { BLOG_POSTS, getBlogPost } from '@/data/blogPosts';
import { setJsonLd, setPageMeta } from '@/lib/seo';

export default function BlogPost() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const post = useMemo(() => getBlogPost(slug), [slug]);

  useEffect(() => {
    if (!post) {
      setPageMeta({
        title: 'Blog — Book Arena',
        description: 'Read tips for turf booking and finding players on Book Arena.',
        keywords: 'book arena blog, turf booking tips',
        canonicalUrl: 'https://bookarena.in/blog'
      });
      return;
    }

    setPageMeta({
      title: `${post.title} | Book Arena Blog`,
      description: post.excerpt,
      keywords: post.keywords,
      canonicalUrl: `https://bookarena.in/blog/${post.slug}`
    });

    setJsonLd({
      id: `blog-${post.slug}`,
      data: {
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: post.title,
        description: post.excerpt,
        datePublished: post.date,
        mainEntityOfPage: `https://bookarena.in/blog/${post.slug}`,
        publisher: {
          '@type': 'Organization',
          name: 'Book Arena',
          url: 'https://bookarena.in/'
        }
      }
    });
  }, [post]);

  if (!post) {
    return (
      <div className="page-wrapper">
        <Navbar />
        <div className="container" style={{ paddingTop: 120, paddingBottom: 60, textAlign: 'center' }}>
          <h1 style={{ marginBottom: 8 }}>Post not found</h1>
          <p style={{ color: 'var(--text-muted)', marginBottom: 18 }}>This blog post does not exist.</p>
          <button className="btn btn-primary" onClick={() => navigate('/blog')}>
            Back to Blog
          </button>
        </div>
        <Footer />
      </div>
    );
  }

  const contentBlocks = (() => {
    // Static content (kept simple and safe, no CMS dependency).
    if (post.slug === 'how-to-book-a-turf-fast') {
      return [
        'Booking a turf should take minutes—not phone calls. On Book Arena, start by browsing the Turfs page and filtering by sport.',
        'Choose a venue that matches your timing and amenities. Then select a date and an available time slot.',
        'Enter your details, pay securely, and you will receive confirmation instantly. Your booking will also show up in your profile dashboard.'
      ];
    }
    if (post.slug === 'find-players-like-a-pro') {
      return [
        'If you already have a slot booked, raise a Find Players request so nearby players can join your game.',
        'Set clear roles needed, a fair contribution amount, and include a short note (e.g., skill level, friendly/competitive).',
        'When players join, your match updates in real-time and you can track contributions and participants easily.'
      ];
    }
    return [
      'Before paying, confirm the venue address, the exact court/turf, the date and time slot, and any amenities you need (parking, lights, washroom).',
      'Check the refund/cancellation rules so you know what happens if plans change.',
      'After payment, keep your receipt handy in your profile dashboard for quick reference.'
    ];
  })();

  return (
    <div className="page-wrapper">
      <Navbar />

      <main style={{ paddingTop: '120px', paddingBottom: '5rem' }}>
        <div className="container" style={{ maxWidth: 900 }}>
          <div className="card" style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                {new Date(post.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{post.readTime}</div>
            </div>

            <h1 style={{ marginTop: '0.75rem', marginBottom: '0.75rem' }}>{post.title}</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '1rem', lineHeight: 1.8 }}>{post.excerpt}</p>

            <div style={{ marginTop: '1.25rem', lineHeight: 1.9 }}>
              {contentBlocks.map((p, idx) => (
                <p key={idx} style={{ marginBottom: '1rem' }}>{p}</p>
              ))}
            </div>

            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1.25rem', marginTop: '1.5rem' }}>
              <Link to="/blog" className="btn btn-secondary">← Back to Blog</Link>
            </div>
          </div>

          <div style={{ marginTop: '1.5rem' }}>
            <h2 style={{ marginBottom: '0.75rem' }}>More posts</h2>
            <div className="grid-2" style={{ gap: '1rem' }}>
              {BLOG_POSTS.filter(p => p.slug !== post.slug).slice(0, 2).map(p => (
                <Link key={p.slug} to={`/blog/${p.slug}`} className="card" style={{ padding: '1.25rem', textDecoration: 'none' }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    {new Date(p.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                  <h3 style={{ marginTop: '0.5rem', marginBottom: 0 }}>{p.title}</h3>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

