const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
// Set to false to connect to the live backend server instead of LocalStorage
const USE_MOCK = false;

import { mockGet, mockPost, mockPut, mockDelete } from './mockDb';

export async function apiGet(endpoint) {
  if (USE_MOCK) return await mockGet(endpoint);

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, { headers });
    const data = await res.json();
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('token');
          if (!window.location.pathname.includes('login')) {
            window.location.href = window.location.pathname.includes('admin') ? '/admin/login' : '/owner/login';
          }
        }
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

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('token');
          if (!window.location.pathname.includes('login')) {
            window.location.href = window.location.pathname.includes('admin') ? '/admin/login' : '/owner/login';
          }
        }
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

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('token');
          if (!window.location.pathname.includes('login')) {
            window.location.href = window.location.pathname.includes('admin') ? '/admin/login' : '/owner/login';
          }
        }
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

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: 'DELETE',
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Server error');
    return data;
  } catch (err) {
    throw err;
  }
}
