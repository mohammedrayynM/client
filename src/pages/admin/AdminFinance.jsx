import { useState, useEffect, useCallback, useRef } from 'react';
import { apiGet, apiPost, apiPut } from '@/lib/api';

// Billing amounts arrive as integer MINOR units; this is the only place the web admin converts them for display.
const DIGITS = { KWD: 3, OMR: 3, BHD: 3, JPY: 0 };
export function money(minor, currency = 'INR') {
  const n = Number(minor);
  if (!Number.isFinite(n)) return '—';
  const d = DIGITS[currency] ?? 2;
  try { return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: d }).format(n / 10 ** d); }
  catch { return `${currency} ${(n / 10 ** d).toFixed(d)}`; }
}
const fmtDT = (v) => (v ? new Date(v).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
const localYmd = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const card = { padding: '1.25rem', marginBottom: '1rem' };
const h3 = { fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-primary)', fontSize: '1rem' };
const muted = { color: 'var(--text-muted)', fontSize: '0.85rem' };

function Row({ k, v }) {
  return <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}><span style={muted}>{k}</span><span style={{ fontWeight: 600, textAlign: 'right', wordBreak: 'break-all' }}>{v === null || v === undefined || v === '' ? '—' : v}</span></div>;
}
function Metric({ label, value, hint, warn }) {
  return <div className="card" style={{ padding: '1rem' }}><div style={muted}>{label}</div><div style={{ fontSize: '1.4rem', fontWeight: 800, color: warn ? 'var(--gold-400, #f59e0b)' : 'var(--text-primary)', marginTop: 4 }}>{value}</div>{hint && <div style={{ ...muted, fontSize: '0.75rem', marginTop: 2 }}>{hint}</div>}</div>;
}
const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' };

/** A button that cannot be double-submitted: it locks while its async handler is running. */
function ActionButton({ onClick, children, className = 'btn btn-primary', disabled, style }) {
  const busy = useRef(false);
  const [, force] = useState(0);
  const run = async () => {
    if (busy.current || disabled) return;
    busy.current = true; force((n) => n + 1);
    try { await onClick(); } finally { busy.current = false; force((n) => n + 1); }
  };
  return <button type="button" className={className} style={{ minHeight: 44, ...style }} disabled={disabled || busy.current} onClick={run}>{busy.current ? 'Working…' : children}</button>;
}

// ───────────────────────────── Dashboard overview ─────────────────────────────
export function FinanceOverview({ onNavigate }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [cur, setCur] = useState(null);
  const [defs, setDefs] = useState(false);
  const load = useCallback(async () => {
    try { setError(''); const r = await apiGet('/admin/billing/overview'); setData(r); setCur((c) => c || r.primary_currency); }
    catch (e) { setError(e.message || 'Could not load the overview'); }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (error && !data) return <div className="card" style={card}><p style={{ color: '#ef4444' }}>{error}</p><button className="btn btn-secondary" onClick={load}>Try again</button></div>;
  if (!data) return <p style={muted}>Loading…</p>;
  const currencies = Object.keys(data.by_currency || {});
  const f = data.by_currency[cur] || {};
  const m = (v) => money(v, cur || 'INR');
  const p = data.platform;
  const go = (a) => onNavigate && onNavigate(a.action === 'payments' ? 'payment-lookup' : a.action === 'refunds' ? 'bookings' : a.action === 'turfs' ? 'venue-billing' : 'route');

  return (
    <div>
      {data.alerts.length > 0 && (<>
        <h3 style={h3}>Needs attention</h3>
        <div style={{ marginBottom: '1.5rem' }}>
          {data.alerts.map((a) => (
            <button key={a.key} type="button" onClick={() => go(a)} className="card" style={{ display: 'flex', gap: 12, alignItems: 'center', width: '100%', textAlign: 'left', padding: '0.75rem 1rem', marginBottom: 8, borderLeft: `3px solid ${a.severity === 'high' ? '#ef4444' : '#f59e0b'}`, cursor: 'pointer', minHeight: 44 }}>
              <strong style={{ fontSize: '1.1rem', minWidth: 28 }}>{a.count}</strong><span>{a.message}</span>
            </button>
          ))}
        </div>
      </>)}

      <h3 style={h3}>Platform overview</h3>
      <div style={grid}>
        <Metric label="Venues" value={p.venues_total} hint={`${p.venues_approved} approved`} />
        <Metric label="Awaiting approval" value={p.venues_pending} warn={p.venues_pending > 0} />
        <Metric label="Owners" value={p.owners_total} />
        <Metric label="Confirmed bookings" value={p.bookings_total} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <h3 style={h3}>Financial overview</h3>
        {currencies.length > 1 && <div style={{ display: 'flex', gap: 6 }}>{currencies.map((c) => <button key={c} className={`btn ${c === cur ? 'btn-primary' : 'btn-secondary'}`} style={{ minHeight: 36 }} onClick={() => setCur(c)}>{c}</button>)}</div>}
      </div>
      {currencies.length === 0 ? <p style={muted}>No payments yet. Figures appear after the first captured payment.</p> : (
        <div style={grid}>
          <Metric label="Captured payments" value={m(f.captured_payments_minor)} hint="Money actually received" />
          <Metric label="Platform revenue" value={m(f.platform_revenue_minor)} hint="Net of tax, settled only" />
          <Metric label="Owner share (eligible)" value={m(f.owner_eligible_minor)} />
          <Metric label="Transferred to owners" value={m(f.completed_transfers_minor)} hint={f.simulated_transfers_count ? `${f.simulated_transfers_count} test-mode excluded` : 'Confirmed at Razorpay'} />
          <Metric label="Pending transfers" value={m(f.pending_transfers_minor)} hint={`${f.pending_transfers_count} transfer(s)`} warn={f.pending_transfers_count > 0} />
          <Metric label="Tax collected" value={m(f.tax_collected_minor)} hint="To remit; not revenue" />
          <Metric label="Refunds completed" value={m(f.refunds_completed_minor)} />
          <Metric label="Refunds pending" value={m(f.refunds_pending_minor)} warn={f.refunds_pending_minor > 0} />
          <Metric label="Subscriptions outstanding" value={m(f.subscription_outstanding_minor)} warn={f.subscription_outstanding_minor > 0} />
          <Metric label="Gross booking value" value={m(f.gross_booking_value_minor)} hint="Not revenue" />
        </div>
      )}
      <button type="button" className="btn btn-secondary" style={{ minHeight: 44, marginBottom: 16 }} onClick={() => setDefs((v) => !v)}>{defs ? 'Hide definitions' : 'How are these calculated?'}</button>
      {defs && <div className="card" style={card}>{Object.entries(data.definitions).map(([k, v]) => <p key={k} style={{ ...muted, marginBottom: 6 }}><strong>{k.replace(/_/g, ' ')}:</strong> {v}</p>)}</div>}

      <h3 style={h3}>Operational overview</h3>
      <div className="grid-2">
        <div className="card" style={card}>
          <h4 style={h3}>Owner transfers needing attention</h4>
          {data.transfers_needing_attention.length ? data.transfers_needing_attention.map((t) => (
            <div key={t.id} style={{ padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><strong>{t.turf_name}</strong><span className="status-badge">{String(t.status).toLowerCase()}</span></div>
              <div style={muted}>{money(t.owner_minor, t.currency)} · {t.razorpay_payment_id}</div>
              {t.error_message && <div style={{ color: '#ef4444', fontSize: '0.8rem' }}>{t.error_message}</div>}
            </div>
          )) : <p style={muted}>Nothing pending.</p>}
        </div>
        <div className="card" style={card}>
          <h4 style={h3}>Recent bookings</h4>
          {data.recent_bookings.length ? data.recent_bookings.map((b) => (
            <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
              <div><strong>{b.customer_name || 'Customer'}</strong><div style={muted}>{b.turf_name}</div></div>
              <div style={{ textAlign: 'right' }}><div>{money(Math.round(Number(b.paid || 0) * 100), b.currency)}</div><span className={`status-badge status-${b.status}`}>{b.status}</span></div>
            </div>
          )) : <p style={muted}>No bookings yet.</p>}
        </div>
        <div className="card" style={card}>
          <h4 style={h3}>Venues awaiting approval</h4>
          {data.pending_approvals.length ? data.pending_approvals.map((t) => (
            <div key={t.id} style={{ padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}><strong>{t.name}</strong><div style={muted}>{t.owner_name || 'No owner'}</div></div>
          )) : <p style={muted}>No venues waiting.</p>}
        </div>
        <div className="card" style={card}>
          <h4 style={h3}>Recent admin activity</h4>
          {data.recent_activity.length ? data.recent_activity.map((a) => (
            <div key={`${a.kind}-${a.id}`} style={{ padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.85rem' }}>{String(a.action).replace(/_/g, ' ')}{a.turf_name ? ` · ${a.turf_name}` : ''}</div><div style={muted}>{a.admin_name || 'admin'} · {fmtDT(a.created_at)}</div>
            </div>
          )) : <p style={muted}>No activity recorded.</p>}
        </div>
      </div>
    </div>
  );
}

// ───────────────────────────── Payment ID lookup ─────────────────────────────
const ACTION_LABEL = { retry_transfer: 'Retry the failed transfer', reprocess: 'Process the payment again', create_transfer: 'Create the missing owner transfer' };
export function PaymentLookup() {
  const [pid, setPid] = useState('');
  const [view, setView] = useState(null);
  const [error, setError] = useState('');
  const [outcome, setOutcome] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState('');
  const lookup = async () => {
    const p = pid.trim(); setError(''); setOutcome('');
    if (!/^pay_[A-Za-z0-9]{8,32}$/.test(p)) { setView(null); setError('Enter a Razorpay payment id such as pay_XXXXXXXXXXXXXX.'); return; }
    try { setView(await apiGet(`/admin/billing/payments/lookup?payment_id=${encodeURIComponent(p)}`)); } catch (e) { setView(null); setError(e.message); }
  };
  const reconcile = async () => {
    try {
      const r = await apiPost('/admin/billing/payments/reconcile', { payment_id: view.payment.id, confirm_payment_id: typed.trim() });
      setOutcome(`Result: ${r.result.status || 'done'}${r.result.simulated ? ' (simulated, test mode)' : ''}${r.result.error ? `. ${r.result.error}` : ''}`);
      setView({ success: true, ...r.view });
    } catch (e) { setOutcome(e.message); }
    setConfirming(false); setTyped('');
  };
  const p = view && view.payment; const cur = p ? p.currency : 'INR';
  return (
    <div>
      <p style={muted}>Look up a Razorpay payment, compare it with bookings and owner transfers, and fix a missing or failed transfer.</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '12px 0' }}>
        <input className="form-input" style={{ flex: '1 1 260px', minHeight: 44 }} value={pid} onChange={(e) => setPid(e.target.value)} placeholder="pay_XXXXXXXXXXXXXX" autoCapitalize="none" onKeyDown={(e) => { if (e.key === 'Enter') lookup(); }} />
        <ActionButton onClick={lookup}>Look up payment</ActionButton>
      </div>
      {error && <p style={{ color: '#ef4444' }}>{error}</p>}
      {outcome && <p style={{ color: 'var(--emerald-400)' }}>{outcome}</p>}
      {view && p && (<div className="grid-2">
        <div className="card" style={card}><h4 style={h3}>Razorpay payment</h4>
          <Row k="Payment id" v={p.id} /><Row k="Status" v={p.status} /><Row k="Amount" v={money(p.amount_minor, cur)} /><Row k="Refunded" v={money(p.amount_refunded_minor, cur)} /><Row k="Order id" v={p.order_id} /><Row k="Method" v={p.method} /><Row k="Created" v={fmtDT(p.created_at)} /></div>
        <div className="card" style={card}><h4 style={h3}>Matched records</h4>
          <Row k="Venue" v={view.turf ? view.turf.name : 'No matching booking'} /><Row k="Owner" v={view.owner && view.owner.name} /><Row k="Linked account" v={view.linked_account && view.linked_account.id} /><Row k="Account status" v={view.linked_account && view.linked_account.status} /><Row k="Bookings" v={view.bookings.length ? view.bookings.map((b) => `#${b.id}`).join(', ') : 'None'} /></div>
        {view.expected && view.expected.source !== 'error' && <div className="card" style={card}><h4 style={h3}>Expected settlement</h4>
          <Row k="Platform fee" v={money(view.expected.platformFeeMinor, cur)} /><Row k="Tax on fee" v={money(view.expected.taxOnPlatformFeeMinor, cur)} /><Row k="Subscription deduction" v={money(view.expected.subscriptionDeductionMinor, cur)} /><Row k="Owner share" v={money(view.expected.ownerTransferMinor, cur)} /></div>}
        <div className="card" style={card}><h4 style={h3}>Transfers</h4>
          {view.ledger.length ? view.ledger.map((t) => <div key={t.id} style={{ marginBottom: 8 }}><Row k={`#${t.id} ${t.status}`} v={money(t.owner_transfer_minor, t.currency || cur)} /><Row k="Razorpay transfer" v={t.razorpay_transfer_id ? `${t.razorpay_transfer_id}${t.simulated ? ' (simulated)' : ''}` : null} />{t.error_message && <div style={{ color: '#ef4444', fontSize: '0.8rem' }}>{t.error_message}</div>}</div>) : <p style={muted}>No transfer record.</p>}</div>
        <div className="card" style={card}><h4 style={h3}>Checks</h4>
          {view.checks.map((c) => <div key={c.key} style={{ display: 'flex', gap: 10, padding: '4px 0' }}><strong style={{ color: c.ok ? 'var(--emerald-400)' : '#ef4444', width: 40 }}>{c.ok ? 'PASS' : 'FAIL'}</strong><span>{c.message}</span></div>)}
          {view.issues.map((i, n) => <p key={n} style={{ color: '#f59e0b', fontSize: '0.85rem' }}>{i}</p>)}</div>
        <div className="card" style={card}><h4 style={h3}>Recommended action</h4>
          <p style={{ fontWeight: 700 }}>{view.action.type === 'none' ? 'No action needed' : ACTION_LABEL[view.action.type]}</p>
          <p style={muted}>{view.action.reason}</p>
          {view.action.type !== 'none' && !confirming && <button type="button" className="btn btn-primary" style={{ minHeight: 44, marginTop: 8 }} onClick={() => { setTyped(''); setConfirming(true); }}>{ACTION_LABEL[view.action.type]}</button>}
          {confirming && <div style={{ marginTop: 12 }}>
            <p style={{ ...muted, color: '#ef4444' }}>This can move real money when the venue is live. Type the payment id to confirm.</p>
            <input className="form-input" style={{ minHeight: 44, margin: '8px 0' }} value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={p.id} autoCapitalize="none" />
            <div style={{ display: 'flex', gap: 8 }}><button type="button" className="btn btn-secondary" style={{ minHeight: 44 }} onClick={() => setConfirming(false)}>Cancel</button><ActionButton onClick={reconcile} disabled={typed.trim() !== p.id}>Run action</ActionButton></div>
          </div>}</div>
      </div>)}
    </div>
  );
}

// ───────────────────────────── Venue billing ─────────────────────────────
const MODEL_LABEL = { PERCENTAGE: 'Commission', FLAT: 'Flat fee per booking', SUBSCRIPTION: 'Subscription' };
const toMajor = (minor, cur) => (minor == null ? '' : String(minor / 10 ** (DIGITS[cur] ?? 2)));
const toPct = (bps) => (bps == null ? '' : String(bps / 100));
const formFrom = (c) => ({ billing_model: c.billing_model, commission_percent: toPct(c.commission_bps), flat_fee: toMajor(c.flat_fee_minor, c.currency), subscription_amount: toMajor(c.subscription_amount_minor, c.currency), subscription_policy: c.subscription_policy || 'DEDUCT_FROM_PROCEEDS', subscription_period: c.subscription_period || 'MONTHLY', subscription_start_date: c.subscription_anchor_date || '', grace_period_days: c.grace_period_days == null ? '' : String(c.grace_period_days), min_fee: toMajor(c.min_fee_minor, c.currency), max_fee: toMajor(c.max_fee_minor, c.currency), tax_mode: c.tax_mode || 'NONE', tax_percent: toPct(c.tax_bps), effective_from: '' });

function VenueDetail({ id, onBack }) {
  const [d, setD] = useState(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState(null);
  const [reason, setReason] = useState('');
  const [msg, setMsg] = useState('');
  const [noticeKind, setNoticeKind] = useState('PAYMENT_DUE_SOON');
  const [noticeBusy, setNoticeBusy] = useState(false);
  const [restrictionBusy, setRestrictionBusy] = useState(false);
  const load = useCallback(async () => { try { setError(''); setD(await apiGet(`/admin/billing/turfs/${id}/financial-profile`)); } catch (e) { setError(e.message); } }, [id]);
  useEffect(() => { load(); }, [load]);
  if (error && !d) return <div className="card" style={card}><p style={{ color: '#ef4444' }}>{error}</p><button className="btn btn-secondary" onClick={onBack}>Back</button></div>;
  if (!d) return <p style={muted}>Loading…</p>;
  const c = d.config; const cur = d.turf.currency; const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const save = async () => {
    setMsg('');
    if (reason.trim().length < 3) { setMsg('Enter a reason for this change.'); return; }
    if (!window.confirm('Save a new billing version? It applies from its effective date; past bookings and transfers keep their terms.')) return;
    const m = form.billing_model;
    const b = { billing_model: m, tax_mode: form.tax_mode, reason: reason.trim() };
    if (form.min_fee !== '') b.min_fee = form.min_fee; if (form.max_fee !== '') b.max_fee = form.max_fee;
    if (m === 'PERCENTAGE') b.commission_percent = form.commission_percent;
    if (m === 'FLAT') b.flat_fee = form.flat_fee;
    if (m === 'SUBSCRIPTION') { Object.assign(b, { subscription_amount: form.subscription_amount, subscription_policy: form.subscription_policy, subscription_period: form.subscription_period, subscription_start_date: form.subscription_start_date }); if (form.grace_period_days !== '') b.grace_period_days = form.grace_period_days; }
    if (form.tax_mode !== 'NONE') b.tax_percent = form.tax_percent;
    if (form.effective_from.trim()) b.effective_from = form.effective_from.trim();
    try { await apiPut(`/admin/billing/turfs/${id}/billing-config`, b); setForm(null); setReason(''); setMsg('New billing version saved.'); await load(); } catch (e) { setMsg(e.message); }
  };
  const sendBillingNotice = async () => {
    let noticeReason;
    if (noticeKind === 'ACCOUNT_RESTRICTION_WARNING') {
      noticeReason = window.prompt('Enter the documented reason for this restriction warning (no access restriction will be applied automatically):');
      if (!noticeReason) return;
    }
    setNoticeBusy(true);
    try {
      const result = await apiPost(`/admin/billing/turfs/${id}/payment-notice`, { notice_kind: noticeKind, reason: noticeReason });
      setMsg(result.delivery === 'in_app_persisted' ? 'In-app billing notice persisted. Email/SMS delivery is not configured.' : 'Notice was not delivered; check the returned delivery status.');
    } catch (e) { setMsg(e.message || 'Could not send notice.'); }
    finally { setNoticeBusy(false); }
  };
  const updateRestriction = async (action, cycle) => {
    const restrictionReason = window.prompt(action === 'apply'
      ? 'Enter the documented reason for restricting new bookings:'
      : 'Enter the documented reason for removing this restriction:');
    if (!restrictionReason || restrictionReason.trim().length < 3) return;
    if (action === 'apply') {
      const due = money(cycle.outstandingMinor, cycle.currency || cur);
      const impact = 'New bookings will be blocked. Existing and confirmed bookings, the owner panel, billing, and history remain available.';
      if (!window.confirm(`Apply restriction to ${d.turf.name}?\nOwner: ${d.owner?.name || 'Unknown'}\nCycle: ${cycle.cycle_start} – ${cycle.cycle_end}\nOutstanding: ${due}\n\n${impact}`)) return;
    } else if (!window.confirm(`Remove the new-bookings restriction for ${d.turf.name}? Existing and confirmed bookings remain unchanged.`)) return;
    setRestrictionBusy(true);
    try {
      const result = await apiPost(`/admin/billing/turfs/${id}/restriction`, {
        action,
        reason: restrictionReason.trim(),
        ...(cycle ? { cycle_id: cycle.id } : {}),
      });
      const summary = action === 'apply' ? 'New bookings are now restricted. Existing bookings and owner billing remain available.' : 'New-bookings restriction removed.';
      setMsg(result.owner_notice === 'not_persisted' ? `${summary} Owner notification could not be saved.` : summary);
      await load();
    } catch (e) { setMsg(e.message || 'Could not update the venue restriction.'); }
    finally { setRestrictionBusy(false); }
  };
  const Field = ({ label, k, ph, type = 'text', min }) => <label style={{ display: 'block', marginBottom: 10 }}><span style={muted}>{label}</span><input type={type} min={min} className="form-input" style={{ minHeight: 44 }} value={form[k]} placeholder={ph} onChange={(e) => set(k, e.target.value)} /></label>;
  const Sel = ({ label, k, opts }) => <label style={{ display: 'block', marginBottom: 10 }}><span style={muted}>{label}</span><select className="form-input" style={{ minHeight: 44 }} value={form[k]} onChange={(e) => set(k, e.target.value)}>{opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>;
  return (
    <div>
      <button type="button" className="btn btn-secondary" style={{ minHeight: 44, marginBottom: 12 }} onClick={onBack}>‹ All venues</button>
      <h2 style={{ marginBottom: 12 }}>{d.turf.name}</h2>
      {msg && <p style={{ color: /saved|persisted/i.test(msg) ? 'var(--emerald-400)' : '#ef4444' }}>{msg}</p>}
      <div className="grid-2">
        <div className="card" style={card}><h4 style={h3}>Owner and Route</h4>
          <Row k="Owner" v={d.owner && d.owner.name} /><Row k="Currency" v={cur} /><Row k="Route" v={d.route.enabled ? (d.route.environment === 'live' ? 'Enabled, live' : 'Enabled, test (simulated)') : 'Disabled'} /><Row k="Linked account" v={d.route.linked_account_id} /><Row k="Account status" v={d.route.linked_account_status} /><Row k="Ready to transfer" v={d.route.ready ? 'Yes' : 'No'} /></div>
        <div className="card" style={card}><h4 style={h3}>Current billing {c.source === 'legacy' ? '(legacy settings)' : `(v${c.version})`}</h4>
          <Row k="Model" v={MODEL_LABEL[c.billing_model]} />
          {c.billing_model === 'PERCENTAGE' && <Row k="Commission" v={c.commission_bps == null ? null : `${c.commission_bps / 100}%`} />}
          {c.billing_model === 'FLAT' && <Row k="Fee per booking" v={c.flat_fee_minor == null ? null : money(c.flat_fee_minor, cur)} />}
          {c.billing_model === 'SUBSCRIPTION' && <><Row k="Amount" v={c.subscription_amount_minor == null ? null : `${money(c.subscription_amount_minor, cur)} / ${String(c.subscription_period || '').toLowerCase()}`} /><Row k="Charged" v={c.subscription_policy === 'SEPARATE' ? 'Paid separately' : 'Deducted from bookings'} /><Row k="Cycle starts on" v={c.subscription_anchor_date} /><Row k="Grace period" v={c.grace_period_days == null ? null : `${c.grace_period_days} days`} /></>}
          <Row k="Tax" v={c.tax_mode === 'NONE' ? 'None' : `${c.tax_mode.toLowerCase()} at ${c.tax_bps == null ? '?' : c.tax_bps / 100}%`} />
          {d.config_problems.length > 0 && <p style={{ color: '#ef4444', fontSize: '0.85rem' }}>Cannot settle payments: {d.config_problems.join('; ')}</p>}
          {!form && <button type="button" className="btn btn-primary" style={{ minHeight: 44, marginTop: 10 }} onClick={() => { setForm(formFrom(c)); setMsg(''); }}>Change billing configuration</button>}</div>
      </div>
      {form && <div className="card" style={card}><h4 style={h3}>New billing version</h4>
        <Sel label="Billing model" k="billing_model" opts={[['PERCENTAGE', 'Commission %'], ['FLAT', 'Flat fee per booking'], ['SUBSCRIPTION', 'Subscription']]} />
        {form.billing_model === 'PERCENTAGE' && <Field label="Commission (%)" k="commission_percent" />}
        {form.billing_model === 'FLAT' && <Field label={`Fee per booking (${cur})`} k="flat_fee" />}
        {form.billing_model === 'SUBSCRIPTION' && <><Field label={`Subscription amount (${cur})`} k="subscription_amount" /><Sel label="Period" k="subscription_period" opts={[['MONTHLY', 'Monthly'], ['QUARTERLY', 'Quarterly'], ['YEARLY', 'Yearly']]} /><Sel label="How it is charged" k="subscription_policy" opts={[['DEDUCT_FROM_PROCEEDS', 'Deduct from bookings'], ['SEPARATE', 'Paid separately']]} /><Field label="Subscription start / first due date" k="subscription_start_date" type="date" /><Field label="Grace period (days)" k="grace_period_days" /></>}
        <Field label={`Minimum fee (${cur}, optional)`} k="min_fee" /><Field label={`Maximum fee (${cur}, optional)`} k="max_fee" />
        <Sel label="Tax on the platform fee" k="tax_mode" opts={[['NONE', 'No tax'], ['INCLUSIVE', 'Tax inclusive'], ['EXCLUSIVE', 'Tax exclusive']]} />
        {form.tax_mode !== 'NONE' && <Field label="Tax rate (%)" k="tax_percent" />}
        <Field label="Effective from (optional, not in the past)" k="effective_from" type="date" min={localYmd()} ph="Blank = now" />
        <label style={{ display: 'block', marginBottom: 10 }}><span style={muted}>Reason (recorded in the audit log)</span><input className="form-input" style={{ minHeight: 44 }} value={reason} onChange={(e) => setReason(e.target.value)} /></label>
        <div style={{ display: 'flex', gap: 8 }}><button type="button" className="btn btn-secondary" style={{ minHeight: 44 }} onClick={() => setForm(null)}>Cancel</button><ActionButton onClick={save}>Save version</ActionButton></div></div>}
      {d.subscription && <div className="card" style={card}><h4 style={h3}>Subscription cycles</h4>
        {d.subscription.cycles.length ? d.subscription.cycles.map((cy) => <div key={cy.id} style={{ marginBottom: 10 }}><strong>{cy.cycle_start} to {cy.cycle_end}</strong> <span className="status-badge">{cy.status.toLowerCase()}</span><Row k="Due date" v={`${cy.due_date} (grace: ${d.subscription.grace_period_days} days)`} /><Row k="Total billed" v={money(cy.amountMinor, cy.currency)} /><Row k="Deducted from bookings" v={money(cy.deductedMinor, cy.currency)} /><Row k="Paid separately" v={money(cy.paidSeparatelyMinor, cy.currency)} /><Row k="Outstanding" v={money(cy.outstandingMinor, cy.currency)} />
          {cy.policy === 'SEPARATE' && cy.outstandingMinor > 0 && <ActionButton className="btn btn-secondary" style={{ marginTop: 8 }} disabled={noticeBusy} onClick={sendBillingNotice}>Send owner payment notice</ActionButton>}
          {!d.restriction?.active && cy.policy === 'SEPARATE' && cy.status === 'OVERDUE' && cy.outstandingMinor > 0 && <ActionButton className="btn btn-secondary" style={{ marginTop: 8 }} disabled={restrictionBusy} onClick={() => updateRestriction('apply', cy)}>Restrict new bookings</ActionButton>}
        </div>) : <p style={muted}>No cycle is due yet. A cycle is created from the configured start date.</p>}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'end', marginTop: 12 }}>
          <label style={{ display: 'block', minWidth: 220, flex: '1 1 220px' }}><span style={muted}>Owner notification</span><select className="form-input" style={{ minHeight: 44 }} value={noticeKind} onChange={(e) => setNoticeKind(e.target.value)}>
            <option value="PAYMENT_DUE_SOON">Payment due soon</option><option value="PAYMENT_OVERDUE">Payment overdue</option><option value="PAYMENT_FAILED">Payment failed</option><option value="SUBSCRIPTION_EXPIRING">Subscription expiring soon</option><option value="ACCOUNT_RESTRICTION_WARNING">Account restriction warning (notice only)</option>
          </select></label>
          <ActionButton onClick={sendBillingNotice} disabled={noticeBusy}>Send in-app notice</ActionButton>
        </div>
      </div>}
      <div className="card" style={card}><h4 style={h3}>New-bookings restriction</h4>
        {d.restriction?.active ? <>
          <p role="status"><strong>Active:</strong> New bookings are blocked. Existing and confirmed bookings, the owner panel, billing, and history remain available.</p>
          <Row k="Cycle" v={d.restriction.active.cycle_id} /><Row k="Outstanding when applied" v={money(d.restriction.active.outstanding_minor, d.restriction.active.currency)} /><Row k="Applied" v={fmtDT(d.restriction.active.applied_at)} />
          <Row k="Applied by admin" v={d.restriction.active.applied_by} /><Row k="Reason" v={d.restriction.active.reason} />
          <ActionButton className="btn btn-secondary" disabled={restrictionBusy} onClick={() => updateRestriction('remove')}>Remove restriction</ActionButton>
        </> : <p style={muted}>No active restriction. Only an explicit admin action on an overdue, unpaid subscription can block new bookings.</p>}
        {d.restriction?.history?.length > 0 && <details style={{ marginTop: 12 }}><summary>Restriction audit history ({d.restriction.history.length})</summary>
          {d.restriction.history.map((item) => <p key={item.id} style={{ fontSize: '0.85rem', margin: '8px 0' }}>
            {item.removed_at ? 'Removed' : 'Applied'} · {fmtDT(item.applied_at)} · admin {item.applied_by} · cycle {item.cycle_id} · {money(item.outstanding_minor, item.currency)} outstanding · {item.reason}
            {item.removed_at ? ` · removed ${fmtDT(item.removed_at)} by ${item.removed_by || 'system'}: ${item.remove_reason || ''}` : ''}
          </p>)}
        </details>}
      </div>
      <div className="card" style={card}><h4 style={h3}>Configuration history</h4>
        {d.history.length ? d.history.map((h) => <div key={h.id} style={{ padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}><strong>v{h.version} · {MODEL_LABEL[h.billing_model]}</strong><div style={muted}>Effective {fmtDT(h.effective_from)} · by {h.admin_name || 'admin'}</div>{h.reason && <div style={{ fontSize: '0.85rem' }}>{h.reason}</div>}</div>) : <p style={muted}>No versions published yet.</p>}</div>
      <div className="card" style={card}><h4 style={h3}>Recent transfers</h4>
        {d.recent_transfers.length ? d.recent_transfers.map((t) => <div key={t.id} style={{ padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}><div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={muted}>{t.razorpay_payment_id}</span><span className="status-badge">{String(t.status).toLowerCase()}</span></div><Row k="Owner transfer" v={t.owner_transfer_minor == null ? null : money(t.owner_transfer_minor, t.currency)} /></div>) : <p style={muted}>No transfers yet.</p>}</div>
    </div>
  );
}

export function VenueBilling() {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState('');
  const [model, setModel] = useState('');
  const [status, setStatus] = useState('');
  const [ledger, setLedger] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [targetType, setTargetType] = useState('VENUES');
  const [ownerId, setOwnerId] = useState('');
  const [sportType, setSportType] = useState('');
  const [bulkModel, setBulkModel] = useState('SUBSCRIPTION');
  const [bulkAmount, setBulkAmount] = useState('');
  const [bulkPeriod, setBulkPeriod] = useState('MONTHLY');
  const [bulkPolicy, setBulkPolicy] = useState('SEPARATE');
  const [bulkStart, setBulkStart] = useState(localYmd());
  const [bulkEffective, setBulkEffective] = useState('');
  const [bulkGrace, setBulkGrace] = useState('7');
  const [bulkReason, setBulkReason] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkMessage, setBulkMessage] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [sel, setSel] = useState(null);
  const [error, setError] = useState('');
  const seq = useRef(0);
  useEffect(() => {
    const t = setTimeout(async () => {
      const mine = ++seq.current;
      try {
        setError('');
        const params = new URLSearchParams();
        if (q.trim()) params.set('q', q.trim());
        if (model) params.set('model', model);
        if (status) params.set('status', status);
        const r = await apiGet(`/admin/billing/turfs${params.size ? `?${params}` : ''}`);
        if (mine === seq.current) setRows(r.turfs || []);
      }
      catch (e) { if (mine === seq.current) setError(e.message); }
    }, 250);
    return () => clearTimeout(t);
  }, [q, model, status, reloadKey]);
  useEffect(() => {
    apiGet('/admin/billing/ledger').then(setLedger).catch((e) => setError(e.message || 'Could not load the billing totals.'));
  }, []);
  if (sel) return <VenueDetail id={sel} onBack={() => setSel(null)} />;
  const assignBulk = async (event) => {
    event.preventDefault();
    setBulkBusy(true);
    setBulkMessage('');
    const payload = {
      target_type: targetType,
      ...(targetType === 'VENUES' ? { venue_ids: selectedIds } : {}),
      ...(targetType === 'OWNER' ? { owner_id: ownerId } : {}),
      ...(targetType === 'SPORT' ? { sport_type: sportType } : {}),
      billing_model: bulkModel,
      reason: bulkReason,
    };
    if (bulkEffective) payload.effective_from = bulkEffective;
    if (bulkModel === 'PERCENTAGE') payload.commission_percent = bulkAmount;
    if (bulkModel === 'FLAT') payload.flat_fee = bulkAmount;
    if (bulkModel === 'SUBSCRIPTION') Object.assign(payload, {
      subscription_amount: bulkAmount, subscription_period: bulkPeriod, subscription_policy: bulkPolicy,
      subscription_start_date: bulkStart, grace_period_days: bulkGrace,
    });
    try {
      const result = await apiPost('/admin/billing/bulk-billing-config', payload);
      setBulkMessage(`Billing assigned to ${result.assigned_count} venue(s).`);
      setSelectedIds([]);
      setBulkReason('');
      setReloadKey((key) => key + 1);
      const updatedLedger = await apiGet('/admin/billing/ledger');
      setLedger(updatedLedger);
    } catch (e) { setBulkMessage(e.message || 'Bulk billing assignment failed. No changes were committed.'); }
    finally { setBulkBusy(false); }
  };
  const modelCounts = ledger?.summary?.by_model || {};
  const currencies = Object.keys(ledger?.summary?.by_currency || {});
  return (
    <div>
      <div style={grid}>
        <Metric label="Total venues" value={ledger?.summary?.total_venues ?? '—'} />
        <Metric label="Percentage-based venues" value={modelCounts.PERCENTAGE || 0} />
        <Metric label="Flat-fee venues" value={modelCounts.FLAT || 0} />
        <Metric label="Subscription venues" value={modelCounts.SUBSCRIPTION || 0} />
        <Metric label="Unconfigured venues" value={modelCounts.UNCONFIGURED || 0} warn={(modelCounts.UNCONFIGURED || 0) > 0} />
        <Metric label="Current subscription cycles" value={ledger?.summary?.active_subscriptions ?? '—'} />
      </div>
      {currencies.length > 0 && <div className="grid-2" style={{ marginBottom: 16 }}>
        {currencies.map((cur) => {
          const totals = ledger.summary.by_currency[cur];
          return <div className="card" key={cur} style={card}>
            <h3 style={h3}>Subscription ledger · {cur}</h3>
            <Row k="Subscription cycles billed" v={money(totals.billed_minor, cur)} />
            <Row k="Cycle amounts paid" v={money(totals.paid_minor, cur)} />
            <Row k="Online subscription payments captured" v={money(totals.online_payments_captured_minor, cur)} />
            <Row k="Outstanding subscription balance" v={money(totals.outstanding_minor, cur)} />
            <Row k="Overdue subscription balance" v={money(totals.overdue_minor, cur)} />
            <Row k="Overdue cycles" v={totals.overdue_cycles} />
          </div>;
        })}
      </div>}
      {ledger?.definitions && <p style={{ ...muted, marginBottom: 14 }}>{ledger.definitions.outstanding_minor}</p>}
      <form className="card" style={card} onSubmit={assignBulk}>
        <h3 style={h3}>Assign billing to venues</h3>
        <p style={muted}>Assignments use each venue’s versioned billing configuration; the same venue cannot have a percentage fee and subscription active together.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10 }}>
          <label style={muted}>Target
            <select className="form-input" style={{ minHeight: 44 }} value={targetType} onChange={(e) => setTargetType(e.target.value)}>
              <option value="VENUES">Selected venues</option><option value="OWNER">All approved venues of an owner</option><option value="SPORT">Approved venues by sport</option><option value="ALL_APPROVED">All approved venues</option>
            </select>
          </label>
          {targetType === 'OWNER' && <label style={muted}>Owner ID<input className="form-input" style={{ minHeight: 44 }} inputMode="numeric" value={ownerId} onChange={(e) => setOwnerId(e.target.value)} required /></label>}
          {targetType === 'SPORT' && <label style={muted}>Sport / business type<input className="form-input" style={{ minHeight: 44 }} value={sportType} onChange={(e) => setSportType(e.target.value)} required /></label>}
          <label style={muted}>Billing model
            <select className="form-input" style={{ minHeight: 44 }} value={bulkModel} onChange={(e) => setBulkModel(e.target.value)}>
              <option value="SUBSCRIPTION">Fixed subscription</option><option value="PERCENTAGE">Percentage fee</option><option value="FLAT">Flat per-booking fee</option>
            </select>
          </label>
          <label style={muted}>{bulkModel === 'SUBSCRIPTION' ? 'Subscription amount' : bulkModel === 'FLAT' ? 'Flat fee per booking' : 'Commission percent'}
            <input className="form-input" style={{ minHeight: 44 }} type="number" min="0" step={bulkModel === 'PERCENTAGE' ? '0.01' : 'any'} value={bulkAmount} onChange={(e) => setBulkAmount(e.target.value)} required />
          </label>
          {bulkModel === 'SUBSCRIPTION' && <>
            <label style={muted}>Period<select className="form-input" style={{ minHeight: 44 }} value={bulkPeriod} onChange={(e) => setBulkPeriod(e.target.value)}><option value="MONTHLY">Monthly</option><option value="QUARTERLY">Quarterly</option><option value="YEARLY">Yearly</option></select></label>
            <label style={muted}>Payment policy<select className="form-input" style={{ minHeight: 44 }} value={bulkPolicy} onChange={(e) => setBulkPolicy(e.target.value)}><option value="SEPARATE">Paid separately</option><option value="DEDUCT_FROM_PROCEEDS">Deduct from eligible booking proceeds</option></select></label>
            <label style={muted}>Subscription start / first due date<input className="form-input" style={{ minHeight: 44 }} type="date" value={bulkStart} onChange={(e) => setBulkStart(e.target.value)} required /></label>
            <label style={muted}>Grace period (days)<input className="form-input" style={{ minHeight: 44 }} type="number" min="0" max="90" step="1" value={bulkGrace} onChange={(e) => setBulkGrace(e.target.value)} /></label>
          </>}
          <label style={muted}>Effective from (optional)<input className="form-input" style={{ minHeight: 44 }} type="date" min={localYmd()} value={bulkEffective} onChange={(e) => setBulkEffective(e.target.value)} /></label>
          <label style={muted}>Audit reason<input className="form-input" style={{ minHeight: 44 }} minLength={3} value={bulkReason} onChange={(e) => setBulkReason(e.target.value)} required /></label>
        </div>
        {targetType === 'VENUES' && <div style={{ ...muted, marginTop: 8 }}>{selectedIds.length} venue(s) selected below. Use the owner/sport target modes to select a group in one atomic assignment.</div>}
        {bulkMessage && <p role="status" style={{ color: /assigned/i.test(bulkMessage) ? 'var(--emerald-400)' : '#ef4444' }}>{bulkMessage}</p>}
        <button className="btn btn-primary" style={{ minHeight: 44, marginTop: 12 }} disabled={bulkBusy || (targetType === 'VENUES' && selectedIds.length === 0)}>{bulkBusy ? 'Assigning…' : 'Assign billing atomically'}</button>
      </form>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <input className="form-input" style={{ minHeight: 44, maxWidth: 420, flex: '1 1 220px' }} placeholder="Search owner, venue, sport or id" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="form-input" style={{ minHeight: 44, width: 'auto' }} value={model} onChange={(e) => setModel(e.target.value)}>
          <option value="">All billing models</option><option value="PERCENTAGE">Percentage</option><option value="FLAT">Flat fee</option><option value="SUBSCRIPTION">Subscription</option>
        </select>
        <select className="form-input" style={{ minHeight: 44, width: 'auto' }} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option><option value="PAYMENT_DUE">Payment due</option><option value="OVERDUE">Overdue</option><option value="PAID">Paid</option><option value="NOT_OPENED">Cycle not opened</option>
        </select>
      </div>
      {error && <p style={{ color: '#ef4444' }}>{error}</p>}
      <div style={{ overflowX: 'auto' }}>
        <table className="data-table" style={{ width: '100%' }}>
          <thead><tr><th>Select</th><th>Owner / venue</th><th>Sport</th><th>Billing model &amp; terms</th><th>Period</th><th>Paid</th><th>Outstanding / due</th><th>Status</th><th>Route</th><th /></tr></thead>
          <tbody>{rows.map((t) => (
            <tr key={t.id}>
              <td><input aria-label={`Select ${t.name}`} type="checkbox" checked={selectedIds.includes(Number(t.id))} onChange={(e) => setSelectedIds((ids) => e.target.checked ? [...new Set([...ids, Number(t.id)])] : ids.filter((id) => id !== Number(t.id)))} /></td>
              <td><strong>{t.name}</strong><br /><small>{t.owner_name || 'No owner'} · ID {t.id}</small></td>
              <td>{t.sport_type || '—'}</td>
              <td>{t.billing_configuration_error ? <span style={{ color: '#ef4444', fontWeight: 700 }}>Configuration required</span> : MODEL_LABEL[t.billing_model] || 'Configuration required'}
                <br /><small>{t.billing_model === 'PERCENTAGE' ? `${t.commission_bps == null ? '—' : `${t.commission_bps / 100}%`} commission` : t.billing_model === 'FLAT' ? `${money(t.flat_fee_minor, t.currency)} / booking` : t.billing_model === 'SUBSCRIPTION' ? `${money(t.subscription_amount_minor, t.currency)} / ${String(t.subscription_period || '').toLowerCase()} · ${t.subscription_policy === 'SEPARATE' ? 'separate' : 'proceeds'}` : 'No effective billing terms'}</small>
              </td>
              <td>{t.cycle_start ? `${t.cycle_start} – ${t.cycle_end}` : '—'}</td>
              <td>{t.current_cycle_id ? money(Number(t.paid_separately_minor || 0) + Number(t.deducted_minor || 0), t.cycle_currency) : '—'}</td>
              <td>{t.current_cycle_id ? <>{money(t.outstanding_minor, t.cycle_currency)}<br /><small>Due {t.cycle_start}</small></> : '—'}</td>
              <td>{t.billing_status ? t.billing_status.replace(/_/g, ' ').toLowerCase() : '—'}</td>
              <td>{t.route_enabled ? (t.route_environment === 'live' ? 'Live' : 'Test') : 'Off'}{t.route_enabled && !t.route_linked_account_id ? ' · no account' : ''}</td>
              <td><button type="button" className="btn btn-secondary" style={{ minHeight: 40 }} onClick={() => setSel(t.id)}>Open</button></td></tr>
          ))}{rows.length === 0 && <tr><td colSpan={10} style={muted}>No venues found.</td></tr>}</tbody>
        </table>
      </div>
    </div>
  );
}
