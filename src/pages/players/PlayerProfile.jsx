import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { apiGet } from '@/lib/api';
import { setPageMeta } from '@/lib/seo';
import { User, Trophy, Award, Shield, Activity, Calendar, Zap, CheckCircle2 } from 'lucide-react';

export default function PlayerProfile() {
  const { id } = useParams();
  const [playerData, setPlayerData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPlayer = async () => {
      setLoading(true);
      try {
        const res = await apiGet(`/players/${id}`);
        if (res.success) {
          setPlayerData(res.player);
          setPageMeta({
            title: `${res.player.name} — Player Tournament Profile | Book Arena`,
            description: `View tournament statistics, match records, and insights for ${res.player.name}.`
          });
        }
      } catch (err) {
        console.error('Error fetching player profile:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPlayer();
  }, [id]);

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

  if (!playerData) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col">
        <Navbar />
        <div className="flex-grow flex flex-col items-center justify-center p-8 text-center">
          <User className="w-16 h-16 text-slate-600 mb-4" />
          <h2 className="text-2xl font-bold text-slate-300">Player Profile Not Found</h2>
          <Link to="/tournaments" className="mt-4 px-6 py-2 bg-emerald-600 text-white font-bold rounded-lg text-xs">
            Back to Tournaments
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  const s = playerData.stats || {};

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-white">
      <Navbar />

      {/* Header Profile Section */}
      <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 border-b border-slate-800 py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center gap-6">
          {playerData.profile_photo ? (
            <img src={playerData.profile_photo} alt={playerData.name} className="w-24 h-24 rounded-full object-cover border-4 border-emerald-500 shadow-xl" />
          ) : (
            <div className="w-24 h-24 rounded-full bg-emerald-600 flex items-center justify-center font-black text-3xl border-4 border-emerald-500 text-white shadow-xl">
              {playerData.name?.substring(0, 2).toUpperCase()}
            </div>
          )}

          <div className="text-center sm:text-left">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold mb-2">
              <Shield className="w-3.5 h-3.5" /> Book Arena Verified Athlete
            </div>
            <h1 className="text-3xl font-extrabold text-white">{playerData.name}</h1>
            <p className="text-slate-400 text-xs mt-1">Joined {new Date(playerData.created_at).toLocaleDateString()}</p>
          </div>
        </div>
      </div>

      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        {/* Dynamic Analytics Insights */}
        {playerData.insights?.length > 0 && (
          <div className="bg-gradient-to-r from-emerald-950/80 to-slate-900/90 border border-emerald-800/80 p-5 rounded-2xl">
            <h3 className="text-sm font-bold text-emerald-400 mb-3 flex items-center gap-2">
              <Zap className="w-4 h-4" /> Performance Highlights & Insights
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {playerData.insights.map((ins, idx) => (
                <div key={idx} className="flex items-center gap-2.5 p-3 bg-slate-950/80 rounded-xl border border-slate-800 text-xs font-semibold text-slate-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  {ins}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
          <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl text-center">
            <p className="text-xs text-slate-400">Tournaments</p>
            <p className="text-2xl font-black text-white mt-1">{s.total_tournaments || 0}</p>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl text-center">
            <p className="text-xs text-slate-400">Matches Played</p>
            <p className="text-2xl font-black text-white mt-1">{s.total_matches || 0}</p>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl text-center">
            <p className="text-xs text-slate-400">Goals / Points</p>
            <p className="text-2xl font-black text-emerald-400 mt-1">{s.total_goals || 0}</p>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl text-center">
            <p className="text-xs text-slate-400">Assists</p>
            <p className="text-2xl font-black text-emerald-400 mt-1">{s.total_assists || 0}</p>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl text-center">
            <p className="text-xs text-slate-400">MVP Awards</p>
            <p className="text-2xl font-black text-amber-400 mt-1">{s.mvp_count || 0}</p>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl text-center">
            <p className="text-xs text-slate-400">Cards (Y/R)</p>
            <p className="text-2xl font-black text-slate-300 mt-1">{s.yellow_cards || 0} / {s.red_cards || 0}</p>
          </div>
        </div>

        {/* Tournament History */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6">
          <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-emerald-400" /> Tournament Participation History
          </h3>

          <div className="space-y-3">
            {playerData.participations?.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-6">No approved tournament participation records found.</p>
            ) : (
              playerData.participations.map((pt) => (
                <div key={pt.id} className="flex items-center justify-between p-4 bg-slate-950 rounded-xl border border-slate-800">
                  <div>
                    <Link to={`/tournaments/${pt.tournament_slug}`} className="font-bold text-white hover:text-emerald-400 text-sm">
                      {pt.tournament_name}
                    </Link>
                    <p className="text-xs text-slate-400 mt-0.5">Sport: {pt.sport} &bull; Team: {pt.team_name || 'Individual'}</p>
                  </div>
                  <span className="px-3 py-1 bg-emerald-950 text-emerald-400 border border-emerald-800 rounded-lg text-xs font-bold">
                    {pt.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
