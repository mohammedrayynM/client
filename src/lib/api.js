import { mockGet, mockPost, mockPut, mockDelete } from './mockDb';

function normalizeApiBase(raw) {
  const v = String(raw || '').trim();
  const isLocalDevHost =
    typeof window !== 'undefined' &&
    ['localhost', '127.0.0.1'].includes(window.location.hostname);

  // In local Vite development we want all browser requests to flow through the
  // dev proxy, even if a production API URL exists in `.env`.
  if (import.meta.env.DEV && isLocalDevHost) return '/api';

  // Default to same-origin backend for production deployments.
  if (!v) return '/api';

  // Allow envs like:
  // - https://example.com/api
  // - https://example.com
  // - http://localhost:5000/api
  // - http://localhost:5000
  const noTrailingSlash = v.replace(/\/+$/, '');
  if (noTrailingSlash.endsWith('/api')) return noTrailingSlash;
  return `${noTrailingSlash}/api`;
}

export const API_BASE = normalizeApiBase(import.meta.env.VITE_API_URL) || '/api';
// Set to false to connect to the live backend server instead of LocalStorage
const USE_MOCK = false;

function isOwnerEndpoint(endpoint) {
  return (
    endpoint.startsWith('/owners') ||
    endpoint.startsWith('/owner-activities') ||
    endpoint.startsWith('/coupons') ||
    endpoint.startsWith('/subscriptions')
  );
}

function isAdminEndpoint(endpoint) {
  return endpoint.startsWith('/admin');
}

function getAuthToken(endpoint) {
  if (typeof window === 'undefined') return null;
  // IMPORTANT:
  // This project stores multiple auth tokens in localStorage:
  // - userToken: player/user login
  // - token: owner/admin login
  //
  // Many player flows (Find Players, join match, availability) MUST use userToken,
  // otherwise actions/receipts can be attributed to the wrong account.
  if (isOwnerEndpoint(endpoint) || isAdminEndpoint(endpoint)) {
    return localStorage.getItem('token');
  }
  if (endpoint.startsWith('/users')) return localStorage.getItem('userToken');
  return localStorage.getItem('userToken') || localStorage.getItem('token');
}

function handleAuthFailure(endpoint) {
  if (typeof window === 'undefined') return;

  const publicPaths = ['/', '/turfs', '/login', '/signup', '/search'];
  const isPublicPath = publicPaths.some(p => window.location.pathname === p || window.location.pathname.startsWith('/turfs/'));

  if (endpoint.startsWith('/users') || (!isOwnerEndpoint(endpoint) && !isAdminEndpoint(endpoint))) {
    localStorage.removeItem('userToken');
    localStorage.removeItem('userData');
    if (!isPublicPath && !window.location.pathname.includes('login')) {
      window.location.href = '/login';
    }
    return;
  }

  localStorage.removeItem('token');
  if (!isPublicPath && !window.location.pathname.includes('login')) {
    window.location.href = window.location.pathname.includes('admin') ? '/admin/login' : '/owner/login';
  }
}

async function parseJsonResponse(res) {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch (err) {
    console.error('Failed to parse JSON:', text.substring(0, 500));
    throw new Error(`Server returned an invalid response: ${text.substring(0, 50) || 'Empty response'}. Check backend console.`);
  }
}

export async function apiGet(endpoint) {
  if (USE_MOCK) return await mockGet(endpoint);

  const token = getAuthToken(endpoint);
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, { headers });
    const data = await parseJsonResponse(res);
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        handleAuthFailure(endpoint);
      }
      throw new Error(data.error || 'Server error');
    }
    return data;
  } catch (err) {
    throw err;
  }
}

export async function apiPost(endpoint, body) {
  if (USE_MOCK) return await mockPost(endpoint, body);

  const token = getAuthToken(endpoint);
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    const data = await parseJsonResponse(res);
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        handleAuthFailure(endpoint);
      }
      throw new Error(data.error || 'Server error');
    }
    return data;
  } catch (err) {
    throw err;
  }
}

export async function apiPut(endpoint, body) {
  if (USE_MOCK) return await mockPut(endpoint, body);

  const token = getAuthToken(endpoint);
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(body),
    });
    const data = await parseJsonResponse(res);
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        handleAuthFailure(endpoint);
      }
      throw new Error(data.error || 'Server error');
    }
    return data;
  } catch (err) {
    throw err;
  }
}

export async function apiDelete(endpoint, body) {
  if (USE_MOCK) return await mockDelete(endpoint, body);

  const token = getAuthToken(endpoint);
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: 'DELETE',
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await parseJsonResponse(res);
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        handleAuthFailure(endpoint);
      }
      throw new Error(data.error || 'Server error');
    }
    return data;
  } catch (err) {
    throw err;
  }
}

export async function apiPatch(endpoint, body) {
  const token = getAuthToken(endpoint);
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(body),
    });
    const data = await parseJsonResponse(res);
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        handleAuthFailure(endpoint);
      }
      throw new Error(data.error || 'Server error');
    }
    return data;
  } catch (err) {
    throw err;
  }
}

