import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { apiGet, apiPost } from '@/lib/api';
import { setPageMeta } from '@/lib/seo';
import { Trophy, Calendar, MapPin, Users, Shield, CheckCircle, AlertTriangle, LogIn } from 'lucide-react';

export default function TournamentJoin() {
  const { token } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [tournament, setTournament] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);

  // Form State
  const [form, setForm] = useState({
    participation_type: 'INDIVIDUAL',
    team_id: '',
    requested_team_name: '',
    jersey_number: '',
    position: '',
    bio: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);

  useEffect(() => {
    // Check logged in user
    const storedUser = localStorage.getItem('userData') || localStorage.getItem('user');
    if (storedUser) {
      try { setUser(JSON.parse(storedUser)); } catch (e) {}
    }
  }, []);

  useEffect(() => {
    const fetchJoinLinkDetails = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiGet(`/tournaments/join/${token}`);
        if (res.success) {
          setTournament(res.tournament);
          setPageMeta({
            title: `Join ${res.tournament.name} — Book Arena`,
            description: `Registration page for ${res.tournament.name}. Join as a player or team.`
          });
        } else {
          setError(res.error || 'Invalid tournament joining link');
        }
      } catch (err) {
        setError(err.message || 'Failed to load tournament join link');
      } finally {
        setLoading(false);
      }
    };

    fetchJoinLinkDetails();
  }, [token]);

  const handleLoginRedirect = () => {
    const currentPath = location.pathname;
    navigate(`/login?redirect=${encodeURIComponent(currentPath)}`);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      handleLoginRedirect();
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await apiPost(`/tournaments/${tournament.id}/join`, form);
      if (res.success) {
        setSuccessMsg(res.message);
      } else {
        setError(res.error || 'Failed to submit join request');
      }
    } catch (err) {
      setError(err.message || 'Error submitting join request');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col">
        <Navbar />
        <div className="flex-grow flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
        <Footer />
      </div>
    );
  }

  if (error && !tournament) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col">
        <Navbar />
        <div className="flex-grow flex flex-col items-center justify-center p-8 text-center max-w-md mx-auto">
          <AlertTriangle className="w-16 h-16 text-amber-500 mb-4" />
          <h2 className="text-2xl font-bold text-slate-200">Unable to Open Joining Link</h2>
          <p className="text-slate-400 mt-2 text-sm">{error}</p>
          <button onClick={() => navigate('/tournaments')} className="mt-6 px-6 py-2.5 bg-emerald-600 text-white font-semibold rounded-lg">
            Browse Public Tournaments
          </button>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-white">
      <Navbar />

      <main className="flex-grow max-w-3xl w-full mx-auto px-4 sm:px-6 py-10">
        {/* Card Header */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
          {/* Banner */}
          <div className="relative h-48 bg-gradient-to-r from-slate-950 to-emerald-950 overflow-hidden">
            {tournament?.banner && <img src={tournament.banner} alt={tournament.name} className="w-full h-full object-cover opacity-40" />}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent" />

            <div className="absolute bottom-4 left-6 flex items-center gap-4">
              {tournament?.logo ? (
                <img src={tournament.logo} alt={tournament.name} className="w-16 h-16 rounded-2xl object-cover border-2 border-emerald-500" />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-emerald-600 flex items-center justify-center border-2 border-emerald-500 font-bold text-xl">
                  <Trophy className="w-8 h-8 text-white" />
                </div>
              )}
              <div>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold">
                  {tournament?.sport}
                </span>
                <h1 className="text-2xl font-extrabold text-white mt-1">{tournament?.name}</h1>
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="p-6 sm:p-8 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex items-center gap-3">
                <MapPin className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <p className="text-slate-400">Venue</p>
                  <p className="font-bold text-slate-200 truncate">{tournament?.venue || 'TBA'}</p>
                </div>
              </div>

              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex items-center gap-3">
                <Calendar className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <p className="text-slate-400">Dates</p>
                  <p className="font-bold text-slate-200">{new Date(tournament?.start_date).toLocaleDateString()}</p>
                </div>
              </div>

              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex items-center gap-3">
                <Users className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <p className="text-slate-400">Host</p>
                  <p className="font-bold text-slate-200 truncate">{tournament?.host_name || 'Organizers'}</p>
                </div>
              </div>
            </div>

            {/* Success State */}
            {successMsg ? (
              <div className="bg-emerald-950/80 border border-emerald-800 p-6 rounded-2xl text-center space-y-3">
                <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto" />
                <h3 className="text-xl font-bold text-white">Registration Submitted!</h3>
                <p className="text-slate-300 text-sm">{successMsg}</p>
                <button onClick={() => navigate(`/tournaments/${tournament.slug}`)} className="mt-4 px-6 py-2 bg-emerald-600 text-white font-bold rounded-lg text-xs">
                  View Tournament Page
                </button>
              </div>
            ) : !user ? (
              /* Unauthenticated Prompt */
              <div className="bg-slate-950 border border-slate-800 p-6 rounded-2xl text-center space-y-4">
                <LogIn className="w-10 h-10 text-emerald-400 mx-auto" />
                <div>
                  <h3 className="text-lg font-bold text-white">Login Required to Join</h3>
                  <p className="text-slate-400 text-xs mt-1">
                    Please log in with your Book Arena account to register for this tournament.
                  </p>
                </div>
                <button onClick={handleLoginRedirect} className="w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold rounded-xl text-sm shadow-lg shadow-emerald-600/30">
                  Log In & Continue &rarr;
                </button>
              </div>
            ) : (
              /* Registration Form */
              <form onSubmit={handleSubmit} className="space-y-5 bg-slate-950 border border-slate-800 p-6 rounded-2xl">
                <h3 className="text-base font-bold text-white border-b border-slate-800 pb-3">Player Registration</h3>

                {error && (
                  <div className="p-3 bg-red-950/80 border border-red-800 rounded-lg text-red-300 text-xs">
                    {error}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Jersey Number</label>
                    <input
                      type="text"
                      value={form.jersey_number}
                      onChange={(e) => setForm({ ...form, jersey_number: e.target.value })}
                      placeholder="e.g. 10"
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Playing Position / Role</label>
                    <input
                      type="text"
                      value={form.position}
                      onChange={(e) => setForm({ ...form, position: e.target.value })}
                      placeholder="e.g. Striker / Batsman"
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Team Name (Optional)</label>
                  <input
                    type="text"
                    value={form.requested_team_name}
                    onChange={(e) => setForm({ ...form, requested_team_name: e.target.value })}
                    placeholder="Enter team name if registering with a team"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Player Bio / Notes</label>
                  <textarea
                    rows="3"
                    value={form.bio}
                    onChange={(e) => setForm({ ...form, bio: e.target.value })}
                    placeholder="Short bio or note to the host..."
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-extrabold rounded-xl text-sm shadow-lg shadow-emerald-600/30 disabled:opacity-50"
                >
                  {submitting ? 'Submitting Request...' : 'Submit Join Request'}
                </button>
              </form>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
