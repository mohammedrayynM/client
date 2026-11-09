import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { apiGet, apiPost } from '@/lib/api';
import { openRazorpayCheckout } from '@/lib/razorpay';
import { setPageMeta } from '@/lib/seo';
import {
  Trophy,
  Calendar,
  MapPin,
  Users,
  DollarSign,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Shield,
  Layers
} from 'lucide-react';

const SPORTS = [
  'Cricket',
  'Football',
  'Badminton',
  'Tennis',
  'Basketball',
  'Volleyball',
  'Table Tennis',
  'Pickleball'
];

const FORMATS = [
  'Knockout',
  'Round Robin',
  'Group Stage + Knockout'
];

export default function TournamentCreate() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [config, setConfig] = useState(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [configError, setConfigError] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pendingDraft, setPendingDraft] = useState(() => {
    try {
      return typeof window === 'undefined' ? null : JSON.parse(window.sessionStorage.getItem('tournamentDraftFeeRetry') || 'null');
    } catch {
      return null;
    }
  });

  const [form, setForm] = useState({
    name: '',
    sport: 'Football',
    format_type: 'Knockout',
    venue: '',
    location: '',
    start_date: '',
    end_date: '',
    reg_open_date: '',
    reg_close_date: '',
    max_teams: '16',
    max_players: '11',
    prize_pool_amount: '0',
    description: '',
    open_registration: true,
    allow_team_registration: true,
    allow_individual_registration: false,
    visibility: 'PUBLIC'
  });

  useEffect(() => {
    setPageMeta({
      title: 'Host a Tournament — Book Arena',
      description: 'Create and organize sports tournaments with live scoring, team registration, and bracket management.',
      canonicalUrl: 'https://bookarena.in/tournaments/create'
    });

    const token = localStorage.getItem('userToken');
    const storedUser = localStorage.getItem('userData');
    if (!token) {
      navigate('/login?redirect=/tournaments/create');
      return;
    }
    if (storedUser) {
      try { setUser(JSON.parse(storedUser)); } catch {}
    }

  }, [navigate]);

  const loadCreationConfig = useCallback(async () => {
    setConfigLoading(true);
    setConfigError('');
    try {
      setConfig(await apiGet('/tournaments/creation-config'));
    } catch (err) {
      setConfig(null);
      setConfigError(err?.response?.data?.error || 'Could not load tournament pricing. Retry before creating a tournament.');
    } finally {
      setConfigLoading(false);
    }
  }, []);

  useEffect(() => { loadCreationConfig(); }, [loadCreationConfig]);

  const savePendingDraft = (draft) => {
    setPendingDraft(draft);
    if (draft) window.sessionStorage.setItem('tournamentDraftFeeRetry', JSON.stringify(draft));
    else window.sessionStorage.removeItem('tournamentDraftFeeRetry');
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const completeCreationFeePayment = async (created, tournamentName) => {
    const paymentRes = await openRazorpayCheckout({
      keyId: created.razorpay_key_id,
      orderId: created.razorpay_order_id,
      amount: created.fee_amount,
      currency: created.currency,
      name: 'Book Arena Tournaments',
      description: `Creation Fee: ${tournamentName}`,
      prefill: {
        name: user?.name,
        email: user?.email,
        phone: user?.phone
      }
    });
    const verified = await apiPost(`/tournaments/${created.tournament_id}/verify-creation-fee`, {
      razorpay_order_id: paymentRes.razorpay_order_id,
      razorpay_payment_id: paymentRes.razorpay_payment_id,
      razorpay_signature: paymentRes.razorpay_signature,
    });
    if (!verified?.success) throw new Error(verified?.error || 'The creation fee could not be verified.');
  };

  const retryCreationFee = async () => {
    if (!pendingDraft) return;
    setLoading(true);
    setError(null);
    try {
      const retry = await apiPost(`/tournaments/${pendingDraft.tournament_id}/creation-fee/retry`, {});
      if (retry.paid) {
        savePendingDraft(null);
      } else {
        await completeCreationFeePayment(retry, pendingDraft.name);
        savePendingDraft(null);
      }
      navigate(`/tournaments/${pendingDraft.slug || pendingDraft.tournament_id}`);
    } catch (err) {
      console.error('Failed to retry tournament creation payment:', err);
      setError(err?.response?.data?.error || err.message || 'Payment was not completed. Your draft is saved.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!config) {
      setError('Tournament pricing could not be loaded. Retry before creating a tournament.');
      return;
    }
    if (!form.name.trim()) {
      setError('Please enter a tournament title.');
      return;
    }
    if (!form.start_date || !form.end_date) {
      setError('Please select both start and end dates.');
      return;
    }
    if (!form.venue.trim()) {
      setError('Please enter the venue name or stadium.');
      return;
    }

    setLoading(true);
    setError(null);
    let created;

    try {
      const payload = {
        ...form,
        max_teams: parseInt(form.max_teams) || null,
        max_players: parseInt(form.max_players) || null,
        prize_pool_amount: parseFloat(form.prize_pool_amount) || 0,
      };

      const res = await apiPost('/tournaments', payload);
      created = res;

      if (res.fee_required) {
        savePendingDraft({ tournament_id: res.tournament_id, slug: res.slug, name: form.name });
        if (!res.razorpay_order_id) throw new Error('The tournament draft was saved, but its payment order is unavailable. Retry payment.');
        await completeCreationFeePayment(res, form.name);
        savePendingDraft(null);
      }

      const slug = res.slug || res.tournament?.slug || res.tournament_id;
      navigate(`/tournaments/${slug}`);
    } catch (err) {
      console.error('Failed to create tournament:', err);
      const message = err?.response?.data?.error || err.message || 'Failed to create tournament.';
      if (created?.fee_required) {
        savePendingDraft({ tournament_id: created.tournament_id, slug: created.slug, name: form.name });
        setError(`Your tournament draft is saved, but payment is not confirmed. ${message}`);
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-white">
      <Navbar />

      <div className="bg-slate-900 border-b border-slate-800 px-4 sm:px-6 lg:px-8 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link to="/tournaments" className="text-xs text-slate-400 hover:text-emerald-400 flex items-center gap-1.5 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Tournaments
          </Link>
          <span className="text-xs font-bold text-emerald-400">Host New Championship</span>
        </div>
      </div>

      <main className="max-w-3xl w-full mx-auto px-4 py-10 flex-grow">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white shadow-lg shadow-emerald-950">
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white">Host a Tournament</h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Set up your tournament, invite teams, accept entry fees, and score live matches.
              </p>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs sm:text-sm flex items-center gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {pendingDraft && (
            <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-100 text-sm flex items-center justify-between gap-3">
              <span>Draft saved: {pendingDraft.name}. Complete payment to publish it.</span>
              <button type="button" onClick={retryCreationFee} disabled={loading} className="font-bold underline disabled:opacity-50">
                {loading ? 'Working…' : 'Retry payment'}
              </button>
            </div>
          )}

          {configLoading && <p className="mb-4 text-sm text-slate-400">Loading tournament pricing…</p>}
          {configError && (
            <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm flex items-center justify-between gap-3">
              <span>{configError}</span>
              <button type="button" onClick={loadCreationConfig} disabled={configLoading} className="font-bold underline disabled:opacity-50">
                Retry
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 1. Basic Details */}
            <div className="space-y-4">
              <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">Tournament Info</h3>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Tournament Title <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="e.g. Chennai Premier League 2026"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Sport</label>
                  <select
                    name="sport"
                    value={form.sport}
                    onChange={handleChange}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                  >
                    {SPORTS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Format</label>
                  <select
                    name="format_type"
                    value={form.format_type}
                    onChange={handleChange}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                  >
                    {FORMATS.map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* 2. Venue & Location */}
            <div className="space-y-4 pt-4 border-t border-slate-800">
              <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">Venue & Schedule</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Venue Name / Turf <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    name="venue"
                    value={form.venue}
                    onChange={handleChange}
                    placeholder="e.g. Galaxy Arena Turf"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">City / Location</label>
                  <input
                    type="text"
                    name="location"
                    value={form.location}
                    onChange={handleChange}
                    placeholder="e.g. Anna Nagar, Chennai"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Start Date</label>
                  <input
                    type="date"
                    required
                    name="start_date"
                    value={form.start_date}
                    onChange={handleChange}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">End Date</label>
                  <input
                    type="date"
                    required
                    name="end_date"
                    value={form.end_date}
                    onChange={handleChange}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>

            {/* 3. Team Limits & Registration */}
            <div className="space-y-4 pt-4 border-t border-slate-800">
              <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">Teams & Entry Fee</h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Max Teams</label>
                  <input
                    type="number"
                    min="2"
                    max="128"
                    name="max_teams"
                    value={form.max_teams}
                    onChange={handleChange}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Players Per Team</label>
                  <input
                    type="number"
                    min="1"
                    name="max_players"
                    value={form.max_players}
                    onChange={handleChange}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Prize Pool</label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    name="prize_pool_amount"
                    value={form.prize_pool_amount}
                    onChange={handleChange}
                    placeholder="Prize pool amount"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-6 pt-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                  <input
                    type="checkbox"
                    name="open_registration"
                    checked={form.open_registration}
                    onChange={handleChange}
                    className="w-4 h-4 rounded text-emerald-500 bg-slate-950 border-slate-800 focus:ring-0"
                  />
                  <span>Open Public Registration</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                  <input
                    type="checkbox"
                    name="allow_team_registration"
                    checked={form.allow_team_registration}
                    onChange={handleChange}
                    className="w-4 h-4 rounded text-emerald-500 bg-slate-950 border-slate-800 focus:ring-0"
                  />
                  <span>Allow Team Signups</span>
                </label>
              </div>
            </div>

            {/* 4. Description */}
            <div className="pt-4 border-t border-slate-800">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Description & Rules
              </label>
              <textarea
                rows="4"
                name="description"
                value={form.description}
                onChange={handleChange}
                placeholder="Mention tournament guidelines, prizes, ball type, match rules..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Creation Fee Notice if any */}
            {config?.fee_required && config.fee_amount > 0 && (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-center justify-between">
                <span>Tournament Publishing Fee:</span>
                <span className="text-base font-extrabold text-emerald-400">{config.currency} {config.fee_amount}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || configLoading || !config}
              className="w-full py-3.5 bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600 hover:from-emerald-400 hover:to-teal-500 disabled:opacity-50 text-white font-extrabold text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-950 transition-all"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Creating Tournament...
                </>
              ) : (
                <>
                  <Trophy className="w-4 h-4" /> Publish Tournament
                </>
              )}
            </button>
          </form>
        </div>
      </main>

      <Footer />
    </div>
  );
}
