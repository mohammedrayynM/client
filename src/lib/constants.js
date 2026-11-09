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

export const VENUE_CATEGORIES = {
  sports_court: {
    id: 'sports_court',
    title: 'Sports & Court Bookings',
    shortTitle: 'Sports & Turfs',
    icon: '⚽',
    emoji: '🏆',
    description: 'Cricket turfs, football grounds, badminton, tennis, basketball courts, and multi-sport arenas.',
    defaultBookingModel: 'SLOT',
    capabilities: ['court_management', 'slot_scheduling', 'price_per_slot', 'sports_tournaments', 'find_players', 'sports_reports'],
    examples: ['Cricket Turfs', 'Football Fields', 'Badminton Courts', 'Tennis Courts', 'Basketball Arenas'],
    badgeColor: '#10b981',
  },
  amusement_park: {
    id: 'amusement_park',
    title: 'Amusement Parks & Attractions',
    shortTitle: 'Amusement & Theme Parks',
    icon: '🎡',
    emoji: '🎢',
    description: 'Theme parks, trampoline parks, go-karting, VR game zones, indoor adventure play zones, and attractions.',
    defaultBookingModel: 'TICKET',
    capabilities: ['attraction_management', 'ticket_types', 'ticket_inventory', 'session_passes', 'qr_checkin', 'sales_reports'],
    examples: ['Amusement Parks', 'Trampoline Parks', 'Go-Karting Tracks', 'VR Gaming Zones', 'Kids Play Centers'],
    badgeColor: '#f59e0b',
  },
  swimming_recreation: {
    id: 'swimming_recreation',
    title: 'Swimming Pools & Recreational Activities',
    shortTitle: 'Swimming & Recreation',
    icon: '🏊',
    emoji: '🌊',
    description: 'Swimming pools, swimming academies, fitness sessions, recreational water parks, and scheduled classes.',
    defaultBookingModel: 'SESSION',
    capabilities: ['activity_management', 'session_scheduling', 'capacity_limits', 'qr_checkin', 'recreation_reports'],
    examples: ['Olympic Pools', 'Swimming Coaching', 'Water Recreation', 'Fitness / Aqua Aerobics'],
    badgeColor: '#0ea5e9',
  },
};

export const SUPPORTED_COUNTRIES = [
  { code: 'IN', name: 'India', currency: 'INR', symbol: '₹', timezone: 'Asia/Kolkata', locale: 'en-IN' },
  { code: 'AE', name: 'United Arab Emirates', currency: 'AED', symbol: 'AED', timezone: 'Asia/Dubai', locale: 'en-AE' },
  { code: 'US', name: 'United States', currency: 'USD', symbol: '$', timezone: 'America/New_York', locale: 'en-US' },
  { code: 'GB', name: 'United Kingdom', currency: 'GBP', symbol: '£', timezone: 'Europe/London', locale: 'en-GB' },
  { code: 'SA', name: 'Saudi Arabia', currency: 'SAR', symbol: 'SAR', timezone: 'Asia/Riyadh', locale: 'en-SA' },
  { code: 'QA', name: 'Qatar', currency: 'QAR', symbol: 'QAR', timezone: 'Asia/Qatar', locale: 'en-QA' },
  { code: 'KW', name: 'Kuwait', currency: 'KWD', symbol: 'KWD', timezone: 'Asia/Kuwait', locale: 'en-KW' },
  { code: 'OM', name: 'Oman', currency: 'OMR', symbol: 'OMR', timezone: 'Asia/Muscat', locale: 'en-OM' },
  { code: 'BH', name: 'Bahrain', currency: 'BHD', symbol: 'BHD', timezone: 'Asia/Bahrain', locale: 'en-BH' },
];

const CURRENCY_LOCALES = {
  INR: 'en-IN',
  AED: 'en-AE',
  USD: 'en-US',
  GBP: 'en-GB',
  EUR: 'en-EU',
  SAR: 'en-SA',
  QAR: 'en-QA',
  KWD: 'en-KW',
  OMR: 'en-OM',
  BHD: 'en-BH',
};

export function formatPrice(amount, currency = 'INR') {
  const curr = String(currency || 'INR').toUpperCase();
  const locale = CURRENCY_LOCALES[curr] || 'en-IN';
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: curr,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(Number(amount) || 0);
  } catch (err) {
    return `${curr} ${Number(amount) || 0}`;
  }
}

export function formatCompactNumber(number, currency = 'INR') {
  if (!number) return formatPrice(0, currency);
  return formatPrice(number, currency);
}

export function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function parseTimeValue(timeValue) {
  const raw = String(timeValue || '').trim();
  if (!raw) return null;

  const match = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (!match) return null;

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10) || 0;
  const modifier = match[4];

  if (modifier) {
    if (modifier.toUpperCase() === 'PM' && hours !== 12) hours += 12;
    if (modifier.toUpperCase() === 'AM' && hours === 12) hours = 0;
  }

  if (hours === 24 && minutes === 0) hours = 0;
  if (!Number.isFinite(hours) || hours < 0 || hours > 24 || minutes < 0 || minutes > 59) {
    return null;
  }

  return { hours: hours % 24, minutes };
}

export function formatTime12Hour(timeValue) {
  const parsed = parseTimeValue(timeValue);
  if (!parsed) return String(timeValue || '').trim();

  const { hours, minutes } = parsed;
  const modifier = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  return `${hour12}:${String(minutes).padStart(2, '0')} ${modifier}`;
}

function formatSingleSlotRange(slotValue) {
  const raw = String(slotValue || '').trim();
  if (!raw) return raw;

  const match = raw.match(/^(.+?)\s*-\s*(.+)$/);
  if (!match) return formatTime12Hour(raw);

  return `${formatTime12Hour(match[1])} - ${formatTime12Hour(match[2])}`;
}

export function formatSlotTime(slotValue) {
  const raw = String(slotValue || '').trim();
  if (!raw) return raw;

  if (raw.includes(',')) {
    return raw
      .split(',')
      .map(part => formatSingleSlotRange(part))
      .join(', ');
  }

  return formatSingleSlotRange(raw);
}

// Default turf images when no image is provided
export const DEFAULT_TURF_IMAGES = [
  'https://images.unsplash.com/photo-1529900748604-07564a03e7a6?w=800&q=80',
  'https://images.unsplash.com/photo-1551958219-acbc608c6377?w=800&q=80',
  'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&q=80',
];
