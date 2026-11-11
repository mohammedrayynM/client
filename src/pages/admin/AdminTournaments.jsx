import { useState, useEffect } from 'react';
import { apiGet, apiPost, apiPatch } from '@/lib/api';
import { Trophy, Search, Filter, ShieldAlert, DollarSign, Lock, AlertOctagon } from 'lucide-react';

export default function AdminTournaments() {
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sportFilter, setSportFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Settings state (Admin fee & duration rules)
  const [settings, setSettings] = useState({ fee_amount: 0, is_active: true, max_duration_days: 30, min_duration_days: 1 });
  const [showFeeModal, setShowFeeModal] = useState(false);
  const [feeForm, setFeeForm] = useState({
    fee_mode: 'paid', // 'free' | 'paid'
    fee_amount: '0',
    is_active: true,
    creation_enabled: true,
    min_duration_days: '1',
    max_duration_days: '30'
  });
  const [savingFee, setSavingFee] = useState(false);

  const loadAdminTournaments = async () => {
    setLoading(true);
    try {
      let url = '/admin-tournaments?';
      if (search) url += `search=${encodeURIComponent(search)}&`;
      if (sportFilter) url += `sport=${encodeURIComponent(sportFilter)}&`;
      if (statusFilter) url += `status=${encodeURIComponent(statusFilter)}&`;

      const [res, setRes] = await Promise.all([
        apiGet(url),
        apiGet('/admin-tournaments/settings')
      ]);

      if (res.success) setTournaments(res.tournaments || []);
      if (setRes.success && setRes.settings) {
        setSettings(setRes.settings);
        const isFree = !setRes.settings.is_active || Number(setRes.settings.fee_amount) === 0;
        setFeeForm({
          fee_mode: isFree ? 'free' : 'paid',
          fee_amount: String(setRes.settings.fee_amount || 0),
          is_active: Boolean(setRes.settings.is_active),
          creation_enabled: Boolean(setRes.settings.creation_enabled ?? true),
          min_duration_days: String(setRes.settings.min_duration_days || 1),
          max_duration_days: String(setRes.settings.max_duration_days || 30),
        });
      }
    } catch (err) {
      console.error('Error loading admin tournaments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminTournaments();
  }, [search, sportFilter, statusFilter]);

  const handleSaveFee = async (e) => {
    e.preventDefault();
    const isFree = feeForm.fee_mode === 'free';
    const feeAmount = isFree ? 0 : Number(feeForm.fee_amount);
    if (!isFree && (!feeForm.fee_amount.trim() || !Number.isFinite(feeAmount) || feeAmount < 0 || feeAmount > 99999999.99)) {
      alert('Enter a valid non-negative fee amount.');
      return;
    }
    const minD = parseInt(feeForm.min_duration_days, 10) || 1;
    const maxD = parseInt(feeForm.max_duration_days, 10) || 30;
    if (minD < 1 || maxD < minD) {
      alert('Maximum duration must be greater than or equal to minimum duration.');
      return;
    }

    setSavingFee(true);
    try {
      const res = await apiPost('/admin-tournaments/settings', {
        fee_amount: feeAmount,
        is_active: !isFree,
        creation_enabled: feeForm.creation_enabled,
        min_duration_days: minD,
        max_duration_days: maxD,
      });
      if (res.success && res.settings) {
        setSettings(res.settings);
        setShowFeeModal(false);
        alert('Tournament creation fee and duration rules updated successfully!');
      }
    } catch (e) {
      alert('Failed to save tournament settings: ' + (e?.response?.data?.error || e.message));
    } finally {
      setSavingFee(false);
    }
  };

  const handleUpdateStatus = async (tournamentId, status) => {
    if (!window.confirm(`Are you sure you want to ${status.toLowerCase()} this tournament?`)) return;
    try {
      const res = await apiPatch(`/admin-tournaments/${tournamentId}/status`, { status });
      if (res.success) {
        loadAdminTournaments();
      } else {
        alert(res.error || 'Failed to update tournament status');
      }
    } catch (e) {
      alert('Failed to update status');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/80 p-6 rounded-2xl border border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Trophy className="w-5 h-5 text-emerald-400" /> Admin Tournament Oversight
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Global tournament management, host oversight, pricing settings, and moderation.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="bg-slate-950 px-3.5 py-2 rounded-xl border border-slate-800 text-xs">
              <span className="text-slate-400">Creation Fee: </span>
              <span className={`font-bold ${!settings.is_active || Number(settings.fee_amount) === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {!settings.is_active || Number(settings.fee_amount) === 0 ? 'Free (No Charges)' : `${settings.currency_code || 'INR'} ${settings.fee_amount}`}
              </span>
            </div>
            <div className="hidden sm:block bg-slate-950 px-3.5 py-2 rounded-xl border border-slate-800 text-xs">
              <span className="text-slate-400">Max Duration: </span>
              <span className="font-bold text-white">{settings.max_duration_days || 30} days</span>
            </div>
          </div>

          <button
            onClick={() => setShowFeeModal(true)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5"
          >
            <DollarSign className="w-4 h-4" /> Configure Fee
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-3 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tournament name or slug..."
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-xs text-white"
          />
        </div>

        <select
          value={sportFilter}
          onChange={(e) => setSportFilter(e.target.value)}
          className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
        >
          <option value="">All Sports</option>
          {['Football', 'Cricket', 'Badminton', 'Basketball', 'Volleyball', 'Tennis', 'Table Tennis'].map(sp => (
            <option key={sp} value={sp}>{sp}</option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
        >
          <option value="">All Statuses</option>
          {['DRAFT', 'REGISTRATION_OPEN', 'UPCOMING', 'LIVE', 'COMPLETED', 'CANCELLED'].map(st => (
            <option key={st} value={st}>{st}</option>
          ))}
        </select>
      </div>

      {/* Tournaments Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase font-semibold border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Tournament</th>
                <th className="py-3 px-4">Sport</th>
                <th className="py-3 px-4">Host</th>
                <th className="py-3 px-4">Dates</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr><td colSpan="6" className="py-8 text-center text-slate-500">Loading tournaments...</td></tr>
              ) : tournaments.length === 0 ? (
                <tr><td colSpan="6" className="py-8 text-center text-slate-500">No tournaments match filter criteria.</td></tr>
              ) : (
                tournaments.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-800/40">
                    <td className="py-3.5 px-4 font-bold text-white">
                      {t.name}
                      <p className="text-slate-500 text-2xs font-normal">{t.venue}, {t.location}</p>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-emerald-400">{t.sport}</td>
                    <td className="py-3.5 px-4">
                      {t.owner_name}
                      <p className="text-slate-500 text-2xs">{t.owner_email}</p>
                    </td>
                    <td className="py-3.5 px-4 text-slate-400">
                      {new Date(t.start_date).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2.5 py-1 rounded bg-slate-950 border border-slate-800 text-emerald-400 font-bold">
                        {t.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {t.status !== 'CANCELLED' && (
                        <button
                          onClick={() => handleUpdateStatus(t.id, 'CANCELLED')}
                          className="px-3 py-1 bg-red-950 hover:bg-red-900 border border-red-800 text-red-300 font-bold rounded text-xs"
                        >
                          Cancel / Suspend
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Admin Fee & Duration Settings Modal */}
      {showFeeModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-400" /> Tournament Creation Fee & Duration Rules
              </h3>
              <p className="text-2xs text-slate-400 mt-1">Configure global fee policies, duration caps, and host access rules.</p>
            </div>

            <form onSubmit={handleSaveFee} className="space-y-4 text-xs">
              {/* Fee Mode: No Charges vs Paid */}
              <div>
                <label className="block text-slate-300 mb-2 font-semibold">Fee Mode for Hosts</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFeeForm({ ...feeForm, fee_mode: 'free', fee_amount: '0', is_active: false })}
                    className={`p-3 rounded-xl border text-left transition-all ${feeForm.fee_mode === 'free' ? 'bg-emerald-950/60 border-emerald-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'}`}
                  >
                    <div className="font-bold text-xs text-emerald-400 flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${feeForm.fee_mode === 'free' ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                      No Charges (Free)
                    </div>
                    <p className="text-2xs text-slate-400 mt-1">Hosts create & publish tournaments with ₹0 fee. Razorpay gateway bypassed.</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFeeForm({ ...feeForm, fee_mode: 'paid', is_active: true })}
                    className={`p-3 rounded-xl border text-left transition-all ${feeForm.fee_mode === 'paid' ? 'bg-emerald-950/60 border-emerald-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'}`}
                  >
                    <div className="font-bold text-xs text-emerald-400 flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${feeForm.fee_mode === 'paid' ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                      Paid Tournament Creation
                    </div>
                    <p className="text-2xs text-slate-400 mt-1">Hosts must pay the fixed admin creation fee via Razorpay before publishing.</p>
                  </button>
                </div>
              </div>

              {/* Fee Amount (Only if paid) */}
              {feeForm.fee_mode === 'paid' && (
                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">
                    Fee Amount ({settings.currency_code || 'INR'})
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    max="99999999.99"
                    step="1"
                    value={feeForm.fee_amount}
                    onChange={(e) => setFeeForm({ ...feeForm, fee_amount: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white font-mono text-sm"
                    placeholder="e.g. 500"
                  />
                  <p className="text-2xs text-slate-500 mt-1">This amount is collected via Razorpay and verified by the backend.</p>
                </div>
              )}

              {/* Duration Limits */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">Min Duration (days)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    max="365"
                    value={feeForm.min_duration_days}
                    onChange={(e) => setFeeForm({ ...feeForm, min_duration_days: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">Max Duration (days)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    max="365"
                    value={feeForm.max_duration_days}
                    onChange={(e) => setFeeForm({ ...feeForm, max_duration_days: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white"
                  />
                </div>
              </div>
              <p className="text-2xs text-slate-500">Host cannot schedule a tournament where (End Date - Start Date + 1) exceeds Max Duration.</p>

              {/* Creation Enabled Toggle */}
              <div className="flex items-center gap-2 pt-1 border-t border-slate-800">
                <input
                  type="checkbox"
                  id="creationEnabled"
                  checked={feeForm.creation_enabled}
                  onChange={(e) => setFeeForm({ ...feeForm, creation_enabled: e.target.checked })}
                  className="rounded bg-slate-950 border-slate-800 text-emerald-500"
                />
                <label htmlFor="creationEnabled" className="text-slate-300 font-semibold cursor-pointer">
                  Allow new tournament creation for hosts
                </label>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowFeeModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingFee}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition-colors"
                >
                  {savingFee ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
