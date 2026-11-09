import { API_BASE } from './api';

/** Turn stored upload paths into browser-loadable URLs (handles split dev ports). */
export function resolveMediaUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (/^(https?:|blob:|data:)/i.test(trimmed)) return trimmed;

  if (trimmed.startsWith('/api/') && API_BASE.startsWith('http')) {
    const origin = API_BASE.replace(/\/api\/?$/i, '');
    return `${origin}${trimmed}`;
  }

  return trimmed;
}

export function normalizePhotoEntry(entry) {
  if (typeof entry === 'string') {
    const trimmed = entry.trim();
    return trimmed || null;
  }
  if (entry && typeof entry === 'object') {
    const url = entry.url || entry.src || entry.path;
    if (typeof url === 'string' && url.trim()) return url.trim();
  }
  return null;
}

export function normalizePhotoList(list) {
  if (!Array.isArray(list)) return [];
  return list.map(normalizePhotoEntry).filter(Boolean);
}
