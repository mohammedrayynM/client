// Sport icons and colors mapping
export const SPORTS = {
  cricket: { emoji: '🏏', label: 'Cricket', color: '#10b981' },
  football: { emoji: '⚽', label: 'Football', color: '#3b82f6' },
  badminton: { emoji: '🏸', label: 'Badminton', color: '#f59e0b' },
  tennis: { emoji: '🎾', label: 'Tennis', color: '#ef4444' },
  basketball: { emoji: '🏀', label: 'Basketball', color: '#f97316' },
  volleyball: { emoji: '🏐', label: 'Volleyball', color: '#8b5cf6' },
  'box cricket': { emoji: '🏏', label: 'Box Cricket', color: '#06b6d4' },
  hockey: { emoji: '🏑', label: 'Hockey', color: '#ec4899' },
  swimming: { emoji: '🏊', label: 'Swimming', color: '#0ea5e9' },
  other: { emoji: '🏟️', label: 'Other', color: '#64748b' },
};

export const AMENITIES_LIST = [
  'Parking', 'Changing Room', 'Drinking Water', 'Washroom',
  'Floodlights', 'First Aid', 'Cafeteria', 'Wi-Fi',
  'Seating Area', 'Coaching', 'Equipment', 'CCTV',
  'Shower', 'Locker', 'Air Conditioning', 'Security'
];

export function getSportInfo(sportType) {
  const key = String(sportType || '').toLowerCase();
  if (SPORTS[key]) return SPORTS[key];
  return { emoji: '🏟️', label: sportType || 'Other', color: '#64748b' };
}

export function formatPrice(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
  }).format(amount);
}

export function formatCompactNumber(number) {
  if (!number) return '₹0';
  // User requested full digits instead of K/L/Cr
  return formatPrice(number);
}

export function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// Default turf images when no image is provided
export const DEFAULT_TURF_IMAGES = [
  'https://images.unsplash.com/photo-1529900748604-07564a03e7a6?w=800&q=80',
  'https://images.unsplash.com/photo-1551958219-acbc608c6377?w=800&q=80',
  'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&q=80',
];
