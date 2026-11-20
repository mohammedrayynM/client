import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import {
  fetchActivity,
  fetchCurrentCustomer,
  fetchOpenDates,
  fetchAvailability,
  pricePreview,
  createActivityBooking,
  verifyActivityPayment,
  cancelPendingBooking,
} from '@/services/activities';
import { openRazorpayCheckout } from '@/lib/razorpay';
import { resolveMediaUrl } from '@/lib/mediaUrl';
import { setPageMeta } from '@/lib/seo';
import { formatPrice } from '@/lib/constants';
import {
  ArrowLeft,
  Minus,
  Plus,
  Ticket,
  Calendar,
  Clock,
  ShieldCheck,
  AlertTriangle,
  Info,
  Tag,
  CheckCircle2,
  Lock,
  User,
  Phone,
  Mail,
  ShoppingCart,
  ChevronRight,
} from 'lucide-react';

function getTodayStr() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function ActivityBooking() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isCheckoutStep = location.pathname.endsWith('/checkout');
  const hydratedCartSlug = useRef(null);
  const summaryRef = useRef(null);

  // Authentication & Customer Details
  const [currentUser, setCurrentUser] = useState(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  // Venue & Inventory State
  const [activityData, setActivityData] = useState(null);
  const [loadingVenue, setLoadingVenue] = useState(true);
  const [openDates, setOpenDates] = useState([]);
  const [selectedDate, setSelectedDate] = useState(getTodayStr());
  const [availability, setAvailability] = useState(null);
  const [timeWindowId, setTimeWindowId] = useState(null);

  // Cart & Pricing
  const [quantities, setQuantities] = useState({}); // ticket_type_id -> qty
  const [addonQty, setAddonQty] = useState({}); // addon_id -> qty
  const [offerCode, setOfferCode] = useState('');
  const [appliedOffer, setAppliedOffer] = useState('');
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(null);

  // Submission / Payment
  const [paying, setPaying] = useState(false);
  const [paymentError, setPaymentError] = useState(null);

  useEffect(() => {
    setPageMeta({
      title: 'Checkout & Ticket Booking | Book Arena',
      description: 'Select tickets, customize passes, and complete secure booking.',
      canonicalUrl: `https://bookarena.in/activities/${slug}/checkout`
    });

    if (localStorage.getItem('userToken')) {
      fetchCurrentCustomer().then((u) => {
        setCurrentUser(u);
        setName(u?.name || '');
        setPhone(u?.phone || '');
        setEmail(u?.email || '');
      }).catch((err) => console.warn('Could not load the signed-in customer profile:', err));
    }
  }, [slug]);

  // Keep the cart when a customer returns to the park page to adjust their choices.
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(`activity-checkout:${slug}`) || 'null');
      hydratedCartSlug.current = slug;
      if (!saved) return;
      setQuantities(saved.quantities || {});
      setAddonQty(saved.addonQty || {});
      setSelectedDate(saved.selectedDate || getTodayStr());
      setTimeWindowId(saved.timeWindowId || null);
      setOfferCode(saved.offerCode || '');
      setAppliedOffer(saved.appliedOffer || '');
    } catch { /* ignore a stale or malformed local cart */ }
  }, [slug]);

  useEffect(() => {
    if (!slug || hydratedCartSlug.current !== slug) return;
    sessionStorage.setItem(`activity-checkout:${slug}`, JSON.stringify({ quantities, addonQty, selectedDate, timeWindowId, offerCode, appliedOffer }));
  }, [slug, quantities, addonQty, selectedDate, timeWindowId, offerCode, appliedOffer]);

  // Load Activity & Open Dates
  useEffect(() => {
    setLoadingVenue(true);
    fetchActivity(slug)
      .then((data) => {
        setActivityData(data);
      })
      .catch((err) => {
        console.error('Failed to load venue:', err);
        setActivityData(null);
      })
      .finally(() => setLoadingVenue(false));

    fetchOpenDates(slug)
      .then((dates) => {
        setOpenDates(dates || []);
        if (dates?.length && !dates.some((d) => d.date === getTodayStr())) {
          setSelectedDate(dates[0].date);
        }
      })
      .catch(() => setOpenDates([]));
  }, [slug]);

  // Load Availability for selected date
  useEffect(() => {
    if (!activityData) return;
    fetchAvailability(slug, selectedDate)
      .then(setAvailability)
      .catch(() => setAvailability(null));
    setTimeWindowId(null);
  }, [slug, selectedDate, activityData]);

  const items = useMemo(() => {
    return Object.entries(quantities)
      .filter(([, q]) => q > 0)
      .map(([ticket_type_id, quantity]) => ({
        ticket_type_id: Number(ticket_type_id),
        quantity,
      }));
  }, [quantities]);

  const addons = useMemo(() => {
    return Object.entries(addonQty)
      .filter(([, q]) => q > 0)
      .map(([addon_id, quantity]) => ({
        addon_id: Number(addon_id),
        quantity,
      }));
  }, [addonQty]);

  useEffect(() => {
    if (isCheckoutStep && hydratedCartSlug.current === slug && items.length === 0) {
      navigate(`/activities/${slug}/book`, { replace: true });
    }
  }, [isCheckoutStep, slug, items.length, navigate]);

  // Real-time Price Preview
  useEffect(() => {
    let active = true;
    if (items.length === 0 || !activityData?.activity?.id) {
      setPreview(null);
      setPreviewError(null);
      setPreviewLoading(false);
      return;
    }

    setPreview(null);
    setPreviewError(null);
    setPreviewLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await pricePreview({
          activity_id: activityData.activity.id,
          booking_date: selectedDate,
          items,
          addons,
          offer_code: appliedOffer || undefined,
        });
        if (active) {
          if (!res || !Number.isFinite(Number(res.total)) || !Array.isArray(res.line_items)) throw new Error('The server returned an invalid price breakdown.');
          setPreview(res);
          setPreviewError(null);
        }
      } catch (err) {
        if (active) {
          setPreview(null);
          setPreviewError(err?.response?.data?.error || err?.message || 'Could not calculate current price.');
        }
      } finally {
        if (active) setPreviewLoading(false);
      }
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [items, addons, appliedOffer, selectedDate, activityData, isCheckoutStep]);

  if (loadingVenue) {
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

  if (!activityData?.activity) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-950 text-white">
        <Navbar />
        <div className="flex-grow flex flex-col items-center justify-center p-8 text-center">
          <AlertTriangle className="w-16 h-16 text-amber-500 mb-4" />
          <h2 className="text-2xl font-bold text-white">Venue Not Found</h2>
          <p className="text-slate-400 mt-2">The selected activity or amusement park could not be loaded.</p>
          <Link to="/activities" className="mt-6 px-6 py-2.5 bg-emerald-600 text-white rounded-xl font-bold">
            Browse Activities
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  const { activity, ticket_types = [], addons: addonDefs = [], time_windows = [] } = activityData;
  const activeTickets = ticket_types.filter((t) => t.is_active !== false && t.is_active !== 0);

  // Entry Ticket Requirement Rule:
  // If any selected ride/ticket requires entry, check if an ENTRY ticket is in cart
  const hasEntryInCart = items.some((it) => {
    const def = activeTickets.find((t) => t.id === it.ticket_type_id);
    return def && (def.product_type || '').toUpperCase() === 'ENTRY';
  });

  const selectedRidesRequiringEntry = items.filter((it) => {
    const def = activeTickets.find((t) => t.id === it.ticket_type_id);
    return def && def.requires_entry;
  });

  const missingRequiredEntry = selectedRidesRequiringEntry.length > 0 && !hasEntryInCart;

  const remainingFor = (ttId) => availability?.ticket_types?.find((t) => t.ticket_type_id === ttId);
  const currency = activity.currency_code || 'INR';
  const currencyDigits = new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits;
  const toMinor = (amount) => Math.round(Number(amount || 0) * (10 ** currencyDigits));
  const estimateSubtotalMinor = items.reduce((sum, item) => {
    const ticket = activeTickets.find((t) => Number(t.id) === Number(item.ticket_type_id));
    const avail = remainingFor(item.ticket_type_id);
    if (!ticket || !avail || avail.is_closed || Number(avail.remaining) < Number(item.quantity)) return sum;
    const price = avail.special_price != null ? avail.special_price : (availability?.weekend && ticket.weekend_price != null ? ticket.weekend_price : ticket.price);
    const unit = toMinor(price);
    return Number.isSafeInteger(unit) && unit >= 0 ? sum + unit * Number(item.quantity) : sum;
  }, 0);
  const estimateAddonMinor = addons.reduce((sum, item) => {
    const addon = addonDefs.find((a) => Number(a.id) === Number(item.addon_id));
    const unit = addon ? toMinor(addon.price) : 0;
    return Number.isSafeInteger(unit) && unit >= 0 ? sum + unit * Number(item.quantity) : sum;
  }, 0);
  const estimatedAmount = (estimateSubtotalMinor + estimateAddonMinor) / (10 ** currencyDigits);
  const totalSelectedCount = items.reduce((n, item) => n + Number(item.quantity || 0), 0);
  const dateIsAvailable = openDates.length ? openDates.some((d) => d.date === selectedDate) : /^\d{4}-\d{2}-\d{2}$/.test(selectedDate);
  const validSelection = items.length > 0 && dateIsAvailable && !!availability && items.every((item) => {
    const ticket = activeTickets.find((t) => Number(t.id) === Number(item.ticket_type_id));
    const avail = remainingFor(item.ticket_type_id);
    const qty = Number(item.quantity);
    const min = Number(ticket?.min_quantity || 1);
    const max = Number(ticket?.max_quantity || 10);
    return !!ticket && !!avail && !avail.is_closed && Number.isInteger(qty) && qty >= min && qty <= max && qty <= Number(avail.remaining);
  });

  const updateQuantity = (ttId, delta, max) => {
    setQuantities((cur) => {
      const current = Number(cur[ttId]) || 0;
      const next = Math.max(0, Math.min(Number(max) || 0, current + Number(delta || 0)));
      return { ...cur, [ttId]: next };
    });
  };

  const updateAddonQty = (addonId, delta, max = 5) => {
    setAddonQty((cur) => {
      const next = Math.max(0, Math.min(max, (cur[addonId] || 0) + delta));
      return { ...cur, [addonId]: next };
    });
  };

  const handleApplyOffer = (e) => {
    e.preventDefault();
    if (!offerCode.trim()) return;
    setAppliedOffer(offerCode.trim().toUpperCase());
  };

  const canPay =
    validSelection &&
    !missingRequiredEntry &&
    name.trim() &&
    /^\+?[\d\s()-]{7,20}$/.test(phone.trim()) &&
    (!email.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) &&
    preview &&
    !previewError &&
    !previewLoading &&
    (!activity.timed_entry_enabled || timeWindowId);
  const canContinue = validSelection && !missingRequiredEntry && (!activity.timed_entry_enabled || !!timeWindowId);

  const handlePay = async () => {
    if (!currentUser) {
      navigate(`/login?redirect=${encodeURIComponent(`${location.pathname}${location.search}`)}&reason=booking`);
      return;
    }
    if (missingRequiredEntry) {
      alert('Park Entry Ticket Required: One or more selected rides require a park entry ticket. Please add an entry ticket to proceed.');
      return;
    }
    if (!name.trim() || !/^\+?[\d\s()-]{7,20}$/.test(phone.trim()) || (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))) {
      alert('Enter your name, a valid phone number, and a valid email address if provided.');
      return;
    }

    setPaying(true);
    setPaymentError(null);
    let pendingBookingId = null;
    // set once Razorpay reports a completed payment: from then on never tell the user "not booked" — the server
    // confirms the ticket from Razorpay's own record even if this verify call fails (network drop, tab closed).
    let paidBookingId = null;

    try {
      const res = await createActivityBooking({
        activity_id: activity.id,
        booking_date: selectedDate,
        time_window_id: timeWindowId || undefined,
        items,
        addons,
        offer_code: appliedOffer || undefined,
        customer_name: name.trim(),
        customer_phone: phone.trim(),
        customer_email: email.trim() || undefined,
      });
      pendingBookingId = res.booking_id;

      // If ₹0 or free booking
      if (res.skip_payment) {
        pendingBookingId = null;
        sessionStorage.removeItem(`activity-checkout:${slug}`);
        navigate(`/my-tickets/${res.booking_id}`);
        return;
      }

      // Launch Web Razorpay
      const paymentResponse = await openRazorpayCheckout({
        keyId: res.key_id,
        orderId: res.order_id,
        amount: res.amount,
        name: 'Book Arena',
        description: `${activity.name} Tickets`,
        prefill: {
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim(),
        },
      });

      paidBookingId = res.booking_id;
      // Verify on backend
      const verifyRes = await verifyActivityPayment({
        booking_id: res.booking_id,
        razorpay_order_id: paymentResponse.razorpay_order_id,
        razorpay_payment_id: paymentResponse.razorpay_payment_id,
        razorpay_signature: paymentResponse.razorpay_signature,
      });

      if (verifyRes.success || verifyRes.confirmed) {
        pendingBookingId = null;
        sessionStorage.removeItem(`activity-checkout:${slug}`);
        navigate(`/my-tickets/${res.booking_id}`);
      } else {
        alert('Payment verification failed. Please contact support with your booking ID: ' + res.booking_id);
      }
    } catch (err) {
      console.error('Booking or Payment Error:', err);
      // 400 = signature rejected, 409 = sold out while paying: definitive answers, shown as errors below.
      if (paidBookingId && err?.status !== 400 && err?.status !== 409) {
        // Paid, but the verify call itself failed (network / server hiccup). The pass page re-checks the payment with
        // Razorpay and shows the QR as soon as it is confirmed, so send the customer there instead of an error.
        sessionStorage.removeItem(`activity-checkout:${slug}`);
        navigate(`/my-tickets/${paidBookingId}`);
        return;
      }
      if (pendingBookingId && err.message === 'PAYMENT_DISMISSED') {
        try {
          const cancelRes = await cancelPendingBooking({ booking_id: pendingBookingId });
          if (cancelRes?.confirmed || cancelRes?.pending) {
            // the payment went through before the window closed (or Razorpay could not be reached to rule it out):
            // the pass page shows the server-verified state and the QR once it is confirmed
            sessionStorage.removeItem(`activity-checkout:${slug}`);
            navigate(`/my-tickets/${pendingBookingId}`);
            return;
          }
        } catch (cancelError) {
          console.error('Could not release the pending activity booking:', cancelError);
        }
      }
      if (err.message === 'PAYMENT_DISMISSED') {
        setPaymentError('Payment window was closed before completion. Your tickets have not been booked.');
      } else {
        setPaymentError(err?.response?.data?.error || err.message || 'Payment failed or cancelled.');
      }
    } finally {
      setPaying(false);
    }
  };

  return (
    <div className="modern-page">
      <Navbar />

      {/* Header Bar */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 sm:px-6 lg:px-8 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link to={isCheckoutStep ? `/activities/${activity.slug}/book` : `/activities/${activity.slug}`} className="text-xs text-slate-400 hover:text-emerald-400 flex items-center gap-1.5 transition-colors">
            <ArrowLeft className="w-4 h-4" /> {isCheckoutStep ? 'Edit selection' : `Back to ${activity.name}`}
          </Link>
          <span className="text-xs font-bold text-slate-400">Step: {isCheckoutStep ? 'Customer details & payment' : 'Select tickets'}</span>
        </div>
      </div>

      <main className={`max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-grow ${!isCheckoutStep && totalSelectedCount > 0 ? 'pb-28' : ''}`}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Tickets & Options Selection */}
          <div className="lg:col-span-2 space-y-6">
            {!isCheckoutStep && <>
            <div className="relative h-40 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
              <img
                src={resolveMediaUrl(activity.images?.[0]) || '/images/hero/image%202%20amusement.jpeg'}
                alt={activity.name}
                className="h-full w-full object-cover"
                onError={(event) => {
                  event.currentTarget.onerror = null;
                  event.currentTarget.src = '/images/hero/image%202%20amusement.jpeg';
                }}
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/90 to-transparent px-4 pb-3 pt-10">
                <h1 className="text-lg font-black text-white">{activity.name}</h1>
              </div>
            </div>
            {/* 1. Date Picker Section */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl">
              <h2 className="text-base font-bold text-white flex items-center gap-2 mb-4">
                <Calendar className="w-5 h-5 text-emerald-400" />
                Select Visit Date
              </h2>

              <div className="flex items-center gap-2.5 overflow-x-auto pb-2 scrollbar-none">
                {openDates.length > 0 ? (
                  openDates.slice(0, 14).map((d) => {
                    const isSelected = selectedDate === d.date;
                    const dateObj = new Date(d.date);
                    const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
                    const dayNum = dateObj.getDate();
                    const monthName = dateObj.toLocaleDateString('en-US', { month: 'short' });

                    return (
                      <button
                        key={d.date}
                        type="button"
                        onClick={() => setSelectedDate(d.date)}
                        className={`flex flex-col items-center justify-center min-w-[70px] py-2.5 px-3 rounded-xl border transition-all ${
                          isSelected
                            ? 'bg-emerald-600 border-emerald-400 text-white shadow-lg shadow-emerald-950 font-bold scale-105'
                            : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <span className="text-[11px] opacity-80 uppercase">{dayName}</span>
                        <span className="text-lg font-black">{dayNum}</span>
                        <span className="text-[10px] opacity-80 uppercase">{monthName}</span>
                      </button>
                    );
                  })
                ) : (
                  <input
                    type="date"
                    value={selectedDate}
                    min={getTodayStr()}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm"
                  />
                )}
              </div>
            </div>

            {/* 2. Timed Entry Slots (if enabled) */}
            {activity.timed_entry_enabled && time_windows.length > 0 && (
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl">
                <h2 className="text-base font-bold text-white flex items-center gap-2 mb-4">
                  <Clock className="w-5 h-5 text-emerald-400" />
                  Select Entry Time Window
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {time_windows.map((w) => (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => setTimeWindowId(w.id)}
                      className={`p-3 rounded-xl border text-xs font-bold transition-all text-center ${
                        timeWindowId === w.id
                          ? 'bg-emerald-600 border-emerald-400 text-white shadow-md'
                          : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      {w.start_time} - {w.end_time}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Entry Ticket Warning Alert */}
            {missingRequiredEntry && (
              <div className="p-4 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs sm:text-sm flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="block font-bold mb-0.5">Park Entry Ticket Required!</strong>
                  You have selected rides or activities that require park entry. Please add at least 1 "Park Entry Ticket" below to proceed.
                </div>
              </div>
            )}

            {/* 3. Ticket Selection Cards */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl">
              <h2 className="text-base font-bold text-white flex items-center gap-2 mb-4">
                <Ticket className="w-5 h-5 text-emerald-400" />
                Select Tickets & Passes
              </h2>

              <div className="space-y-4">
                {activeTickets.map((t) => {
                  const avail = remainingFor(t.id);
                  const remaining = avail ? avail.remaining : (t.daily_capacity || 100);
                  const isSoldOut = avail ? avail.is_closed || remaining <= 0 : false;
                  const qty = quantities[t.id] || 0;
                  const maxLimit = Math.min(t.max_quantity || 10, remaining > 0 ? remaining : 0);
                  const ticketImage = t.image_url ? resolveMediaUrl(t.image_url) : '';

                  return (
                    <div
                      key={t.id}
                      className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                        qty > 0
                          ? 'bg-emerald-950/20 border-emerald-500/50'
                          : 'bg-slate-950 border-slate-800/80 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex-1">
                        {ticketImage && <img src={ticketImage} alt={t.name} className="w-20 h-16 rounded-lg object-cover mb-3" onError={(e) => { e.currentTarget.style.display = 'none'; }} />}
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-bold text-sm text-white">{t.name}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300">
                            {t.product_type || 'ENTRY'}
                          </span>
                          {t.requires_entry && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-500/10 border border-rose-500/30 text-rose-400">
                              Requires Park Entry
                            </span>
                          )}
                        </div>

                        {t.description && (
                          <p className="text-xs text-slate-400 mb-2">{t.description}</p>
                        )}

                        <div className="flex items-baseline gap-3 text-xs flex-wrap">
                          <span className="text-emerald-400 font-extrabold text-base">₹{t.price} <span className="text-xs font-normal text-slate-400">/ ticket</span></span>
                          {isSoldOut ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">Sold Out</span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">{remaining} available</span>
                          )}
                        </div>
                      </div>

                      {/* Quantity Controller */}
                      <div className="flex items-center gap-3 self-end sm:self-center">
                        <button
                          type="button"
                          disabled={qty <= 0}
                          onClick={() => updateQuantity(t.id, -1, maxLimit)}
                          className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-white transition-colors"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-6 text-center font-extrabold text-base text-white">{qty}</span>
                        <button
                          type="button"
                          disabled={isSoldOut || qty >= maxLimit}
                          onClick={() => updateQuantity(t.id, 1, maxLimit)}
                          className="w-8 h-8 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-white transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 4. Addons Section (if any) */}
            {addonDefs.length > 0 && (
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl">
                <h2 className="text-base font-bold text-white flex items-center gap-2 mb-4">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  Add-on Amenities & Extras
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {addonDefs.map((ad) => {
                    const q = addonQty[ad.id] || 0;
                    return (
                      <div
                        key={ad.id}
                        className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 ${
                          q > 0 ? 'bg-emerald-950/20 border-emerald-500/50' : 'bg-slate-950 border-slate-800'
                        }`}
                      >
                        <div>
                          <span className="text-xs font-bold text-white block">{ad.name}</span>
                          <span className="text-xs text-emerald-400 font-extrabold">₹{ad.price}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={q <= 0}
                            onClick={() => updateAddonQty(ad.id, -1)}
                            className="w-7 h-7 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 flex items-center justify-center text-white"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-4 text-center font-bold text-xs text-white">{q}</span>
                          <button
                            type="button"
                            onClick={() => updateAddonQty(ad.id, 1)}
                            className="w-7 h-7 rounded bg-emerald-600 hover:bg-emerald-500 flex items-center justify-center text-white"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            </>}

            {/* 5. Customer Details Form */}
            {isCheckoutStep && <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl">
              <h2 className="text-base font-bold text-white flex items-center gap-2 mb-2">
                <User className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                Complete Your Booking
              </h2>
              <p className="text-slate-400 text-xs mb-4 leading-relaxed">
                Confirm your contact details. Your verified QR tickets will be issued immediately upon payment.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Full Name <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. John Doe"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Phone Number <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="10-digit mobile number"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30"
                    />
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Email Address (optional)
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. user@gmail.com"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30"
                    />
                  </div>
                </div>
              </div>
            </div>}
          </div>

          {/* Right Column: Order Summary & Payment */}
          <div className="space-y-6" ref={summaryRef}>
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sticky top-20 shadow-2xl">
              <h2 className="text-lg font-bold text-white mb-4">Booking Summary</h2>

              <div className="mb-4 pb-4 border-b border-slate-800">
                <span className="text-xs text-slate-400 block">Venue / Experience</span>
                <span className="text-sm font-extrabold text-white block mt-0.5">{activity.name}</span>
                <span className="text-xs text-emerald-400 flex items-center gap-1 mt-1">
                  <Calendar className="w-3.5 h-3.5" /> {selectedDate}
                </span>
                {timeWindowId && <span className="text-xs text-slate-400 block mt-1">Entry time: {time_windows.find((w) => w.id === timeWindowId)?.start_time || ''} – {time_windows.find((w) => w.id === timeWindowId)?.end_time || ''}</span>}
              </div>

              {items.length > 0 && (
                <div className="space-y-3 mb-4 pb-4 border-b border-slate-800" aria-label="Selected items">
                  {items.map((item) => {
                    const ticket = activeTickets.find((t) => t.id === item.ticket_type_id);
                    if (!ticket) return null;
                    return <div key={ticket.id} className="flex items-center gap-3">
                      {ticket.image_url ? <img src={resolveMediaUrl(ticket.image_url)} alt="" className="w-12 h-12 rounded-lg object-cover bg-slate-950" onError={(e) => { e.currentTarget.style.display = 'none'; }} /> : null}
                      <div className="flex-1 min-w-0"><div className="text-xs font-bold text-white truncate">{ticket.name} × {item.quantity}</div><div className="text-[11px] text-slate-400">₹{ticket.price} each</div></div>
                      <div className="text-xs font-bold text-emerald-400">₹{(Number(ticket.price) * item.quantity).toFixed(2)}</div>
                    </div>;
                  })}
                </div>
              )}

              {isCheckoutStep && <div className="mb-4 text-xs text-slate-400">Need to change tickets, visit date, or add-ons? <Link className="text-emerald-400 font-bold" to={`/activities/${activity.slug}/book`}>Edit your selection</Link></div>}

              {/* Promo Code Form */}
              {isCheckoutStep && <form onSubmit={handleApplyOffer} className="mb-4 pb-4 border-b border-slate-800">
                <label className="text-xs font-bold text-slate-400 block mb-1.5">Have a Promo Code?</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={offerCode}
                    onChange={(e) => setOfferCode(e.target.value)}
                    placeholder="ENTER CODE"
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white uppercase placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="submit"
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-bold rounded-xl text-emerald-400 transition-colors"
                  >
                    Apply
                  </button>
                </div>
                {appliedOffer && (
                  <span className="text-[11px] text-emerald-400 mt-1.5 block">
                    ✓ Applied: <strong>{appliedOffer}</strong>
                  </span>
                )}
              </form>}

              {/* Price Breakdown */}
              {preview ? (
                <div className="space-y-2.5 text-xs pb-4 border-b border-slate-800">
                  <div className="flex justify-between text-slate-300">
                    <span>Tickets Subtotal</span>
                    <span>₹{preview.subtotal ?? preview.tickets_subtotal ?? preview.items_total ?? 0}</span>
                  </div>

                  {Number(preview.addon_amount || preview.addons_subtotal || preview.addons_total) > 0 && (
                    <div className="flex justify-between text-slate-300">
                      <span>Add-ons</span>
                      <span>₹{preview.addon_amount || preview.addons_subtotal || preview.addons_total}</span>
                    </div>
                  )}

                  {Number(preview.discount_amount || preview.offer_discount) > 0 && (
                    <div className="flex justify-between text-emerald-400 font-bold">
                      <span>Offer Discount</span>
                      <span>-₹{preview.discount_amount || preview.offer_discount}</span>
                    </div>
                  )}

                  {Number(preview.tax_amount || preview.convenience_fee) > 0 && (
                    <div className="flex justify-between text-slate-400">
                      <span>Taxes & Fees</span>
                      <span>₹{preview.tax_amount || preview.convenience_fee}</span>
                    </div>
                  )}

                  {preview.showFeeAtCheckout !== false && (Number(preview.serviceFee || preview.service_fee) > 0 || Number(preview.serviceFeeTax || preview.service_fee_tax) > 0) && (
                    <>
                      {Number(preview.serviceFee || preview.service_fee) > 0 && (
                        <div className="flex justify-between text-slate-300">
                          <span>Customer Service Fee</span>
                          <span>₹{preview.serviceFee || preview.service_fee}</span>
                        </div>
                      )}
                      {Number(preview.serviceFeeTax || preview.service_fee_tax) > 0 && (
                        <div className="flex justify-between text-slate-300">
                          <span>Tax on Service Fee</span>
                          <span>₹{preview.serviceFeeTax || preview.service_fee_tax}</span>
                        </div>
                      )}
                    </>
                  )}

                  <div className="pt-3 border-t border-slate-800 flex justify-between items-center text-sm font-black text-white">
                    <span>Total Amount</span>
                    <span className="text-xl text-emerald-400">
                      ₹{preview.total ?? preview.final_amount ?? preview.total_amount ?? preview.amount}
                    </span>
                  </div>
                </div>
              ) : items.length > 0 ? (
                <div className="space-y-2.5 text-xs pb-4 border-b border-slate-800">
                  <div className="flex justify-between text-slate-300">
                    <span>Estimated subtotal · {items.reduce((n, item) => n + Number(item.quantity || 0), 0)} ticket(s)</span>
                    <span>{formatPrice(estimatedAmount, currency)}</span>
                  </div>
                  <p className="text-[11px] text-slate-500">Taxes, offers, and final availability are confirmed at checkout.</p>
                  {previewLoading && <p role="status" className="text-[11px] text-slate-400">Refreshing server price…</p>}
                  {previewError && <p role="alert" className="text-[11px] text-rose-300">{previewError}</p>}
                </div>
              ) : (
                <div className="text-center py-6 text-xs text-slate-500">
                  <span>Total Amount</span><br />{formatPrice(0, currency)} · Select tickets to see the price breakdown.
                </div>
              )}

              {/* Error Alert */}
              {paymentError && (
                <div className="my-3 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
                  {paymentError}
                </div>
              )}

              {/* Continue to checkout or pay after customer details are ready */}
              {isCheckoutStep ? <button
                type="button"
                disabled={!canPay || paying}
                onClick={handlePay}
                className="mt-4 w-full py-3.5 bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600 hover:from-emerald-400 hover:to-teal-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-extrabold text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-950 transition-all"
              >
                {paying ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Processing Payment...
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    PAY NOW
                  </>
                )}
              </button> : <button
                type="button"
                disabled={!canContinue}
                onClick={() => {
                  const target = `/activities/${activity.slug}/checkout`;
                  navigate(currentUser
                    ? target
                    : `/login?redirect=${encodeURIComponent(target)}&reason=booking`);
                }}
                className="mt-4 w-full py-3.5 bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600 hover:from-emerald-400 hover:to-teal-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-extrabold text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-950 transition-all"
              ><Ticket className="w-4 h-4" /> Book Tickets & Continue</button>}

              {!currentUser && (
                <p role="status" className="mt-3 text-center text-xs text-amber-300">
                  Please log in to continue with your booking.
                </p>
              )}

              {isCheckoutStep && <div className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                <span>100% Secure Payments via Razorpay</span>
              </div>}
            </div>
          </div>
        </div>
      </main>

      {/* ISSUE 1: Floating Booking Button — visible on the ticket selection step when tickets are selected */}
      {!isCheckoutStep && totalSelectedCount > 0 && (
        <div
          className="fixed bottom-0 inset-x-0 z-40 bg-slate-900/95 backdrop-blur-lg border-t border-slate-800 shadow-[0_-4px_24px_rgba(0,0,0,0.5)] px-4 py-3 safe-area-pb"
          style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))' }}
        >
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <ShoppingCart className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              <div className="min-w-0">
                <span className="text-xs text-slate-400 block leading-tight">{totalSelectedCount} ticket{totalSelectedCount !== 1 ? 's' : ''} selected</span>
                <span className="text-base font-black text-emerald-400 block leading-tight">
                  {preview ? `₹${preview.total ?? preview.final_amount ?? preview.total_amount ?? estimatedAmount}` : formatPrice(estimatedAmount, currency)}
                </span>
              </div>
            </div>
            <button
              type="button"
              disabled={!canContinue}
              onClick={() => {
                if (summaryRef.current) {
                  summaryRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
                } else {
                  const target = `/activities/${activity.slug}/checkout`;
                  navigate(currentUser
                    ? target
                    : `/login?redirect=${encodeURIComponent(target)}&reason=booking`);
                }
              }}
              className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600 hover:from-emerald-400 hover:to-teal-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-extrabold text-sm rounded-xl shadow-lg shadow-emerald-950 transition-all flex-shrink-0"
            >
              Continue to Booking <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
