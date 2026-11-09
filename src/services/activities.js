import { apiGet, apiPost } from '../lib/api';

// Public / customer-facing (ticket-booking engine)
export const fetchCategories = async () => {
  const res = await apiGet('/activities/categories');
  return res.categories || [];
};

export const fetchActivities = async ({ category, location, search, section, lat, lng, sort } = {}) => {
  const q = [];
  if (category) q.push(`category=${encodeURIComponent(category)}`);
  if (location) q.push(`location=${encodeURIComponent(location)}`);
  if (search) q.push(`search=${encodeURIComponent(search)}`);
  if (section) q.push(`section=${encodeURIComponent(section)}`);
  if (lat != null && lng != null) q.push(`lat=${lat}`, `lng=${lng}`);
  if (sort) q.push(`sort=${encodeURIComponent(sort)}`);
  const res = await apiGet(`/activities${q.length ? `?${q.join('&')}` : ''}`);
  return res.activities || [];
};

export const fetchActivity = (slug) => apiGet(`/activities/${slug}`);
export const fetchCurrentCustomer = async () => (await apiGet('/users/me')).user;

export const fetchAvailability = (slug, date) => apiGet(`/activities/${slug}/availability?date=${date}`);

export const fetchOpenDates = async (slug) => {
  const res = await apiGet(`/activities/${slug}/open-dates`);
  return res.dates || [];
};

export const pricePreview = (body) => apiPost('/activities/price-preview', body);

export const createActivityBooking = (body) => apiPost('/activities/book', body);

export const verifyActivityPayment = (body) => apiPost('/activities/verify', body);

export const cancelPendingBooking = (body) => apiPost('/activities/cancel-pending', body);

export const fetchMyTickets = async (tab) => {
  const res = await apiGet(`/activities/my/tickets${tab ? `?tab=${tab}` : ''}`);
  return res.bookings || [];
};

export const fetchMyTicketDetail = (bookingId) => apiGet(`/activities/my/tickets/${bookingId}`);
