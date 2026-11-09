import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { apiGet, apiPost } from '@/lib/api';
import { setPageMeta } from '@/lib/seo';
import { Trophy, Calendar, MapPin, Users, Shield, Share2, Radio, Award, Megaphone, CheckCircle2, ChevronRight, X, AlertCircle } from 'lucide-react';

export default function TournamentDetail() {
  const { slug } = useParams();
  const [tournament, setTournament] = useState(null);
  const [teams, setTeams] = useState([]);
  const [fixtures, setFixtures] = useState([]);
  const [standings, setStandings] = useState([]);
  const [stats, setStats] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchTournamentData = async () => {
      setLoading(true);
      try {
        const res = await apiGet(`/tournaments/${slug}`);
        if (res.success) {
          const t = res.tournament;
          setTournament(t);

          setPageMeta({
            title: `${t.name} — ${t.sport} Tournament | Book Arena`,
            description: t.description || `View teams, fixtures, live scores, and standings for ${t.name}.`,
            canonicalUrl: `https://bookarena.in/tournaments/${t.slug}`
          });

          // Fetch sub-data in parallel
          const [teamsRes, fixRes, standRes, statsRes, annRes] = await Promise.all([
            apiGet(`/tournaments/${t.id}/teams`),
            apiGet(`/tournaments/${t.id}/fixtures`),
            apiGet(`/tournaments/${t.id}/standings`),
            apiGet(`/tournaments/${t.id}/stats`),
            apiGet(`/tournaments/${t.id}/announcements`)
          ]);

          if (teamsRes.success) setTeams(teamsRes.teams || []);
          if (fixRes.success) setFixtures(fixRes.fixtures || []);
          if (standRes.success) setStandings(standRes.standings || []);
          if (statsRes.success) setStats(statsRes);
          if (annRes.success) setAnnouncements(annRes.announcements || []);
        }
      } catch (err) {
        console.error('Error loading tournament details:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTournamentData();
  }, [slug]);

  const handleShare = () => {
    const shareUrl = window.location.href;
    if (navigator.share) {
      navigator.share({
        title: tournament?.name,
        text: `Check out ${tournament?.name} on Book Arena!`,
        url: shareUrl,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleWhatsAppShare = () => {
    const shareUrl = window.location.href;
    const text = encodeURIComponent(`🏆 Check out ${tournament?.name} (${tournament?.sport}) on Book Arena!\n\n${shareUrl}`);
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  const [regModalOpen, setRegModalOpen] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [registering, setRegistering] = useState(false);
  const [regError, setRegError] = useState(null);
  const [regSuccess, setRegSuccess] = useState(null);

  const handleOpenRegister = () => {
    const token = localStorage.getItem('userToken');
    if (!token) {
      window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
      return;
    }
    setTeamName('');
    setRegError(null);
    setRegSuccess(null);
    setRegModalOpen(true);
  };

  const handleRegisterTeam = async (e) => {
    e.preventDefault();
    if (!teamName.trim()) {
      setRegError('Please enter a team name.');
      return;
    }

    setRegistering(true);
    setRegError(null);

    try {
      const res = await apiPost(`/tournaments/${tournament.id}/register`, {
        team_name: teamName.trim(),
      });

      if (!res.requires_payment) {
        setRegSuccess('Your team has been registered successfully!');
        const teamsRes = await apiGet(`/tournaments/${tournament.id}/teams`);
        if (teamsRes.success) setTeams(teamsRes.teams || []);
        setTimeout(() => setRegModalOpen(false), 2000);
        return;
      }

      setRegSuccess('Your team registration request was submitted.');
      const teamsRes = await apiGet(`/tournaments/${tournament.id}/teams`);
      if (teamsRes.success) setTeams(teamsRes.teams || []);
      setTimeout(() => setRegModalOpen(false), 2000);
    } catch (err) {
      console.error('Registration error:', err);
      if (err.message === 'PAYMENT_DISMISSED') {
        setRegError('Payment cancelled. Your team was not registered.');
      } else {
        setRegError(err?.response?.data?.error || err.message || 'Failed to register team.');
      }
    } finally {
      setRegistering(false);
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

  if (!tournament) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col">
        <Navbar />
        <div className="flex-grow flex flex-col items-center justify-center p-8 text-center">
          <Trophy className="w-16 h-16 text-slate-600 mb-4" />
          <h2 className="text-2xl font-bold text-slate-300">Tournament Not Found</h2>
          <p className="text-slate-400 mt-2">The tournament you are looking for does not exist or has been removed.</p>
          <Link to="/tournaments" className="mt-6 px-6 py-2.5 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-500">
            Browse All Tournaments
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  const liveMatches = fixtures.filter(f => f.status === 'LIVE');

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-white">
      <Navbar />

      {/* Tournament Header Banner */}
      <div className="relative bg-gradient-to-r from-slate-950 via-slate-900 to-emerald-950 border-b border-slate-800">
        {tournament.banner && (
          <div className="absolute inset-0 opacity-20">
            <img src={tournament.banner} alt={tournament.name} className="w-full h-full object-cover" />
          </div>
        )}

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              {tournament.logo ? (
                <img src={tournament.logo} alt={tournament.name} className="w-20 h-20 rounded-2xl object-cover border-2 border-emerald-500/40 shadow-xl" />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-800 flex items-center justify-center border-2 border-emerald-500/40 shadow-xl">
                  <Trophy className="w-10 h-10 text-white" />
                </div>
              )}

              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold">
                    {tournament.sport}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 text-xs font-medium">
                    {tournament.status.replace('_', ' ')}
                  </span>
                </div>

                <h1 className="text-2xl sm:text-3xl font-extrabold text-white">{tournament.name}</h1>

                <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-slate-300">
                  <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-emerald-400" /> {tournament.venue}, {tournament.location}</span>
                  <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-emerald-400" /> {new Date(tournament.start_date).toLocaleDateString()} - {new Date(tournament.end_date).toLocaleDateString()}</span>
                  <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-emerald-400" /> Host: {tournament.host_name || 'Organizers'}</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 w-full md:w-auto">
              <button onClick={handleShare} className="flex-1 md:flex-none px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 border border-slate-700">
                <Share2 className="w-4 h-4 text-emerald-400" /> {copied ? 'Copied Link!' : 'Share'}
              </button>

              <button onClick={handleWhatsAppShare} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-2">
                WhatsApp
              </button>

              {tournament.status === 'REGISTRATION_OPEN' && (
                <button
                  type="button"
                  onClick={handleOpenRegister}
                  className="flex-1 md:flex-none px-6 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-bold rounded-lg text-xs shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-1.5 transition-all hover:scale-105"
                >
                  <Trophy className="w-3.5 h-3.5" /> Register Team
                </button>
              )}

              {tournament.join_token && tournament.join_link_active && tournament.status === 'REGISTRATION_OPEN' && (
                <Link to={`/tournaments/join/${tournament.join_token}`} className="flex-1 md:flex-none px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-lg text-xs border border-slate-700 flex items-center justify-center gap-1.5">
                  Join via Link
                </Link>
              )}
            </div>
          </div>

          {/* Live Bar Banner if match is live */}
          {liveMatches.length > 0 && (
            <div className="mt-8 bg-red-950/80 border border-red-800/80 p-4 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 rounded-full bg-red-500 animate-ping" />
                <span className="font-extrabold text-red-200 text-sm">🔴 LIVE MATCH IN PROGRESS</span>
              </div>
              <Link to={`/tournaments/${tournament.slug}/matches/${liveMatches[0].id}/live`} className="px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-lg flex items-center gap-1">
                Open Live Center &rarr;
              </Link>
            </div>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-slate-800/80">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-3">
            {[
              { id: 'overview', label: 'Overview' },
              { id: 'teams', label: `Teams (${teams.length})` },
              { id: 'fixtures', label: `Fixtures (${fixtures.length})` },
              { id: 'standings', label: 'Standings' },
              { id: 'stats', label: 'Leaderboard' },
              { id: 'announcements', label: `Announcements (${announcements.length})` },
            ].map((tb) => (
              <button
                key={tb.id}
                onClick={() => setActiveTab(tb.id)}
                className={`px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                  activeTab === tb.id
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                {tb.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-2xl">
                <h3 className="text-lg font-bold text-white mb-3">About Tournament</h3>
                <p className="text-slate-300 text-sm whitespace-pre-line leading-relaxed">
                  {tournament.description || 'No detailed description provided.'}
                </p>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-2xl">
                <h3 className="text-lg font-bold text-white mb-4">Tournament Format & Rules</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <p className="text-slate-400">Format</p>
                    <p className="font-bold text-white text-sm mt-0.5">{tournament.format_type}</p>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <p className="text-slate-400">Match Duration</p>
                    <p className="font-bold text-white text-sm mt-0.5">{tournament.match_duration || 60} mins</p>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <p className="text-slate-400">Points for Win</p>
                    <p className="font-bold text-emerald-400 text-sm mt-0.5">+{tournament.points_for_win || 3}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-2xl">
                <h3 className="text-sm font-bold text-slate-300 mb-4">Quick Facts</h3>
                <div className="space-y-3 text-xs">
                  <div className="flex justify-between py-2 border-b border-slate-800">
                    <span className="text-slate-400">Prize Pool</span>
                    <span className="font-bold text-emerald-400">₹{Number(tournament.prize_pool_amount || 0).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-800">
                    <span className="text-slate-400">Total Teams</span>
                    <span className="font-bold text-white">{teams.length} / {tournament.max_teams || '∞'}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-800">
                    <span className="text-slate-400">Visibility</span>
                    <span className="font-bold text-slate-300">{tournament.visibility}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TEAMS TAB */}
        {activeTab === 'teams' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {teams.length === 0 ? (
              <p className="text-slate-400 text-sm col-span-full py-8 text-center">No teams registered yet.</p>
            ) : (
              teams.map((tm) => (
                <div key={tm.id} className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 flex items-center gap-4">
                  {tm.logo ? (
                    <img src={tm.logo} alt={tm.name} className="w-12 h-12 rounded-xl object-cover border border-slate-700" />
                  ) : (
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg text-white" style={{ backgroundColor: tm.color || '#3B82F6' }}>
                      {tm.name.substring(0, 2).toUpperCase()}
                    </div>
                  )}

                  <div>
                    <h4 className="font-bold text-white text-base">{tm.name}</h4>
                    <p className="text-xs text-slate-400 mt-0.5">Captain: {tm.captain_name || 'N/A'}</p>
                    <p className="text-xs text-emerald-400 font-semibold mt-1">{tm.player_count || 0} Players</p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* FIXTURES TAB */}
        {activeTab === 'fixtures' && (
          <div className="space-y-4">
            {fixtures.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-8">No match fixtures generated yet.</p>
            ) : (
              fixtures.map((fx) => (
                <div key={fx.id} className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-xs text-slate-400">
                    <span className="font-semibold text-emerald-400">{fx.stage}</span>
                    {fx.group_name && <span> &bull; {fx.group_name}</span>}
                    {fx.match_date && <p className="text-slate-500 mt-0.5">{new Date(fx.match_date).toLocaleDateString()} {fx.match_time || ''}</p>}
                  </div>

                  {/* Teams & Score */}
                  <div className="flex items-center gap-6 text-sm font-bold">
                    <span className="text-right w-32 truncate">{fx.team_a_name || 'TBD'}</span>
                    <div className="px-3 py-1 bg-slate-950 rounded-lg border border-slate-800 text-emerald-400">
                      {fx.team_a_score} - {fx.team_b_score}
                    </div>
                    <span className="text-left w-32 truncate">{fx.team_b_name || 'TBD'}</span>
                  </div>

                  <div>
                    {fx.status === 'LIVE' ? (
                      <Link to={`/tournaments/${tournament.slug}/matches/${fx.id}/live`} className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-lg">
                        Watch Live &rarr;
                      </Link>
                    ) : (
                      <span className="text-xs px-2.5 py-1 bg-slate-800 text-slate-300 rounded-md">
                        {fx.status}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* STANDINGS TAB */}
        {activeTab === 'standings' && (
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase font-semibold border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">#</th>
                    <th className="py-3 px-4">Team</th>
                    <th className="py-3 px-4 text-center">P</th>
                    <th className="py-3 px-4 text-center">W</th>
                    <th className="py-3 px-4 text-center">D</th>
                    <th className="py-3 px-4 text-center">L</th>
                    <th className="py-3 px-4 text-center">GD</th>
                    <th className="py-3 px-4 text-center font-bold text-emerald-400">PTS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {standings.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="py-8 text-center text-slate-500">No standings data available.</td>
                    </tr>
                  ) : (
                    standings.map((st) => (
                      <tr key={st.team_id} className="hover:bg-slate-800/40">
                        <td className="py-3 px-4 font-bold text-slate-400">{st.rank}</td>
                        <td className="py-3 px-4 font-semibold text-white">{st.team_name}</td>
                        <td className="py-3 px-4 text-center">{st.played}</td>
                        <td className="py-3 px-4 text-center text-emerald-400 font-semibold">{st.won}</td>
                        <td className="py-3 px-4 text-center">{st.draw}</td>
                        <td className="py-3 px-4 text-center text-red-400">{st.lost}</td>
                        <td className="py-3 px-4 text-center">{st.goal_diff > 0 ? `+${st.goal_diff}` : st.goal_diff}</td>
                        <td className="py-3 px-4 text-center font-extrabold text-emerald-400 text-sm">{st.points}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* LEADERBOARD TAB */}
        {activeTab === 'stats' && stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-2xl">
              <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-400" /> Top Scorers / Points
              </h3>
              <div className="space-y-3">
                {stats.topScorers?.length === 0 ? (
                  <p className="text-xs text-slate-500">No scorer stats recorded yet.</p>
                ) : (
                  stats.topScorers?.map((sc, idx) => (
                    <div key={sc.participant_id || idx} className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-800">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-amber-400 text-sm">#{idx + 1}</span>
                        <Link to={`/players/${sc.user_id}`} className="font-semibold text-white hover:text-emerald-400 text-xs">
                          {sc.player_name}
                        </Link>
                      </div>
                      <span className="font-extrabold text-emerald-400 text-sm">{sc.total_score} Pts</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* ANNOUNCEMENTS TAB */}
        {activeTab === 'announcements' && (
          <div className="space-y-4">
            {announcements.length === 0 ? (
              <p className="text-slate-500 text-xs text-center py-8">No announcements published yet.</p>
            ) : (
              announcements.map((an) => (
                <div key={an.id} className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl">
                  <div className="flex items-center gap-2 text-xs text-emerald-400 font-semibold mb-1">
                    <Megaphone className="w-4 h-4" /> {new Date(an.created_at).toLocaleDateString()}
                  </div>
                  <h4 className="font-bold text-white text-base mb-2">{an.title}</h4>
                  <p className="text-slate-300 text-xs leading-relaxed">{an.content}</p>
                </div>
              ))
            )}
          </div>
        )}
        {/* Registration Modal */}
        {regModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl relative">
              <button
                type="button"
                onClick={() => setRegModalOpen(false)}
                className="absolute top-5 right-5 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                  <Trophy className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Register for Tournament</h3>
                  <p className="text-xs text-slate-400">{tournament.name}</p>
                </div>
              </div>

              {regError && (
                <div className="mb-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{regError}</span>
                </div>
              )}

              {regSuccess && (
                <div className="mb-4 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  <span>{regSuccess}</span>
                </div>
              )}

              <form onSubmit={handleRegisterTeam} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Team Name <span className="text-rose-400">*</span></label>
                  <input
                    type="text"
                    required
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    placeholder="e.g. Royal Strikers FC"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1.5">
                  <div className="flex justify-between text-slate-400">
                    <span>Prize Pool:</span>
                    <span className="font-bold text-emerald-400">
                      ₹{Number(tournament.prize_pool_amount || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Current Capacity:</span>
                    <span className="text-white font-medium">{teams.length} / {tournament.max_teams || '∞'} Teams</span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={registering}
                  className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-950 flex items-center justify-center gap-2 transition-all"
                >
                  {registering ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Registering...
                    </>
                  ) : (
                    <>
                      {'Confirm Team Registration'}
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
