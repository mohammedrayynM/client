import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ImagePlus, X } from 'lucide-react';
import { apiGet, apiPost, apiPut, API_BASE } from '@/lib/api';
import { resolveMediaUrl } from '@/lib/mediaUrl';

export default function ActivityManagement() {
  const [activities, setActivities] = useState([]);
  const [activityId, setActivityId] = useState('');
  const [ticketTypes, setTicketTypes] = useState([]);
  const [form, setForm] = useState({ name: '', description: '', price: '', image_url: '', product_type: 'ENTRY', requires_entry: false });
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadActivities = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGet('/owner-activities');
      const rows = res.activities || [];
      setActivities(rows);
      setActivityId((current) => current || String(rows[0]?.id || ''));
    } catch (e) { setError(e.message || 'Could not load your activities.'); }
    finally { setLoading(false); }
  }, []);

  const loadTickets = useCallback(async () => {
    if (!activityId) { setTicketTypes([]); return; }
    try { const res = await apiGet(`/owner-activities/${activityId}`); setTicketTypes(res.ticket_types || []); }
    catch (e) { setError(e.message || 'Could not load ticket types.'); }
  }, [activityId]);

  useEffect(() => { loadActivities(); }, [loadActivities]);
  useEffect(() => { loadTickets(); }, [loadTickets]);

  const uploadImage = async (file) => {
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) || !/\.(jpe?g|png|webp)$/i.test(file.name)) {
      setError('Choose a JPG, PNG, or WebP image.'); return;
    }
    if (file.size > 10 * 1024 * 1024) { setError('Image must be 10MB or smaller.'); return; }
    setUploading(true); setError('');
    try {
      const body = new FormData(); body.append('image', file);
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/owners/upload-image`, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) throw new Error(data.error || 'Image upload failed.');
      setForm((current) => ({ ...current, image_url: data.url }));
    } catch (e) { setError(e.message || 'Image upload failed.'); }
    finally { setUploading(false); }
  };

  const save = async (e) => {
    e.preventDefault();
    if (!activityId || !form.name.trim() || form.price === '' || Number(form.price) < 0) {
      setError('Choose an activity and enter a name and valid price.'); return;
    }
    setSaving(true); setError(''); setNotice('');
    try {
      const body = { name: form.name.trim(), description: form.description.trim(), price: Number(form.price), image_url: form.image_url || null, product_type: form.product_type || 'ENTRY', requires_entry: !!form.requires_entry };
      if (editingId) await apiPut(`/owner-activities/${activityId}/ticket-types/${editingId}`, body);
      else await apiPost(`/owner-activities/${activityId}/ticket-types`, body);
      setForm({ name: '', description: '', price: '', image_url: '', product_type: 'ENTRY', requires_entry: false }); setEditingId(null);
      setNotice('Ticket or activity saved. Its image is now attached to this item.');
      await loadTickets();
    } catch (e) { setError(e.message || 'Could not save this ticket or activity.'); }
    finally { setSaving(false); }
  };

  const edit = (item) => {
    setEditingId(item.id);
    setForm({ name: item.name || '', description: item.description || '', price: String(item.price ?? ''), image_url: item.image_url || '', product_type: item.product_type || 'ENTRY', requires_entry: !!item.requires_entry });
    setError(''); setNotice('');
  };

  return <div className="min-h-screen bg-slate-950 text-white px-4 py-8 sm:px-8">
    <div className="mx-auto max-w-5xl">
      <Link to="/owner/dashboard" className="mb-6 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-emerald-400"><ArrowLeft size={16} /> Owner dashboard</Link>
      <h1 className="text-3xl font-black">Activities & ticket images</h1>
      <p className="mt-2 max-w-2xl text-sm text-slate-400">Add one primary image to each entry ticket, ride, or activity. Images are stored on the selected item and appear in public booking and checkout.</p>

      {error && <div role="alert" className="mt-5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300">{error}</div>}
      {notice && <div role="status" className="mt-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">{notice}</div>}

      <section className="mt-7 rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <label className="mb-2 block text-xs font-bold uppercase text-slate-400">Choose your park or activity</label>
        {loading ? <p className="text-sm text-slate-400">Loading activities…</p> : activities.length ? <select value={activityId} onChange={(e) => { setActivityId(e.target.value); setEditingId(null); setForm({ name: '', description: '', price: '', image_url: '', product_type: 'ENTRY', requires_entry: false }); }} className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-white">{activities.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select> : <p className="text-sm text-slate-400">No activities found in this owner account.</p>}
      </section>

      {activityId && <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="mb-4 text-lg font-extrabold">{editingId ? 'Edit ticket or activity' : 'Add ticket or activity'}</h2>
          <form onSubmit={save} className="space-y-4">
            <label className="block text-xs font-semibold text-slate-300">Name<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 block w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-white" /></label>
            <label className="block text-xs font-semibold text-slate-300">Description<textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="mt-1 block w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-white" /></label>
            <label className="block text-xs font-semibold text-slate-300">Category<select value={form.product_type} onChange={(e) => setForm({ ...form, product_type: e.target.value })} className="mt-1 block w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-white">{['ENTRY', 'RIDE', 'ACTIVITY', 'PASS'].map((type) => <option key={type}>{type}</option>)}</select></label>
            <label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={form.requires_entry} onChange={(e) => setForm({ ...form, requires_entry: e.target.checked })} /> Requires a separate park entry ticket</label>
            <label className="block text-xs font-semibold text-slate-300">Price<input required type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="mt-1 block w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-white" /></label>
            <div>
              <span className="block text-xs font-semibold text-slate-300">Primary image (JPG, PNG, WebP; max 10MB)</span>
              {form.image_url && <div className="relative mt-2 w-fit"><img src={resolveMediaUrl(form.image_url)} alt="Activity preview" className="h-36 w-56 rounded-xl object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} /><button type="button" onClick={() => setForm({ ...form, image_url: '' })} className="absolute -right-2 -top-2 rounded-full bg-slate-800 p-1 text-white" aria-label="Remove image"><X size={15} /></button></div>}
              <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm font-bold text-emerald-400 hover:border-emerald-500"><ImagePlus size={16} />{uploading ? 'Uploading…' : form.image_url ? 'Replace image' : 'Upload image'}<input type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" className="hidden" disabled={uploading} onChange={(e) => { uploadImage(e.target.files?.[0]); e.target.value = ''; }} /></label>
            </div>
            <div className="flex gap-3"><button disabled={saving || uploading} className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-extrabold text-white disabled:opacity-50">{saving ? 'Saving…' : editingId ? 'Save changes' : 'Add item'}</button>{editingId && <button type="button" onClick={() => { setEditingId(null); setForm({ name: '', description: '', price: '', image_url: '', product_type: 'ENTRY', requires_entry: false }); }} className="rounded-xl border border-slate-700 px-4 py-3 text-sm font-bold text-slate-300">Cancel</button>}</div>
          </form>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="mb-4 text-lg font-extrabold">Saved items</h2>
          <div className="space-y-3">{ticketTypes.length ? ticketTypes.map((item) => <button key={item.id} type="button" onClick={() => edit(item)} className="flex w-full items-center gap-3 rounded-xl border border-slate-800 bg-slate-950 p-3 text-left hover:border-emerald-500/50">
            {item.image_url ? <img src={resolveMediaUrl(item.image_url)} alt="" className="h-14 w-16 rounded-lg object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} /> : <div className="flex h-14 w-16 items-center justify-center rounded-lg bg-slate-900 text-slate-500"><ImagePlus size={18} /></div>}
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-white">{item.name}</span><span className="block truncate text-xs text-slate-400">{item.description || 'No description'}</span></span><span className="text-sm font-extrabold text-emerald-400">{item.price}</span>
          </button>) : <p className="text-sm text-slate-400">No ticket types yet. Add the first one here.</p>}</div>
        </section>
      </div>}
    </div>
  </div>;
}
