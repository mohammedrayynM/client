import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { fetchActivity } from '@/services/activities';
import { resolveMediaUrl } from '@/lib/mediaUrl';
import { setPageMeta } from '@/lib/seo';
import {
  MapPin,
  Clock,
  Phone,
  Ticket,
  ShieldAlert,
  Info,
  Share2,
  ChevronRight,
  Sparkles,
  ArrowLeft,
  Calendar,
  AlertCircle
} from 'lucide-react';

const ACTIVITY_IMAGE_FALLBACK = '/images/hero/image%202%20amusement.jpeg';

export default function ActivityDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('ALL');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    fetchActivity(slug)
      .then((res) => {
        setData(res);
        if (res?.activity) {
          setPageMeta({
            title: `${res.activity.name} — Tickets & Experiences | Book Arena`,
            description: res.activity.short_description || res.activity.description || `Book tickets and rides for ${res.activity.name}.`,
            canonicalUrl: `https://bookarena.in/activities/${res.activity.slug}`
          });
        }
      })
      .catch((err) => {
        console.error('Failed to load activity:', err);
        setError('This venue or activity is currently unavailable or pending approval.');
      })
      .finally(() => setLoading(false));
  }, [slug]);

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: data?.activity?.name,
        text: `Check out ${data?.activity?.name} on Book Arena!`,
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

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

  if (error || !data?.activity) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-950 text-white">
        <Navbar />
        <div className="flex-grow flex flex-col items-center justify-center p-8 text-center">
          <AlertCircle className="w-16 h-16 text-amber-500 mb-4" />
          <h2 className="text-2xl font-bold text-white">Venue Unavailable</h2>
          <p className="text-slate-400 mt-2 max-w-md">{error || 'Could not find the requested activity.'}</p>
          <Link
            to="/activities"
            className="mt-6 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all"
          >
            Browse All Activities
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  const { activity, ticket_types = [], addons = [], offers = [] } = data;
  const images = Array.isArray(activity.images) ? activity.images.map(resolveMediaUrl).filter(Boolean) : [];
  const facilities = Array.isArray(activity.facilities) ? activity.facilities : [];
  const openDays = Array.isArray(activity.opening_days) ? activity.opening_days : [];

  const activeTickets = ticket_types.filter((t) => t.is_active !== false && t.is_active !== 0);
  const startingPrice = activeTickets.length ? Math.min(...activeTickets.map((t) => Number(t.price))) : null;

  // Categorize tickets
  const entryTickets = activeTickets.filter((t) => (t.product_type || 'ENTRY') === 'ENTRY');
  const rideTickets = activeTickets.filter((t) => t.product_type === 'RIDE');
  const activityTickets = activeTickets.filter((t) => t.product_type === 'ACTIVITY');
  const passTickets = activeTickets.filter((t) => t.product_type === 'PASS');

  const filteredTickets = activeTab === 'ALL'
    ? activeTickets
    : activeTickets.filter((t) => (t.product_type || 'ENTRY') === activeTab);

  return (
    <div className="modern-page">
      <Navbar />

      {/* Top Breadcrumb & Share */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 sm:px-6 lg:px-8 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link to="/activities" className="text-xs text-slate-400 hover:text-emerald-400 flex items-center gap-1.5 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Activities
          </Link>
          <button
            onClick={handleShare}
            className="text-xs text-slate-300 hover:text-white flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors"
          >
            <Share2 className="w-3.5 h-3.5 text-emerald-400" />
            {copied ? 'Link Copied!' : 'Share'}
          </button>
        </div>
      </div>

      {/* Hero Gallery & Header */}
      <section className="relative bg-gradient-to-b from-slate-900 to-slate-950 border-b border-slate-800/80 pb-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Gallery */}
            <div className="lg:col-span-2">
              <div className="relative h-72 sm:h-96 rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 shadow-2xl">
                {images.length > 0 ? (
                  <img
                    src={images[0]}
                    alt={activity.name}
                    className="w-full h-full object-cover"
                    onError={(event) => {
                      event.currentTarget.onerror = null;
                      event.currentTarget.src = ACTIVITY_IMAGE_FALLBACK;
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-6xl bg-gradient-to-br from-slate-900 to-slate-950">
                    🎡
                  </div>
                )}
                <div className="absolute top-4 left-4 flex gap-2">
                  <span className="px-3 py-1 rounded-full bg-slate-950/80 backdrop-blur-md border border-slate-700 text-xs font-bold text-emerald-400">
                    {activity.category_label || 'Amusement Park'}
                  </span>
                  {activity.has_offer && (
                    <span className="px-3 py-1 rounded-full bg-rose-600 text-xs font-black text-white shadow-lg">
                      SPECIAL OFFERS
                    </span>
                  )}
                </div>
              </div>

              {/* Thumbnails */}
              {images.length > 1 && (
                <div className="flex gap-3 mt-3 overflow-x-auto pb-1">
                  {images.slice(1, 5).map((img, idx) => (
                    <img
                      key={idx}
                      src={img}
                      alt={`${activity.name} preview`}
                      className="h-16 w-24 object-cover rounded-xl border border-slate-800 hover:border-emerald-500 cursor-pointer transition-colors"
                      onError={(event) => {
                        event.currentTarget.onerror = null;
                        event.currentTarget.src = ACTIVITY_IMAGE_FALLBACK;
                      }}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Quick Summary Card */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between shadow-xl">
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight">
                  {activity.name}
                </h1>

                <div className="mt-3 flex items-start gap-2 text-xs text-slate-300">
                  <MapPin className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <span>{activity.address || activity.location || 'Location details on booking'}</span>
                </div>

                {openDays.length > 0 && (
                  <div className="mt-2.5 flex items-center gap-2 text-xs text-slate-300">
                    <Clock className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span>Open: {openDays.join(', ')}</span>
                  </div>
                )}

                {activity.contact_phone && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-slate-300">
                    <Phone className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span>{activity.contact_phone}</span>
                  </div>
                )}

                {facilities.length > 0 && (
                  <div className="mt-6 pt-4 border-t border-slate-800">
                    <span className="text-xs font-bold text-slate-400 block mb-2">Amenities & Facilities</span>
                    <div className="flex flex-wrap gap-1.5">
                      {facilities.map((fac, i) => (
                        <span key={i} className="px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700/60 text-[11px] text-slate-300">
                          ✓ {fac}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Price & Checkout CTA */}
              <div className="mt-8 pt-5 border-t border-slate-800">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <span className="text-xs text-slate-400 block">Starting from</span>
                    <span className="text-2xl font-black text-emerald-400">
                      {startingPrice != null ? `₹${startingPrice}` : 'View passes'}
                    </span>
                  </div>
                  <span className="text-xs text-slate-400">Per Person</span>
                </div>

                <Link
                  to={`/activities/${activity.slug}/book`}
                  className="w-full py-3.5 bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-extrabold text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-950 transition-all"
                >
                  <Ticket className="w-4 h-4" /> Select Tickets & Book
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Body: Description & Ticket Types */}
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 flex-grow">
        {/* Description Section */}
        {activity.description && (
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 mb-10">
            <h2 className="text-lg font-bold text-white mb-3">About {activity.name}</h2>
            <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-line">
              {activity.description}
            </p>
          </div>
        )}

        {/* Tickets & Passes Section */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-2xl font-extrabold text-white">Tickets, Rides & Passes</h2>
              <p className="text-slate-400 text-xs mt-1">
                Choose entry tickets or individual ride passes. (Rides marked with "Requires Park Entry" need an Entry Ticket in cart).
              </p>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {[
                { id: 'ALL', label: `All (${activeTickets.length})` },
                { id: 'ENTRY', label: `Entry (${entryTickets.length})` },
                { id: 'RIDE', label: `Rides (${rideTickets.length})` },
                { id: 'ACTIVITY', label: `Activities (${activityTickets.length})` },
                { id: 'PASS', label: `Passes (${passTickets.length})` },
              ]
                .filter((tb) => tb.id === 'ALL' || activeTickets.some((t) => (t.product_type || 'ENTRY') === tb.id))
                .map((tb) => (
                  <button
                    key={tb.id}
                    onClick={() => setActiveTab(tb.id)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                      activeTab === tb.id
                        ? 'bg-emerald-600 border-emerald-500 text-white shadow-md'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {tb.label}
                  </button>
                ))}
            </div>
          </div>

          {/* Ticket Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTickets.map((t) => {
              const thumb = t.image_url ? resolveMediaUrl(t.image_url) : '';
              const type = (t.product_type || 'ENTRY').toUpperCase();
              return (
                <div
                  key={t.id}
                  className="bg-slate-900/90 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 flex flex-col justify-between transition-all"
                >
                  <div>
                    {thumb && (
                      <div className="h-40 w-full mb-4 rounded-xl overflow-hidden bg-slate-950">
                        <img src={thumb} alt={t.name} className="w-full h-full object-cover" />
                      </div>
                    )}

                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className={`px-2.5 py-0.5 rounded text-[11px] font-black uppercase tracking-wider ${
                        type === 'ENTRY' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                        type === 'RIDE' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' :
                        type === 'PASS' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                        'bg-slate-800 text-slate-300'
                      }`}>
                        {type}
                      </span>

                      {t.requires_entry ? (
                        <span className="px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[10px] font-semibold flex items-center gap-1">
                          <Info className="w-3 h-3" /> Requires Park Entry
                        </span>
                      ) : null}
                    </div>

                    <h3 className="text-base font-bold text-white mb-1">{t.name}</h3>
                    {t.description && (
                      <p className="text-slate-300 text-xs leading-relaxed mb-3">{t.description}</p>
                    )}

                    {/* Restrictions */}
                    {(t.min_age || t.max_age || t.min_height_cm) && (
                      <div className="mb-3 p-2 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-slate-400 flex items-center gap-1.5">
                        <ShieldAlert className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                        <span>
                          {[
                            t.min_age ? `Age ${t.min_age}+` : '',
                            t.max_age ? `Max age ${t.max_age}` : '',
                            t.min_height_cm ? `Min ${t.min_height_cm} cm` : ''
                          ].filter(Boolean).join(' · ')}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between">
                    <div>
                      <span className="text-xs text-slate-400 block">Price</span>
                      <span className="text-xl font-black text-emerald-400">₹{t.price}</span>
                    </div>

                    <Link
                      to={`/activities/${activity.slug}/book`}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl flex items-center gap-1 transition-all"
                    >
                      Book Ticket <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Offers Banner if any */}
        {offers.length > 0 && (
          <div className="mt-12 bg-gradient-to-r from-rose-950/40 via-slate-900 to-indigo-950/40 border border-rose-800/40 rounded-2xl p-6">
            <h3 className="text-sm font-extrabold text-rose-300 uppercase tracking-wider mb-2 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-rose-400" /> Active Deals & Coupons
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-3">
              {offers.map((off) => (
                <div key={off.id} className="bg-slate-950/80 border border-slate-800 p-3.5 rounded-xl">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      {off.code}
                    </span>
                    <span className="text-xs font-black text-white">
                      {off.discount_percent ? `${off.discount_percent}% OFF` : `₹${off.discount_amount} OFF`}
                    </span>
                  </div>
                  {off.description && <p className="text-xs text-slate-400 mt-2">{off.description}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Sticky Bottom Bar for Mobile / Quick Booking */}
      <div className="sticky bottom-0 z-30 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 px-4 py-3 sm:hidden">
        <div className="flex items-center justify-between gap-4">
          <div>
            <span className="text-[11px] text-slate-400 block">From</span>
            <span className="text-lg font-black text-emerald-400">
              {startingPrice != null ? `₹${startingPrice}` : 'View passes'}
            </span>
          </div>
          <Link
            to={`/activities/${activity.slug}/book`}
            className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-950"
          >
            <Ticket className="w-3.5 h-3.5" /> Book Now
          </Link>
        </div>
      </div>

      <Footer />
    </div>
  );
}
