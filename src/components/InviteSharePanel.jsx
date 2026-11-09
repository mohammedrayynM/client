import { useMemo, useState } from 'react';
import { qrPath } from '@/lib/qr';

// "Share with friends": the QR code, Copy Link and Share Invite for one Find Players invitation. The QR encodes ONLY the invite URL
// the backend returned (no tokens, payment or personal data), so scanning it opens exactly the page the link opens.
export default function InviteSharePanel({ inviteUrl, title = 'Share with Friends', shareText = '' }) {
  const [enlarged, setEnlarged] = useState(false);
  const [note, setNote] = useState('');
  const qr = useMemo(() => { try { return inviteUrl ? qrPath(inviteUrl) : null; } catch (e) { return null; } }, [inviteUrl]);
  if (!inviteUrl) return null;

  const flash = (m) => { setNote(m); setTimeout(() => setNote(''), 2500); };
  const copy = async () => {
    try { await navigator.clipboard.writeText(inviteUrl); flash('Invite link copied'); } catch { window.prompt('Copy this invite link:', inviteUrl); }
  };
  const share = async () => {
    const text = `${shareText ? `${shareText}\n` : ''}Join and pay your share: ${inviteUrl}`;
    if (navigator.share) { try { await navigator.share({ title: 'Join my match on Book Arena', text, url: inviteUrl }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  };
  const svg = (px) => qr && (
    <svg viewBox={`0 0 ${qr.size} ${qr.size}`} width={px} height={px} role="img" aria-label="QR code for the invitation link" shapeRendering="crispEdges" style={{ display: 'block', background: '#fff', borderRadius: 8 }}>
      <path d={qr.d} fill="#000" />
    </svg>
  );

  return (
    <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '1rem', textAlign: 'left' }}>
      <div style={{ fontWeight: 800, marginBottom: 10 }}>{title}</div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {qr && (
          <button type="button" onClick={() => setEnlarged(true)} aria-label="Enlarge QR code" style={{ padding: 6, background: '#fff', border: 'none', borderRadius: 12, cursor: 'zoom-in' }}>
            {svg(132)}
          </button>
        )}
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', overflowWrap: 'anywhere', marginBottom: 10 }}>{inviteUrl}</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-secondary" onClick={copy}>Copy Link</button>
            <button type="button" className="btn btn-primary" onClick={share}>Share Invite</button>
          </div>
          <div style={{ minHeight: 18, marginTop: 6, color: 'var(--emerald-400)', fontSize: '0.8rem' }} aria-live="polite">{note}</div>
        </div>
      </div>
      {enlarged && (
        <div onClick={() => setEnlarged(false)} role="dialog" aria-modal="true" aria-label="QR code"
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, padding: 16 }}>
          <div style={{ background: '#fff', padding: 14, borderRadius: 18 }}>{svg(Math.min(360, window.innerWidth - 80))}</div>
          <div style={{ color: '#fff', fontSize: '0.9rem' }}>Ask your friends to scan this · tap anywhere to close</div>
        </div>
      )}
    </div>
  );
}
