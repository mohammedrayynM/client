import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { fetchMyTicketDetail } from '@/services/activities';
import { resolveMediaUrl } from '@/lib/mediaUrl';
import { qrPath } from '@/lib/qr';
import { setPageMeta } from '@/lib/seo';
import {
  CheckCircle2,
  AlertCircle,
  QrCode as QrIcon,
  Calendar,
  MapPin,
  User,
  Phone,
  Printer,
  ArrowLeft,
  Ticket,
  Clock,
  ExternalLink,
} from 'lucide-react';

export default function ActivityPass() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setPageMeta({
      title: 'Digital Entry Pass & QR Ticket | Book Arena',
      description: 'Your verified all-in-one digital pass for park entry and activities.',
      robots: 'noindex, nofollow'
    });

    setLoading(true);
    fetchMyTicketDetail(id)
      .then(setData)
      .catch((err) => {
        console.error('Failed to load pass:', err);
        setError(err?.response?.status === 404 ? 'This booking pass was not found.' : 'Could not load your ticket pass.');
      })
      .finally(() => setLoading(false));
  }, [id]);

  // Payment still being confirmed: the server checks Razorpay on every load and issues the QR once the payment is
  // captured, so re-check every few seconds for a minute (the QR then appears without a manual refresh).
  const pendingStatus = data?.booking?.status === 'pending';
  useEffect(() => {
    if (!pendingStatus) return undefined;
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      fetchMyTicketDetail(id).then(setData).catch(() => {});
      if (tries >= 12) clearInterval(timer);
    }, 5000);
    return () => clearInterval(timer);
  }, [id, pendingStatus]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-950 text-white">
        <Navbar />
        <div className="flex-grow flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
        <Footer />
      </div>
    );
  }

  if (error || !data?.booking) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-950 text-white">
        <Navbar />
        <div className="flex-grow flex flex-col items-center justify-center p-8 text-center">
          <AlertCircle className="w-16 h-16 text-rose-500 mb-4" />
          <h2 className="text-2xl font-bold text-white">Pass Not Found</h2>
          <p className="text-slate-400 mt-2">{error || 'Could not find this booking pass.'}</p>
          <Link to="/profile" className="mt-6 px-6 py-2.5 bg-emerald-600 text-white rounded-xl font-bold">
            View My Profile
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  const { booking, items = [], tickets = [], addons = [] } = data;
  const isConfirmed = booking.status === 'confirmed';
  // Only show server-issued ticket tokens. A booking reference is not a scannable admission ticket.
  // Single-QR activities issue one token covering the group; per-ticket activities issue one per person.
  // VALID/UNUSED = not scanned yet; SCANNED = some entries used, the rest still admit. Used-up / cancelled / refunded /
  // expired tickets are listed with their status but never shown as a scannable QR.
  const LIVE = ['VALID', 'UNUSED', 'SCANNED'];
  const STATUS_LABEL = { VALID: 'Valid', UNUSED: 'Valid', SCANNED: 'Partly used', COMPLETED: 'Used', EXPIRED: 'Expired', CANCELLED: 'Cancelled', REFUNDED: 'Refunded' };
  const issuedTickets = isConfirmed ? tickets.filter((ticket) => ticket.qr_token && LIVE.includes(ticket.status)) : [];
  const closedTickets = tickets.filter((ticket) => ticket.qr_token && !LIVE.includes(ticket.status));

  const formattedDate = booking.booking_date
    ? new Date(booking.booking_date).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : '';

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-white">
      <Navbar />

      {/* Top action bar */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 sm:px-6 lg:px-8 py-3 print:hidden">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link to="/profile" className="text-xs text-slate-400 hover:text-emerald-400 flex items-center gap-1.5 transition-colors">
            <ArrowLeft className="w-4 h-4" /> My Profile & Passes
          </Link>
          <button
            onClick={() => window.print()}
            className="text-xs text-white bg-slate-800 hover:bg-slate-700 px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors"
          >
            <Printer className="w-3.5 h-3.5 text-emerald-400" /> Print Pass
          </button>
        </div>
      </div>

      <main className="max-w-xl w-full mx-auto px-4 py-10 flex-grow">
        {/* Ticket Card Container */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
          {/* Header Strip */}
          <div className={`p-6 text-center ${isConfirmed ? 'bg-gradient-to-r from-emerald-600 to-teal-700' : 'bg-slate-800'}`}>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/20 text-white text-xs font-black uppercase tracking-wider mb-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-white" />
              {isConfirmed ? 'Booking Confirmed' : booking.status}
            </div>
            <h1 className="text-2xl font-black text-white">{booking.activity_name}</h1>
            <p className="text-xs text-emerald-100 mt-1">Book Arena Official Admission Pass</p>
          </div>

          {/* Render each valid server-issued QR. No QR is offered for pending or unpaid bookings. */}
          {issuedTickets.length > 0 ? (
            <div className="p-8 text-center bg-slate-950 border-b border-slate-800 flex flex-col items-center gap-6">
              {issuedTickets.map((ticket, index) => {
                const qrSvg = qrPath(ticket.qr_token);
                return (
                  <div key={ticket.qr_token} className="flex flex-col items-center">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <QrIcon className="w-4 h-4 text-emerald-400" />
                      {issuedTickets.length > 1
                        ? `Ticket ${index + 1} of ${issuedTickets.length}${ticket.ticket_type_name ? ` · ${ticket.ticket_type_name}` : ''} · ${ticket.quantity_covered || 1} admission${Number(ticket.quantity_covered || 1) === 1 ? '' : 's'}`
                        : 'Digital Access Pass'}
                    </span>
                    <div className="p-4 bg-white rounded-2xl shadow-xl inline-block">
                      <svg
                        role="img"
                        aria-label={`Valid admission QR ticket ${index + 1}`}
                        viewBox={`0 0 ${qrSvg.size} ${qrSvg.size}`}
                        className="w-48 h-48 sm:w-56 sm:h-56"
                        shapeRendering="crispEdges"
                      >
                        <path d={qrSvg.d} fill="#090d16" />
                      </svg>
                    </div>
                    <p className="text-xs font-mono font-bold text-emerald-400 mt-4 tracking-widest">
                      TICKET {index + 1} · {ticket.qr_token.slice(0, 12).toUpperCase()}
                    </p>
                    <p className="text-[11px] font-bold mt-1 text-slate-300">
                      {STATUS_LABEL[ticket.status] || ticket.status}
                      {Number(ticket.quantity_covered) > 1 ? ` · ${Math.max(0, Number(ticket.quantity_covered) - Number(ticket.redeemed_quantity || 0))} of ${ticket.quantity_covered} entries left` : ''}
                    </p>
                  </div>
                );
              })}
              <p className="text-[11px] text-slate-400">Present each QR at the park gate or activity checkpoint.</p>
            </div>
          ) : (
            <div className="p-6 text-center bg-slate-950 border-b border-slate-800 text-sm text-slate-400">
              {isConfirmed && closedTickets.length > 0
                ? `This ticket is ${String(STATUS_LABEL[closedTickets[0].status] || closedTickets[0].status).toLowerCase()} and can no longer be scanned.`
                : isConfirmed
                  ? 'No active QR ticket is available for this booking. Please contact the activity.'
                  : booking.status === 'pending'
                    ? 'Confirming your payment… your QR ticket will appear here automatically once the payment is verified.'
                    : booking.status === 'cancelled'
                      ? (booking.refund_amount > 0 ? 'This booking was cancelled and refunded. No QR ticket is valid for it.' : 'This booking was cancelled. No QR ticket is valid for it.')
                      : 'Your QR ticket will appear after payment is confirmed.'}
            </div>
          )}

          {/* Details & Items */}
          <div className="p-6 sm:p-8 space-y-6 text-sm">
            {/* Meta Grid */}
            <div className="grid grid-cols-2 gap-4 pb-6 border-b border-slate-800 text-xs">
              <div>
                <span className="text-slate-500 block">Visit Date</span>
                <span className="font-bold text-white text-sm mt-0.5 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-emerald-400" /> {formattedDate}
                </span>
              </div>

              <div>
                <span className="text-slate-500 block">Time Slot</span>
                <span className="font-bold text-white text-sm mt-0.5 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-emerald-400" />
                  {booking.time_window_label || 'All-Day Entry'}
                </span>
              </div>

              <div>
                <span className="text-slate-500 block">Customer Name</span>
                <span className="font-bold text-white mt-0.5">{booking.customer_name}</span>
              </div>

              <div>
                <span className="text-slate-500 block">Mobile Phone</span>
                <span className="font-bold text-white mt-0.5">{booking.customer_phone}</span>
              </div>
            </div>

            {/* Itemized Tickets */}
            <div>
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-3">
                Included Tickets & Rides
              </h3>
              <div className="space-y-2">
                {items.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between text-xs"
                  >
                    {item.image_url ? <img src={resolveMediaUrl(item.image_url)} alt="" className="mr-3 h-12 w-14 rounded-lg object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} /> : null}
                    <div>
                      <span className="font-bold text-white block">{item.ticket_type_name}</span>
                      <span className="text-[11px] text-slate-400">Qty: {item.quantity}</span>
                    </div>
                    <span className="font-extrabold text-emerald-400">
                      ₹{item.total_price || item.unit_price * item.quantity}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Addons if any */}
            {addons.length > 0 && (
              <div>
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-3">
                  Purchased Add-ons
                </h3>
                <div className="space-y-2">
                  {addons.map((ad, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between text-xs"
                    >
                      <span className="font-bold text-white">{ad.addon_name} (x{ad.quantity})</span>
                      <span className="font-bold text-emerald-400">₹{ad.total_price}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Total Paid */}
            <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-400 font-bold">Total Paid</span>
              <span className="text-xl font-black text-emerald-400">₹{booking.final_amount || booking.total_amount}</span>
            </div>
          </div>
        </div>

        {/* Action Link to Discover more */}
        <div className="mt-8 text-center print:hidden">
          <Link
            to="/activities"
            className="text-xs text-slate-400 hover:text-emerald-400 transition-colors inline-flex items-center gap-1"
          >
            Explore More Amusement Parks & Experiences &rarr;
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}
