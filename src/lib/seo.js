// Lightweight SEO helpers (SPA-safe).
// - Updates existing <title> and <meta> tags without creating duplicates.
// - Adds missing tags only when safe/necessary (e.g., robots, canonical, JSON-LD).

function upsertMetaByName(name, content) {
  if (typeof document === 'undefined') return;
  if (!name) return;
  const key = String(name).trim();
  if (!key) return;

  const el = document.head?.querySelector(`meta[name="${CSS.escape(key)}"]`);
  if (el) {
    if (content != null) el.setAttribute('content', String(content));
    return;
  }

  // Only create if it doesn't exist (prevents duplicates).
  const m = document.createElement('meta');
  m.setAttribute('name', key);
  if (content != null) m.setAttribute('content', String(content));
  document.head?.appendChild(m);
}

function upsertMetaByProperty(property, content) {
  if (typeof document === 'undefined') return;
  if (!property) return;
  const key = String(property).trim();
  if (!key) return;

  const el = document.head?.querySelector(`meta[property="${CSS.escape(key)}"]`);
  if (el) {
    if (content != null) el.setAttribute('content', String(content));
    return;
  }

  const m = document.createElement('meta');
  m.setAttribute('property', key);
  if (content != null) m.setAttribute('content', String(content));
  document.head?.appendChild(m);
}

function upsertLinkRel(rel, href) {
  if (typeof document === 'undefined') return;
  const key = String(rel || '').trim();
  if (!key) return;

  const el = document.head?.querySelector(`link[rel="${CSS.escape(key)}"]`);
  if (el) {
    if (href != null) el.setAttribute('href', String(href));
    return;
  }
  const l = document.createElement('link');
  l.setAttribute('rel', key);
  if (href != null) l.setAttribute('href', String(href));
  document.head?.appendChild(l);
}

export const BOOK_ARENA_ORGANIZATION = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': 'https://bookarena.in/#organization',
  name: 'Book Arena',
  url: 'https://bookarena.in/',
  logo: 'https://bookarena.in/images/logo.png',
  description: 'Book Arena is a sports turf booking platform for discovering and booking turfs online.',
  founder: {
    '@type': 'Person',
    name: 'Mookaney Mohammed Rayyan'
  },
  employee: [
    {
      '@type': 'Person',
      name: 'Mookaney Mohammed Rayyan',
      jobTitle: 'CEO'
    }
  ],
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'Marble Hall Street, Periyamet',
    addressLocality: 'Chennai',
    addressRegion: 'Tamil Nadu',
    addressCountry: 'IN'
  },
  contactPoint: [{
    '@type': 'ContactPoint',
    telephone: '+91 89034 95256',
    contactType: 'customer support',
    areaServed: 'IN',
    availableLanguage: ['en']
  }]
};

export const BOOK_ARENA_WEBSITE = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': 'https://bookarena.in/#website',
  url: 'https://bookarena.in/',
  name: 'Book Arena',
  publisher: {
    '@id': 'https://bookarena.in/#organization'
  },
  potentialAction: {
    '@type': 'SearchAction',
    target: 'https://bookarena.in/turfs?search={search_term_string}',
    'query-input': 'required name=search_term_string'
  }
};

export function setPageMeta({ title, description, keywords, robots, canonicalUrl, author, type = 'website', imageUrl } = {}) {
  if (typeof document === 'undefined') return;

  if (title) document.title = String(title);
  if (description) upsertMetaByName('description', description);
  if (keywords) upsertMetaByName('keywords', keywords);
  if (robots) upsertMetaByName('robots', robots);
  if (author) upsertMetaByName('author', author);
  if (canonicalUrl) upsertLinkRel('canonical', canonicalUrl);

  if (title) {
    upsertMetaByProperty('og:title', title);
    upsertMetaByName('twitter:title', title);
  }
  if (description) {
    upsertMetaByProperty('og:description', description);
    upsertMetaByName('twitter:description', description);
  }
  if (canonicalUrl) {
    upsertMetaByProperty('og:url', canonicalUrl);
  }
  upsertMetaByProperty('og:type', type);
  upsertMetaByName('twitter:card', imageUrl ? 'summary_large_image' : 'summary');
  if (imageUrl) {
    upsertMetaByProperty('og:image', imageUrl);
    upsertMetaByName('twitter:image', imageUrl);
  }
}

export function setJsonLd({ id, data }) {
  if (typeof document === 'undefined') return;
  if (!id) return;

  const scriptId = `jsonld-${String(id)}`;
  const existing = document.head?.querySelector(`#${CSS.escape(scriptId)}`);
  const json = JSON.stringify(data || {}, null, 0);

  if (existing) {
    existing.textContent = json;
    return;
  }

  const s = document.createElement('script');
  s.type = 'application/ld+json';
  s.id = scriptId;
  s.textContent = json;
  document.head?.appendChild(s);
}
