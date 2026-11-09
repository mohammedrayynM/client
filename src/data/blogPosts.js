export const BLOG_POSTS = [
  {
    slug: 'how-to-book-a-turf-fast',
    title: 'How to Book a Turf Fast (Without Calling Anyone)',
    excerpt: 'A quick guide to finding the right venue, selecting slots, and confirming instantly with secure payments.',
    date: '2026-04-20',
    readTime: '3 min read',
    keywords: 'book turf, turf booking tips, sports booking, book arena'
  },
  {
    slug: 'find-players-like-a-pro',
    title: 'Find Players Like a Pro: Fill Your Game Faster',
    excerpt: 'Learn how to raise a Find Players request, write a clear note, and get nearby players to join.',
    date: '2026-04-25',
    readTime: '4 min read',
    keywords: 'find players, join match, sports community, book arena'
  },
  {
    slug: 'what-to-check-before-you-pay',
    title: 'What to Check Before You Pay for a Slot',
    excerpt: 'A simple checklist covering turf location, court type, timings, amenities, and cancellation rules.',
    date: '2026-05-05',
    readTime: '4 min read',
    keywords: 'turf booking checklist, sports venue, payment, book arena'
  }
];

export function getBlogPost(slug) {
  return BLOG_POSTS.find(p => p.slug === slug) || null;
}

