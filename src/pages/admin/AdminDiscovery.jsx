import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost, apiPut, apiDelete, API_BASE } from '@/lib/api';

const card = { padding: '1.25rem', marginBottom: '1rem' };
const h3 = { fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-primary)', fontSize: '1rem' };
const muted = { color: 'var(--text-muted)', fontSize: '0.85rem' };
const msg = (e, d) => e?.response?.data?.error || e?.message || d;

// Authentication Settings → Continue with Google (stored in the database, enforced by the server on each sign-in).
export function AuthSettings() {
  const [s, setS] = useState(null); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { try { setErr(''); const r = await apiGet('/admin/discovery/auth-settings'); setS({ enabled: !!r.google_login_enabled, configured: !!r.google_configured }); } catch (e) { setErr(msg(e, 'Could not load settings')); } }, []);
  useEffect(() => { load(); }, [load]);
  const toggle = async () => {
    if (busy || !s) return; const next = !s.enabled; setBusy(true); setErr('');
    try { await apiPut('/admin/discovery/auth-settings', { google_login_enabled: next }); setS({ ...s, enabled: next }); }
    catch (e) { setErr(msg(e, 'Could not save the setting')); } finally { setBusy(false); }
  };
  if (!s && !err) return <div className="card" style={card}>Loading…</div>;
  return (
    <div className="card" style={card}>
      <h3 style={h3}>Authentication Settings</h3>
      {err && <div style={{ color: 'var(--danger, #ef4444)', marginBottom: 8 }}>{err}</div>}
      {s && (<>
        <label style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 44, cursor: 'pointer' }}>
          <input type="checkbox" checked={s.enabled} onChange={toggle} disabled={busy} style={{ width: 22, height: 22 }} />
          <span><strong>Continue with Google</strong><br /><span style={muted}>{s.enabled ? 'ON — shown on the app login screen.' : 'OFF — hidden in the app and refused by the server.'}</span></span>
        </label>
        <p style={{ ...muted, marginTop: 10 }}>{s.configured ? '✓ GOOGLE_CLIENT_ID is configured on the server.' : '⚠ GOOGLE_CLIENT_ID is not set on the server, so this cannot be turned on yet.'} Google accounts only ever become customer accounts, never owners or admins.</p>
      </>)}
    </div>
  );
}

// Sport categories: the single list owners pick from and the app shows/searches.
export function SportCategories() {
  const [sports, setSports] = useState(null); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const [name, setName] = useState(''); const [aliases, setAliases] = useState(''); const [edit, setEdit] = useState(null);
  const [newImage, setNewImage] = useState(null); const [images, setImages] = useState({});
  const [pendingCategoryId, setPendingCategoryId] = useState(null);
  const load = useCallback(async () => { try { setErr(''); setSports((await apiGet('/admin/discovery/sports')).sports || []); } catch (e) { setErr(msg(e, 'Could not load sports')); } }, []);
  useEffect(() => { load(); }, [load]);
  const run = async (fn) => { if (busy) return; setBusy(true); setErr(''); try { await fn(); await load(); } catch (e) { setErr(msg(e, 'That did not work')); } finally { setBusy(false); } };
  const upload = async (id, file) => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Choose a JPG, PNG or WebP image');
    if (file.size > 5 * 1024 * 1024) throw new Error('Image must be 5MB or smaller');
    const body = new FormData(); body.append('image', file);
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE}/admin/discovery/sports/${id}/image`, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body });
    const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Could not upload image');
  };
  const add = () => run(async () => { if (name.trim().length < 2) throw new Error('Enter the sport name'); const id = pendingCategoryId || (await apiPost('/admin/discovery/sports', { name: name.trim(), aliases: aliases.split(',').map((a) => a.trim()).filter(Boolean) })).id; setPendingCategoryId(id); if (newImage) await upload(id, newImage); setName(''); setAliases(''); setNewImage(null); setPendingCategoryId(null); });
  const move = (i, d) => run(async () => {
    const order = sports.map((x) => x.id); [order[i], order[i + d]] = [order[i + d], order[i]];
    for (let k = 0; k < order.length; k++) await apiPut(`/admin/discovery/sports/${order[k]}`, { sort_order: (k + 1) * 10 });
  });
  return (
    <div className="card" style={card}>
      <h3 style={h3}>Sport Categories</h3>
      <p style={muted}>The first four enabled sports are the home-screen cards, in this order. Owners can only choose enabled sports.</p>
      {err && <div style={{ color: 'var(--danger, #ef4444)', margin: '8px 0' }}>{err}</div>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '12px 0' }}>
        <input className="input" style={{ minHeight: 44, flex: '1 1 180px' }} placeholder="New sport name" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="input" style={{ minHeight: 44, flex: '2 1 240px' }} placeholder="Search words, comma separated (optional)" value={aliases} onChange={(e) => setAliases(e.target.value)} />
        <label className="btn btn-secondary" style={{ minHeight: 44, display: 'flex', alignItems: 'center', gap: 8 }}>Category image<input aria-label="New sport category image" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setNewImage(e.target.files?.[0] || null)} style={{ maxWidth: 190 }} /></label>
        <button type="button" className="btn btn-primary" style={{ minHeight: 44 }} disabled={busy} onClick={add}>Add sport</button>
      </div>
      {!sports ? 'Loading…' : sports.map((s, i) => (
        <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: '1px solid var(--border-subtle)', opacity: s.is_enabled ? 1 : 0.55, flexWrap: 'wrap' }}>
          <span style={{ width: 24, fontWeight: 800, color: i < 4 && s.is_enabled ? 'var(--primary, #10b981)' : 'var(--text-muted)' }}>{i + 1}</span>
          <span style={{ flex: 1, minWidth: 140 }}>
            {edit?.id === s.id ? <input className="input" style={{ minHeight: 40 }} value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /> : <strong>{s.name}</strong>}
            <span style={{ ...muted, marginLeft: 8 }}>{s.venue_count} venue{s.venue_count === 1 ? '' : 's'}</span>
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', width: '100%', paddingLeft: 32 }}>
            {(images[s.id] || s.image_url) && <img src={images[s.id] ? URL.createObjectURL(images[s.id]) : s.image_url} alt={`${s.name} category`} style={{ width: 84, height: 56, objectFit: 'cover', borderRadius: 8 }} />}
            <label className="btn btn-secondary" style={{ minHeight: 38, display: 'inline-flex', alignItems: 'center' }}>{images[s.id] ? 'Replace selected' : s.image_url ? 'Replace image' : 'Upload image'}<input aria-label={`Upload image for ${s.name}`} type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setImages((v) => ({ ...v, [s.id]: e.target.files?.[0] }))} style={{ display: 'none' }} /></label>
            {images[s.id] && <button className="btn btn-primary" type="button" disabled={busy} onClick={() => run(async () => { await upload(s.id, images[s.id]); setImages((v) => { const n = { ...v }; delete n[s.id]; return n; }); })}>Save image</button>}
            {s.image_url && <button className="btn btn-secondary" type="button" disabled={busy} onClick={() => { if (window.confirm(`Remove image for ${s.name}?`)) run(() => apiDelete(`/admin/discovery/sports/${s.id}/image`)); }}>Remove image</button>}
          </div>
          <button type="button" className="btn btn-secondary" style={{ minHeight: 40 }} disabled={busy || i === 0} onClick={() => move(i, -1)}>↑</button>
          <button type="button" className="btn btn-secondary" style={{ minHeight: 40 }} disabled={busy || i === sports.length - 1} onClick={() => move(i, 1)}>↓</button>
          {edit?.id === s.id
            ? <><button type="button" className="btn btn-primary" style={{ minHeight: 40 }} disabled={busy} onClick={() => run(async () => { await apiPut(`/admin/discovery/sports/${s.id}`, { name: edit.name }); setEdit(null); })}>Save</button><button type="button" className="btn btn-secondary" style={{ minHeight: 40 }} onClick={() => setEdit(null)}>Cancel</button></>
            : <button type="button" className="btn btn-secondary" style={{ minHeight: 40 }} onClick={() => setEdit({ id: s.id, name: s.name })}>Rename</button>}
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, minHeight: 40 }}><input type="checkbox" checked={!!s.is_enabled} disabled={busy} onChange={(e) => run(() => apiPut(`/admin/discovery/sports/${s.id}`, { is_enabled: e.target.checked }))} style={{ width: 20, height: 20 }} />Enabled</label>
        </div>
      ))}
    </div>
  );
}
