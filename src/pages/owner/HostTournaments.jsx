import { useState, useEffect } from 'react';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api';
import {
  Trophy, Plus, Calendar, MapPin, Users, Shield, Radio, Play, Pause, Square,
  RotateCcw, Trash2, Edit, CheckCircle, XCircle, Clock, Copy, Link as LinkIcon, Lock, Unlock, Megaphone, Video
} from 'lucide-react';

export default function HostTournaments({ owner }) {
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Active Selected Tournament View
  const [selectedTournament, setSelectedTournament] = useState(null);
  const [activeTab, setActiveTab] = useState('overview'); // overview, participants, teams, fixtures, live_control, announcements, stream

  // Create Tournament Wizard State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [createForm, setCreateForm] = useState({
    name: '', sport: 'Football', banner: '', logo: '', description: '', venue: '', location: '',
    start_date: '', end_date: '', reg_open_date: '', reg_close_date: '', max_teams: 16, max_players: 20, max_participants: 200, entry_fee: 0,
    visibility: 'PUBLIC', format_type: 'Knockout', participation_type: 'TEAM',
    allow_user_teams: true, allow_user_join_team: true, players_per_team: 11, substitute_limit: 5,
    match_duration: 60, break_duration: 15, points_for_win: 3, points_for_draw: 1, points_for_loss: 0,
    tie_breaker_rules: 'head_to_head,goal_diff,goals_scored', number_of_groups: 2, qualification_rules: 'top_2_per_group',
    joining_link_active: true, host_approval_required: true
  });
  const [createLoading, setCreateLoading] = useState(false);

  // Sub-data state
  const [participants, setParticipants] = useState([]);
  const [teams, setTeams] = useState([]);
  const [fixtures, setFixtures] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [activeLiveMatch, setActiveLiveMatch] = useState(null);
  const [matchEvents, setMatchEvents] = useState([]);

  // Form modals state
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [teamForm, setTeamForm] = useState({ name: '', logo: '', color: '#10B981', max_players: 15, description: '' });
  const [showStreamModal, setShowStreamModal] = useState(false);
  const [streamForm, setStreamForm] = useState({ match_id: '', youtube_url: '', stream_title: '' });
  const [showAnnounceModal, setShowAnnounceModal] = useState(false);
  const [announceForm, setAnnounceForm] = useState({ title: '', content: '' });

  const loadHostTournaments = async () => {
    setLoading(true);
    try {
      const res = await apiGet('/tournaments/host/mine');
      if (res.success) setTournaments(res.tournaments || []);
    } catch (err) {
      console.error('Error fetching host tournaments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHostTournaments();
  }, []);

  // Fetch Sub-data when a tournament is selected
  useEffect(() => {
    if (!selectedTournament) return;
    const fetchSubData = async () => {
      try {
        const [pRes, tRes, fRes, aRes] = await Promise.all([
          apiGet(`/tournaments/${selectedTournament.id}/participants`),
          apiGet(`/tournaments/${selectedTournament.id}/teams`),
          apiGet(`/tournaments/${selectedTournament.id}/fixtures`),
          apiGet(`/tournaments/${selectedTournament.id}/announcements`)
        ]);
        if (pRes.success) setParticipants(pRes.participants || []);
        if (tRes.success) setTeams(tRes.teams || []);
        if (fRes.success) setFixtures(fRes.fixtures || []);
        if (aRes.success) setAnnouncements(aRes.announcements || []);
      } catch (err) {
        console.error('Error loading sub-data:', err);
      }
    };

    fetchSubData();
  }, [selectedTournament, activeTab]);

  // Create Tournament Handler
  const handleCreateTournament = async (e) => {
    e.preventDefault();
    setCreateLoading(true);
    try {
      const res = await apiPost('/tournaments', createForm);
      if (res.success) {
        setShowCreateModal(false);
        setWizardStep(1);
        loadHostTournaments();
      } else {
        alert(res.error || 'Failed to create tournament');
      }
    } catch (err) {
      alert(err.message || 'Error creating tournament');
    } finally {
      setCreateLoading(false);
    }
  };

  // Participant Approval / Rejection
  const handleUpdateParticipant = async (participantId, status, teamId = null) => {
    try {
      const res = await apiPatch(`/tournaments/${selectedTournament.id}/participants/${participantId}`, {
        status,
        team_id: teamId
      });
      if (res.success) {
        const pRes = await apiGet(`/tournaments/${selectedTournament.id}/participants`);
        if (pRes.success) setParticipants(pRes.participants || []);
      } else {
        alert(res.error || 'Action failed');
      }
    } catch (err) {
      alert(err.message || 'Error updating participant');
    }
  };

  // Create Team
  const handleCreateTeam = async (e) => {
    e.preventDefault();
    try {
      const res = await apiPost(`/tournaments/${selectedTournament.id}/teams`, teamForm);
      if (res.success) {
        setShowTeamModal(false);
        const tRes = await apiGet(`/tournaments/${selectedTournament.id}/teams`);
        if (tRes.success) setTeams(tRes.teams || []);
      } else {
        alert(res.error || 'Failed to create team');
      }
    } catch (err) {
      alert(err.message || 'Error creating team');
    }
  };

  // Auto Generate Fixtures
  const handleGenerateFixtures = async () => {
    if (!window.confirm('Generate fixtures automatically for this tournament?')) return;
    try {
      const res = await apiPost(`/tournaments/${selectedTournament.id}/fixtures/generate`, {});
      if (res.success) {
        alert(res.message);
        const fRes = await apiGet(`/tournaments/${selectedTournament.id}/fixtures`);
        if (fRes.success) setFixtures(fRes.fixtures || []);
      } else {
        alert(res.error || 'Failed to generate fixtures');
      }
    } catch (err) {
      alert(err.message || 'Error generating fixtures');
    }
  };

  // Open Scoreboard Control for a match
  const handleOpenScoreboardControl = async (match) => {
    setActiveLiveMatch(match);
    setActiveTab('live_control');
    try {
      const res = await apiGet(`/tournament-matches/${match.id}/live`);
      if (res.success) {
        setMatchEvents(res.events || []);
      }
    } catch (e) {}
  };

  // Record Score Event
  const handleRecordEvent = async (eventType, teamId, value = 0, metadata = null) => {
    if (!activeLiveMatch) return;
    try {
      const res = await apiPost(`/tournament-matches/${activeLiveMatch.id}/events`, {
        event_type: eventType,
        team_id: teamId,
        value,
        metadata,
        client_event_id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`
      });
      if (res.success) {
        setActiveLiveMatch(prev => ({
          ...prev,
          team_a_score: res.team_a_score,
          team_b_score: res.team_b_score
        }));
        const lRes = await apiGet(`/tournament-matches/${activeLiveMatch.id}/live`);
        if (lRes.success) setMatchEvents(lRes.events || []);
      }
    } catch (e) {
      alert('Failed to log event');
    }
  };

  // Undo Score Event
  const handleUndoEvent = async (eventId) => {
    if (!activeLiveMatch) return;
    try {
      const res = await apiDelete(`/tournament-matches/${activeLiveMatch.id}/events/${eventId}`);
      if (res.success) {
        setActiveLiveMatch(prev => ({
          ...prev,
          team_a_score: res.team_a_score,
          team_b_score: res.team_b_score
        }));
        const lRes = await apiGet(`/tournament-matches/${activeLiveMatch.id}/live`);
        if (lRes.success) setMatchEvents(lRes.events || []);
      }
    } catch (e) {
      alert('Failed to undo event');
    }
  };

  // Match Status Control
  const handleUpdateMatchStatus = async (status) => {
    if (!activeLiveMatch) return;
    try {
      const res = await apiPost(`/tournament-matches/${activeLiveMatch.id}/status`, { status });
      if (res.success) {
        setActiveLiveMatch(prev => ({ ...prev, status }));
        alert(`Match status updated to ${status}`);
      }
    } catch (e) {
      alert('Failed to update status');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/80 p-6 rounded-2xl border border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Trophy className="w-5 h-5 text-emerald-400" /> Host Tournament Dashboard
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Create, publish, and manage sports tournaments, teams, fixtures, and live scoreboards.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-bold rounded-xl text-xs shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" /> Create Tournament
        </button>
      </div>

      {/* Main Container */}
      {!selectedTournament ? (
        /* Tournament List Grid */
        loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">Loading your tournaments...</div>
        ) : tournaments.length === 0 ? (
          <div className="p-12 text-center bg-slate-900/40 border border-slate-800 rounded-2xl">
            <Trophy className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-300">No Tournaments Created Yet</h3>
            <p className="text-xs text-slate-500 mt-1">Click Create Tournament to build your first sports championship.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tournaments.map((t) => (
              <div
                key={t.id}
                onClick={() => setSelectedTournament(t)}
                className="cursor-pointer bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-emerald-500/50 rounded-2xl p-5 transition-all space-y-4"
              >
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold border border-emerald-500/30">
                    {t.sport}
                  </span>
                  <span className="text-xs text-slate-400 font-semibold">{t.status}</span>
                </div>

                <div>
                  <h3 className="font-bold text-white text-lg">{t.name}</h3>
                  <p className="text-xs text-slate-400 mt-1">{t.venue}, {t.location}</p>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-800 text-center text-xs">
                  <div>
                    <p className="text-slate-500">Teams</p>
                    <p className="font-bold text-white">{t.teams_count || 0}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Players</p>
                    <p className="font-bold text-white">{t.approved_participants_count || 0}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Pending</p>
                    <p className="font-bold text-amber-400">{t.pending_requests_count || 0}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        /* Selected Tournament Details & Controls */
        <div className="space-y-6">
          {/* Breadcrumb & Navigation */}
          <div className="flex items-center justify-between bg-slate-900/60 p-4 rounded-xl border border-slate-800">
            <button onClick={() => setSelectedTournament(null)} className="text-xs font-bold text-slate-400 hover:text-white flex items-center gap-1">
              &larr; Back to All Tournaments
            </button>
            <h3 className="text-sm font-bold text-emerald-400">{selectedTournament.name}</h3>
          </div>

          {/* Sub Navigation Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            {[
              { id: 'overview', label: 'Overview' },
              { id: 'participants', label: `Participants (${participants.length})` },
              { id: 'teams', label: `Teams (${teams.length})` },
              { id: 'fixtures', label: `Fixtures (${fixtures.length})` },
              { id: 'announcements', label: 'Announcements' },
            ].map(tb => (
              <button
                key={tb.id}
                onClick={() => setActiveTab(tb.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  activeTab === tb.id ? 'bg-emerald-600 text-white shadow-lg' : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
                }`}
              >
                {tb.label}
              </button>
            ))}
          </div>

          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-2xl space-y-4">
              <h4 className="text-base font-bold text-white">Tournament Overview</h4>
              <p className="text-xs text-slate-300">Public Joining Link: <strong className="text-emerald-400">/tournaments/join/{selectedTournament.join_token}</strong></p>
            </div>
          )}

          {/* TAB 2: PARTICIPANTS */}
          {activeTab === 'participants' && (
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden p-4">
              <h4 className="text-sm font-bold text-white mb-4">Participant Requests</h4>
              <div className="space-y-3">
                {participants.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-6">No participants registered yet.</p>
                ) : (
                  participants.map(p => (
                    <div key={p.id} className="flex items-center justify-between p-3.5 bg-slate-950 rounded-xl border border-slate-800 text-xs">
                      <div>
                        <span className="font-bold text-white text-sm">{p.user_name || p.player_name}</span>
                        <p className="text-slate-400 text-xs">Jersey #{p.jersey_number || 'N/A'} &bull; {p.position || 'Player'}</p>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 font-semibold">{p.status}</span>
                        {p.status === 'PENDING' && (
                          <>
                            <button onClick={() => handleUpdateParticipant(p.id, 'APPROVED')} className="px-3 py-1 bg-emerald-600 text-white font-bold rounded">Approve</button>
                            <button onClick={() => handleUpdateParticipant(p.id, 'REJECTED')} className="px-3 py-1 bg-red-600 text-white font-bold rounded">Reject</button>
                          </>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 3: TEAMS */}
          {activeTab === 'teams' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="text-sm font-bold text-white">Registered Teams</h4>
                <button onClick={() => setShowTeamModal(true)} className="px-4 py-2 bg-emerald-600 text-white font-bold rounded-lg text-xs">+ Create Team</button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {teams.map(tm => (
                  <div key={tm.id} className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-white text-sm" style={{ backgroundColor: tm.color || '#10B981' }}>
                      {tm.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h5 className="font-bold text-white text-sm">{tm.name}</h5>
                      <p className="text-xs text-slate-400">{tm.player_count || 0} Players</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: FIXTURES */}
          {activeTab === 'fixtures' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="text-sm font-bold text-white">Fixtures Schedule</h4>
                <button onClick={handleGenerateFixtures} className="px-4 py-2 bg-emerald-600 text-white font-bold rounded-lg text-xs">Auto Generate Fixtures</button>
              </div>

              <div className="space-y-3">
                {fixtures.map(fx => (
                  <div key={fx.id} className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-emerald-400">{fx.stage}</span>
                      <p className="text-white font-semibold text-sm mt-0.5">{fx.team_a_name || 'TBD'} vs {fx.team_b_name || 'TBD'}</p>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="px-3 py-1 bg-slate-950 text-emerald-400 font-bold rounded-lg text-sm">{fx.team_a_score} - {fx.team_b_score}</span>
                      <button onClick={() => handleOpenScoreboardControl(fx)} className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg flex items-center gap-1">
                        <Radio className="w-3.5 h-3.5" /> Scoreboard Control
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: HOST SCOREBOARD CONTROL PANEL */}
          {activeTab === 'live_control' && activeLiveMatch && (
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <h4 className="text-lg font-bold text-white flex items-center gap-2">
                  <Radio className="w-5 h-5 text-red-500 animate-pulse" /> Scoreboard Control — {activeLiveMatch.team_a_name || 'Team A'} vs {activeLiveMatch.team_b_name || 'Team B'}
                </h4>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleUpdateMatchStatus('LIVE')} className="px-3 py-1 bg-red-600 text-white font-bold text-xs rounded">START</button>
                  <button onClick={() => handleUpdateMatchStatus('PAUSED')} className="px-3 py-1 bg-amber-600 text-white font-bold text-xs rounded">PAUSE</button>
                  <button onClick={() => handleUpdateMatchStatus('FINISHED')} className="px-3 py-1 bg-emerald-600 text-white font-bold text-xs rounded">FINISH</button>
                </div>
              </div>

              {/* Large Score Increment Controls (Mobile First) */}
              <div className="grid grid-cols-2 gap-6">
                {/* Team A Score Controls */}
                <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 text-center space-y-4">
                  <h5 className="font-extrabold text-white text-base truncate">{activeLiveMatch.team_a_name || 'Team A'}</h5>
                  <p className="text-5xl font-black text-emerald-400">{activeLiveMatch.team_a_score}</p>
                  <div className="grid grid-cols-3 gap-2">
                    <button onClick={() => handleRecordEvent('SCORE', activeLiveMatch.team_a_id, 1)} className="py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-base shadow">+1</button>
                    <button onClick={() => handleRecordEvent('SCORE', activeLiveMatch.team_a_id, 2)} className="py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-base shadow">+2</button>
                    <button onClick={() => handleRecordEvent('SCORE', activeLiveMatch.team_a_id, 3)} className="py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-base shadow">+3</button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <button onClick={() => handleRecordEvent('GOAL', activeLiveMatch.team_a_id, 1)} className="py-2 bg-slate-800 text-slate-200 font-bold rounded-lg">Goal</button>
                    <button onClick={() => handleRecordEvent('CARD', activeLiveMatch.team_a_id, 0, { card: 'yellow' })} className="py-2 bg-amber-600 text-white font-bold rounded-lg">Yellow Card</button>
                  </div>
                </div>

                {/* Team B Score Controls */}
                <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 text-center space-y-4">
                  <h5 className="font-extrabold text-white text-base truncate">{activeLiveMatch.team_b_name || 'Team B'}</h5>
                  <p className="text-5xl font-black text-emerald-400">{activeLiveMatch.team_b_score}</p>
                  <div className="grid grid-cols-3 gap-2">
                    <button onClick={() => handleRecordEvent('SCORE', activeLiveMatch.team_b_id, 1)} className="py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-base shadow">+1</button>
                    <button onClick={() => handleRecordEvent('SCORE', activeLiveMatch.team_b_id, 2)} className="py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-base shadow">+2</button>
                    <button onClick={() => handleRecordEvent('SCORE', activeLiveMatch.team_b_id, 3)} className="py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-base shadow">+3</button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <button onClick={() => handleRecordEvent('GOAL', activeLiveMatch.team_b_id, 1)} className="py-2 bg-slate-800 text-slate-200 font-bold rounded-lg">Goal</button>
                    <button onClick={() => handleRecordEvent('CARD', activeLiveMatch.team_b_id, 0, { card: 'yellow' })} className="py-2 bg-amber-600 text-white font-bold rounded-lg">Yellow Card</button>
                  </div>
                </div>
              </div>

              {/* Event Log with Undo Action */}
              <div className="space-y-3 pt-4 border-t border-slate-800">
                <h5 className="font-bold text-white text-xs">Recent Match Events</h5>
                {matchEvents.filter(ev => !ev.is_undone).slice(0, 5).map(ev => (
                  <div key={ev.id} className="flex items-center justify-between p-3 bg-slate-950 rounded-xl text-xs border border-slate-800">
                    <div>
                      <span className="font-bold text-white">{ev.event_type}</span>
                      {ev.team_name && <span className="text-emerald-400 ml-2">({ev.team_name})</span>}
                    </div>
                    <button onClick={() => handleUndoEvent(ev.id)} className="px-2.5 py-1 bg-slate-800 hover:bg-red-600 text-slate-300 hover:text-white rounded font-bold">
                      Undo
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* CREATE TOURNAMENT MULTI-STEP MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white">Create Tournament — Step {wizardStep} of 3</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white">&times;</button>
            </div>

            <form onSubmit={handleCreateTournament} className="space-y-4 text-xs">
              {wizardStep === 1 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Tournament Name *</label>
                    <input
                      type="text"
                      required
                      value={createForm.name}
                      onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                      placeholder="e.g. Vellore Champions Trophy 2026"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">Sport *</label>
                      <select
                        value={createForm.sport}
                        onChange={(e) => setCreateForm({ ...createForm, sport: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white"
                      >
                        {['Football', 'Cricket', 'Badminton', 'Basketball', 'Volleyball', 'Tennis', 'Table Tennis'].map(sp => (
                          <option key={sp} value={sp}>{sp}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">Visibility</label>
                      <select
                        value={createForm.visibility}
                        onChange={(e) => setCreateForm({ ...createForm, visibility: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white"
                      >
                        <option value="PUBLIC">PUBLIC</option>
                        <option value="PRIVATE">PRIVATE</option>
                        <option value="LINK_ONLY">LINK ONLY</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">Venue *</label>
                      <input
                        type="text"
                        required
                        value={createForm.venue}
                        onChange={(e) => setCreateForm({ ...createForm, venue: e.target.value })}
                        placeholder="e.g. Arena Turf 1"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">Location *</label>
                      <input
                        type="text"
                        required
                        value={createForm.location}
                        onChange={(e) => setCreateForm({ ...createForm, location: e.target.value })}
                        placeholder="e.g. Vellore"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">Start Date *</label>
                      <input
                        type="date"
                        required
                        value={createForm.start_date}
                        onChange={(e) => setCreateForm({ ...createForm, start_date: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">End Date *</label>
                      <input
                        type="date"
                        required
                        value={createForm.end_date}
                        onChange={(e) => setCreateForm({ ...createForm, end_date: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              {wizardStep === 2 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Format Type</label>
                    <select
                      value={createForm.format_type}
                      onChange={(e) => setCreateForm({ ...createForm, format_type: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white"
                    >
                      <option value="Knockout">Knockout</option>
                      <option value="Round Robin">Round Robin / League</option>
                      <option value="Group Stage + Knockout">Group Stage + Knockout</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">Points Win</label>
                      <input type="number" value={createForm.points_for_win} onChange={(e) => setCreateForm({ ...createForm, points_for_win: parseInt(e.target.value) || 3 })} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white" />
                    </div>
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">Points Draw</label>
                      <input type="number" value={createForm.points_for_draw} onChange={(e) => setCreateForm({ ...createForm, points_for_draw: parseInt(e.target.value) || 1 })} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white" />
                    </div>
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">Points Loss</label>
                      <input type="number" value={createForm.points_for_loss} onChange={(e) => setCreateForm({ ...createForm, points_for_loss: parseInt(e.target.value) || 0 })} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white" />
                    </div>
                  </div>
                </div>
              )}

              {wizardStep === 3 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">Max Teams</label>
                      <input type="number" value={createForm.max_teams} onChange={(e) => setCreateForm({ ...createForm, max_teams: parseInt(e.target.value) || 16 })} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white" />
                    </div>
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">Entry Fee (₹)</label>
                      <input type="number" value={createForm.entry_fee} onChange={(e) => setCreateForm({ ...createForm, entry_fee: parseFloat(e.target.value) || 0 })} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Description</label>
                    <textarea rows="3" value={createForm.description} onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white" />
                  </div>
                </div>
              )}

              {/* Wizard Nav */}
              <div className="flex justify-between pt-4 border-t border-slate-800">
                {wizardStep > 1 ? (
                  <button type="button" onClick={() => setWizardStep(wizardStep - 1)} className="px-4 py-2 bg-slate-800 text-white rounded-lg">Back</button>
                ) : <div />}

                {wizardStep < 3 ? (
                  <button type="button" onClick={() => setWizardStep(wizardStep + 1)} className="px-5 py-2 bg-emerald-600 text-white font-bold rounded-lg">Next &rarr;</button>
                ) : (
                  <button type="submit" disabled={createLoading} className="px-6 py-2 bg-emerald-600 text-white font-bold rounded-lg">{createLoading ? 'Publishing...' : 'Publish Tournament'}</button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE TEAM MODAL */}
      {showTeamModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-white">Create Team</h3>
            <form onSubmit={handleCreateTeam} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Team Name *</label>
                <input type="text" required value={teamForm.name} onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowTeamModal(false)} className="px-4 py-2 bg-slate-800 text-white rounded-lg">Cancel</button>
                <button type="submit" className="px-5 py-2 bg-emerald-600 text-white font-bold rounded-lg">Save Team</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
