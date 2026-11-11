import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { apiGet } from '@/lib/api';
import { setPageMeta } from '@/lib/seo';
import { Trophy, Radio, Clock, Shield, Award, Activity, ArrowLeft, Target, Users } from 'lucide-react';

export default function LiveMatchCenter() {
  const { slug, matchId } = useParams();
  const [matchData, setMatchData] = useState(null);
  const [stats, setStats] = useState(null);
  const [cricket, setCricket] = useState(null);
  const [clock, setClock] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const fetchLiveMatchData = async () => {
    try {
      const res = await apiGet(`/tournament-matches/${matchId}/live`);
      if (res.success) {
        setMatchData(res.match);
        setStats(res.stats || null);
        setCricket(res.cricket || null);
        setClock(res.clock || null);
        setEvents(res.events || []);
        setLastUpdated(new Date());
      }
    } catch (err) {
      console.error('Error fetching live match center:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveMatchData();

    // Setup SSE stream for realtime updates
    let es;
    try {
      es = new EventSource(`/api/tournament-matches/${matchId}/stream`);
      es.onmessage = () => fetchLiveMatchData();
      es.addEventListener('tournament_event', () => fetchLiveMatchData());
      es.addEventListener('tournament_event_undo', () => fetchLiveMatchData());
      es.addEventListener('tournament_status_change', () => fetchLiveMatchData());
      es.onerror = () => {
        // Fallback polling will handle if stream drops
      };
    } catch (e) {
      console.warn('SSE connection failed, falling back to interval:', e);
    }

    // Safety polling fallback every 5s
    const interval = setInterval(fetchLiveMatchData, 5000);
    return () => {
      clearInterval(interval);
      if (es) es.close();
    };
  }, [matchId]);

  useEffect(() => {
    if (matchData) {
      setPageMeta({
        title: `LIVE: ${matchData.team_a?.name || 'Team A'} vs ${matchData.team_b?.name || 'Team B'} — ${matchData.tournament_name}`,
        description: `Follow live score updates, ball-by-ball events timeline, and YouTube stream for ${matchData.tournament_name}.`
      });
    }
  }, [matchData]);

  // Extract YouTube Video Embed ID
  const getYoutubeEmbedUrl = (url) => {
    if (!url) return null;
    let videoId = null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    if (match && match[2].length === 11) {
      videoId = match[2];
    } else if (url.includes('youtube.com/live/')) {
      const parts = url.split('youtube.com/live/');
      videoId = parts[1]?.split('?')[0];
    }
    return videoId ? `https://www.youtube.com/embed/${videoId}?autoplay=1` : null;
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

  if (!matchData) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col">
        <Navbar />
        <div className="flex-grow flex flex-col items-center justify-center p-8 text-center">
          <Trophy className="w-16 h-16 text-slate-600 mb-4" />
          <h2 className="text-2xl font-bold text-slate-300">Live Match Unavailable</h2>
          <Link to={`/tournaments/${slug}`} className="mt-4 px-6 py-2 bg-emerald-600 text-white font-bold rounded-lg text-xs">
            Back to Tournament Page
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  const embedUrl = getYoutubeEmbedUrl(matchData.youtube_url);
  const isCricket = (stats?.family === 'cricket') || (matchData.sport && matchData.sport.toLowerCase().includes('cricket'));
  const teamAScore = stats?.a?.runs ?? stats?.a?.score ?? matchData.team_a_score ?? 0;
  const teamBScore = stats?.b?.runs ?? stats?.b?.score ?? matchData.team_b_score ?? 0;
  const teamAWickets = stats?.a?.wickets ?? 0;
  const teamBWickets = stats?.b?.wickets ?? 0;
  const teamAOvers = stats?.a?.overs || '0.0';
  const teamBOvers = stats?.b?.overs || '0.0';
  const currentBattingId = matchData.batting_team_id || cricket?.setup?.batting_team_id || stats?.cricket?.current?.batting_team_id;
  const isTeamABatting = matchData.status === 'LIVE' && (!currentBattingId || Number(currentBattingId) === Number(matchData.team_a_id));
  const isTeamBBatting = matchData.status === 'LIVE' && Number(currentBattingId) === Number(matchData.team_b_id);
  const chase = cricket?.chase || stats?.cricket?.chase;

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-white">
      <Navbar />

      {/* Header Bar */}
      <div className="bg-slate-900 border-b border-slate-800 py-3 px-4 sm:px-8 flex items-center justify-between">
        <Link to={`/tournaments/${slug}`} className="inline-flex items-center gap-1.5 text-slate-400 hover:text-white text-xs font-semibold">
          <ArrowLeft className="w-4 h-4" /> Back to {matchData.tournament_name}
        </Link>

        <div className="flex items-center gap-2">
          {matchData.status === 'LIVE' ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-600 text-white text-xs font-extrabold animate-pulse">
              <Radio className="w-3.5 h-3.5" /> LIVE NOW
            </span>
          ) : (
            <span className="px-3 py-1 rounded-full bg-slate-800 text-slate-300 text-xs font-bold">
              {matchData.status}
            </span>
          )}
          <span className="text-xs text-slate-500 hidden sm:inline">
            Updated: {lastUpdated.toLocaleTimeString()}
          </span>
        </div>
      </div>

      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
        {/* Desktop & Mobile Responsive Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT: YouTube Stream (7 cols on desktop) */}
          <div className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col justify-center">
            {embedUrl ? (
              <div className="aspect-video w-full bg-black">
                <iframe
                  src={embedUrl}
                  title="YouTube Live Stream"
                  className="w-full h-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : (
              <div className="aspect-video w-full bg-slate-950 flex flex-col items-center justify-center p-8 text-center border-b border-slate-800">
                <Radio className="w-12 h-12 text-slate-700 mb-3" />
                <p className="text-slate-400 font-semibold text-sm">No Live YouTube Video Stream Configured</p>
                <p className="text-slate-600 text-xs mt-1">Live scores are updating below in real time.</p>
              </div>
            )}
          </div>

          {/* RIGHT: Live Scoreboard Card (5 cols on desktop) */}
          <div className="lg:col-span-5 bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950 border border-slate-800 rounded-2xl p-6 shadow-2xl flex flex-col justify-between">
            <div>
              <div className="text-center border-b border-slate-800/80 pb-4 mb-6">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">{matchData.stage || 'Match'}</span>
                <p className="text-xs text-slate-400 mt-0.5">{matchData.venue || 'Arena Court'}</p>
              </div>

              {/* Main Scoreboard Display */}
              <div className="space-y-4 my-2">
                {/* Team A Row */}
                <div className={`flex items-center justify-between p-3 rounded-xl border transition-all ${isTeamABatting ? 'bg-emerald-950/40 border-emerald-500/50' : 'bg-slate-950/60 border-slate-800'}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center font-bold text-sm text-white overflow-hidden">
                      {matchData.team_a?.logo ? (
                        <img src={matchData.team_a.logo} alt={matchData.team_a.name} className="w-full h-full object-cover" />
                      ) : (
                        matchData.team_a?.name?.substring(0, 2).toUpperCase() || 'A'
                      )}
                    </div>
                    <div>
                      <h3 className="font-extrabold text-white text-sm flex items-center gap-1.5">
                        {matchData.team_a?.name || 'Team A'}
                        {isTeamABatting && <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="Batting" />}
                      </h3>
                      {isCricket && (
                        <p className="text-2xs text-slate-400 font-medium">
                          {teamAOvers} ov {stats?.a?.run_rate ? `· RR ${stats.a.run_rate}` : ''}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-black text-white font-mono">
                      {teamAScore}{isCricket ? <span className="text-base text-slate-400 font-bold">/{teamAWickets}</span> : ''}
                    </span>
                  </div>
                </div>

                {/* Team B Row */}
                <div className={`flex items-center justify-between p-3 rounded-xl border transition-all ${isTeamBBatting ? 'bg-emerald-950/40 border-emerald-500/50' : 'bg-slate-950/60 border-slate-800'}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center font-bold text-sm text-white overflow-hidden">
                      {matchData.team_b?.logo ? (
                        <img src={matchData.team_b.logo} alt={matchData.team_b.name} className="w-full h-full object-cover" />
                      ) : (
                        matchData.team_b?.name?.substring(0, 2).toUpperCase() || 'B'
                      )}
                    </div>
                    <div>
                      <h3 className="font-extrabold text-white text-sm flex items-center gap-1.5">
                        {matchData.team_b?.name || 'Team B'}
                        {isTeamBBatting && <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="Batting" />}
                      </h3>
                      {isCricket && (
                        <p className="text-2xs text-slate-400 font-medium">
                          {teamBOvers} ov {stats?.b?.run_rate ? `· RR ${stats.b.run_rate}` : ''}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-black text-white font-mono">
                      {teamBScore}{isCricket ? <span className="text-base text-slate-400 font-bold">/{teamBWickets}</span> : ''}
                    </span>
                  </div>
                </div>
              </div>

              {/* Target / Chasing Banner */}
              {isCricket && chase && matchData.status === 'LIVE' && (
                <div className="mt-3 p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-center text-xs text-amber-300 font-semibold flex items-center justify-center gap-2">
                  <Target className="w-4 h-4 text-amber-400" />
                  Target: {chase.target} {chase.runs_needed !== null && (
                    <span>· Need <strong className="text-white">{chase.runs_needed}</strong> runs {chase.balls_remaining ? `from ${chase.balls_remaining} balls` : ''}</span>
                  )}
                </div>
              )}

              {/* Cricket Active Batters & Bowler */}
              {isCricket && (cricket?.striker || cricket?.bowler) && (
                <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-2 text-xs">
                  {cricket.striker && (
                    <div className="flex justify-between items-center text-slate-300">
                      <span className="font-semibold text-white flex items-center gap-1">
                        {cricket.striker.name} <span className="text-emerald-400 font-bold">*</span>
                      </span>
                      <span className="font-mono text-2xs text-slate-400">
                        <strong className="text-white font-mono">{cricket.striker.runs || 0}</strong> ({cricket.striker.balls || 0}b, {cricket.striker.fours || 0}x4, {cricket.striker.sixes || 0}x6)
                      </span>
                    </div>
                  )}
                  {cricket.non_striker && (
                    <div className="flex justify-between items-center text-slate-300">
                      <span className="font-semibold text-slate-400">
                        {cricket.non_striker.name}
                      </span>
                      <span className="font-mono text-2xs text-slate-400">
                        <strong className="text-white font-mono">{cricket.non_striker.runs || 0}</strong> ({cricket.non_striker.balls || 0}b)
                      </span>
                    </div>
                  )}
                  {cricket.bowler && (
                    <div className="flex justify-between items-center text-slate-400 pt-1 border-t border-slate-800/40">
                      <span className="font-semibold text-slate-300">
                        Bowl: {cricket.bowler.name}
                      </span>
                      <span className="font-mono text-2xs text-slate-400">
                        {cricket.bowler.overs || '0.0'} ov · {cricket.bowler.wickets || 0}w · {cricket.bowler.runs || 0}r
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Bottom status */}
            <div className="pt-6 border-t border-slate-800/80 text-center text-xs text-slate-400">
              {matchData.status === 'FINISHED' ? (
                <div className="p-3 bg-emerald-950/60 border border-emerald-800 rounded-xl text-emerald-300 font-bold">
                  Winner: {matchData.winner_id === matchData.team_a_id ? matchData.team_a?.name : matchData.winner_id === matchData.team_b_id ? matchData.team_b?.name : 'Draw'}
                </div>
              ) : (
                <p className="flex items-center justify-center gap-1.5 text-2xs text-slate-500">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" /> Realtime score engine synchronized
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Live Match Timeline Events */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6">
          <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-400" /> Live Match Event Timeline
          </h3>

          <div className="space-y-3">
            {events.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-6">No match events logged yet.</p>
            ) : (
              events.map((ev) => (
                <div key={ev.id} className="flex items-center justify-between p-3.5 bg-slate-950 rounded-xl border border-slate-800/80 text-xs">
                  <div className="flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span className={`font-bold ${ev.is_undone ? 'text-slate-500 line-through' : 'text-white'}`}>
                      {ev.is_undone ? `Corrected · ${ev.event_type.replace(/_/g, ' ')}` : ev.event_type.replace(/_/g, ' ')}
                    </span>
                    {ev.player_name && <span className="text-slate-300">&bull; {ev.player_name}</span>}
                    {ev.team_name && <span className="text-emerald-400 font-medium">({ev.team_name})</span>}
                  </div>
                  <span className="text-slate-500 text-2xs">{new Date(ev.timestamp).toLocaleTimeString()}</span>
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
