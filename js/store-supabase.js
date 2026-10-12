// Real store: Supabase (PostgreSQL + phone auth). Same interface as DemoStore.
// Heavy rules (rating, points, bracket, sanctions) run inside the database — see supabase/schema.sql.
import { fairplay, FAIRPLAY_MIN_FOR_TOURNAMENT } from './rating.js';

const toUser = (r) => r && ({
  id: r.id, role: r.role, firstName: r.first_name, lastName: r.last_name, photo: r.photo_url, gender: r.gender,
  birthYear: r.birth_year, district: r.district, years: r.years, selfLevel: r.self_level, hand: r.hand,
  availability: r.availability || [], phone: r.phone, rating: r.rating, matches: r.matches, wins: r.wins,
  form: r.form, league: r.league, pointsQ: r.points_q, pointsY: r.points_y, fpSum: Number(r.fp_sum),
  fpCount: r.fp_count, bannedUntil: r.banned_until, top10Days: r.top10_days, top1Days: r.top1_days,
  coach: r.role === 'coach' ? { verified: r.coach_verified, price: null, specialization: [], worksWith: '', experience: r.years, ...(r.coach || {}) } : null,
  lang: r.lang, createdAt: r.created_at,
});
const fromUser = (p) => {
  const map = { firstName: 'first_name', lastName: 'last_name', photo: 'photo_url', gender: 'gender', birthYear: 'birth_year',
    district: 'district', years: 'years', selfLevel: 'self_level', hand: 'hand', availability: 'availability', lang: 'lang' };
  const out = {};
  for (const [k, v] of Object.entries(p)) {
    if (map[k]) out[map[k]] = v;
    if (k === 'coach' && v) { const { verified, ...rest } = v; out.coach = rest; }
  }
  return out;
};
const toMatch = (r) => ({
  id: r.id, type: r.type, teamA: r.team_a, teamB: r.team_b, sets: r.sets, decider: r.decider, playedAt: r.played_at,
  createdBy: r.created_by, tournamentId: r.tournament_id, round: r.round, status: r.status, winner: r.winner,
  deltas: r.deltas || {}, points: r.points || {}, deadline: r.deadline, expired: r.expired, complained: r.complained,
  disputeReason: r.dispute_reason, createdAt: r.created_at,
});
const toTraining = (r) => ({
  id: r.id, playerId: r.player_id, coachId: r.coach_id, hours: Number(r.hours), skills: r.skills, note: r.note,
  playedAt: r.played_at, status: r.status, deadline: r.deadline, createdAt: r.created_at,
});
const toTournament = (r, entries = []) => ({
  id: r.id, name: r.name, league: r.league, startsAt: r.starts_at, endsAt: r.ends_at, sponsor: r.sponsor,
  status: r.status, bracket: r.bracket, createdAt: r.created_at,
  entries: entries.filter((e) => e.tournament_id === r.id).map((e) => ({ userId: e.user_id, status: e.status })),
});
const check = ({ data, error }) => { if (error) throw new Error(error.message); return data; };

export class SupabaseStore {
  constructor(url, key) { this.mode = 'live'; this.url = url; this.key = key; this.users = []; this.meCache = null; }

  async init() {
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    this.sb = createClient(this.url, this.key, { auth: { persistSession: true } });
    const { data } = await this.sb.auth.getSession();
    if (data.session) await this.refresh();
  }
  async refresh() {
    const { data: s } = await this.sb.auth.getSession();
    if (!s.session) { this.meCache = null; return; }
    this.users = check(await this.sb.from('profiles').select('*')).map(toUser);
    this.meCache = this.users.find((u) => u.id === s.session.user.id) || null;
  }
  me() { return this.meCache; }
  user(id) { return this.users.find((u) => u.id === id) || null; }
  uid() { return this.meCache?.id; }

  // ---------- auth ----------
  async sendCode(phone) { check(await this.sb.auth.signInWithOtp({ phone })); return { ok: true }; }
  async verifyCode(phone, code) {
    check(await this.sb.auth.verifyOtp({ phone, token: code, type: 'sms' }));
    await this.refresh();
    return { user: this.meCache, isNew: !this.meCache?.firstName };
  }
  async signOut() { await this.sb.auth.signOut(); this.meCache = null; }

  // ---------- users ----------
  async saveProfile(patch) {
    check(await this.sb.from('profiles').update(fromUser(patch)).eq('id', this.uid()));
    await this.refresh(); return this.meCache;
  }
  async uploadPhoto(file) {
    const path = `${this.uid()}/${Date.now()}.jpg`;
    check(await this.sb.storage.from('photos').upload(path, file, { upsert: true, contentType: file.type }));
    return this.sb.storage.from('photos').getPublicUrl(path).data.publicUrl;
  }
  async listUsers({ role } = {}) { await this.refresh(); return this.users.filter((u) => (role ? u.role === role : u.role !== 'admin') && u.firstName); }

  // ---------- matches & trainings ----------
  async createMatch(d) {
    return toMatch(check(await this.sb.from('matches').insert({
      type: d.type, team_a: d.teamA, team_b: d.teamB, sets: d.sets, decider: d.decider, played_at: d.playedAt, created_by: this.uid(),
    }).select().single()));
  }
  async createTraining(d) {
    return toTraining(check(await this.sb.from('trainings').insert({
      player_id: this.uid(), coach_id: d.coachId || null, hours: d.hours, skills: d.skills, note: d.note, played_at: d.playedAt,
      status: d.coachId ? 'pending' : 'confirmed',
    }).select().single()));
  }
  async pending() {
    const id = this.uid();
    const ms = check(await this.sb.from('matches').select('*').eq('status', 'pending').gt('deadline', new Date().toISOString())
      .or(`team_a.cs.{${id}},team_b.cs.{${id}}`)).map(toMatch)
      .filter((m) => (m.teamA.includes(m.createdBy) ? m.teamB : m.teamA).includes(id));
    const ts = check(await this.sb.from('trainings').select('*').eq('status', 'pending').eq('coach_id', id)
      .gt('deadline', new Date().toISOString())).map(toTraining);
    return { matches: ms, trainings: ts, count: ms.length + ts.length };
  }
  async outgoing() {
    const id = this.uid();
    const ms = check(await this.sb.from('matches').select('*').eq('created_by', id)
      .or('status.eq.pending,and(status.eq.cancelled,expired.eq.true,complained.eq.false)')).map(toMatch);
    const ts = check(await this.sb.from('trainings').select('*').eq('player_id', id).eq('status', 'pending')).map(toTraining);
    return { matches: ms, trainings: ts };
  }
  async confirm(kind, id) {
    check(await this.sb.rpc(kind === 'match' ? 'confirm_match' : 'confirm_training', kind === 'match' ? { p_match: id } : { p_training: id }));
    await this.refresh();
  }
  async dispute(kind, id, reason) { check(await this.sb.rpc('dispute_record', { p_kind: kind, p_id: id, p_reason: reason })); }
  async cancelOwn(kind, id) { check(await this.sb.rpc('cancel_own', { p_kind: kind, p_id: id })); }
  async history(userId) {
    const ms = check(await this.sb.from('matches').select('*').eq('status', 'confirmed')
      .or(`team_a.cs.{${userId}},team_b.cs.{${userId}}`).order('played_at', { ascending: false }).limit(50)).map(toMatch);
    const ts = check(await this.sb.from('trainings').select('*').eq('status', 'confirmed')
      .or(`player_id.eq.${userId},coach_id.eq.${userId}`).order('played_at', { ascending: false }).limit(50)).map(toTraining);
    return { matches: ms, trainings: ts };
  }

  // ---------- rating ----------
  async ranking({ league, period }) {
    let q = this.sb.from('profiles').select('*').gt('matches', 0).neq('role', 'admin');
    if (league) q = q.eq('league', league);
    const col = period === 'year' ? 'points_y' : 'points_q';
    const rows = check(await q.order(col, { ascending: false }).order('rating', { ascending: false }).limit(100));
    return rows.map(toUser).map((u, i) => ({ ...u, place: i + 1, points: period === 'year' ? u.pointsY : u.pointsQ }));
  }
  async leaders() {
    await this.refresh();
    const ps = this.users.filter((u) => u.role !== 'admin' && u.matches > 0);
    if (!ps.length) return { top1: null, streak: null, active: null, activeCount: 0 };
    const top1 = [...ps].sort((a, b) => b.top1Days - a.top1Days)[0];
    const streak = [...ps].sort((a, b) => b.form.match(/^В*/)[0].length - a.form.match(/^В*/)[0].length)[0];
    const month = new Date(); month.setDate(1); month.setHours(0, 0, 0, 0);
    const ms = check(await this.sb.from('matches').select('team_a,team_b').eq('status', 'confirmed').gte('played_at', month.toISOString()));
    const cnt = {}; for (const m of ms) for (const id of [...m.team_a, ...m.team_b]) cnt[id] = (cnt[id] || 0) + 1;
    const active = [...ps].sort((a, b) => (cnt[b.id] || 0) - (cnt[a.id] || 0))[0];
    return { top1, streak, active, activeCount: cnt[active.id] || 0 };
  }
  async fairplayRanking() {
    await this.refresh();
    return this.users.filter((u) => u.role !== 'admin' && u.fpCount > 0)
      .sort((a, b) => fairplay(b.fpSum, b.fpCount) - fairplay(a.fpSum, a.fpCount));
  }
  async achievements(userId) {
    return check(await this.sb.from('achievements').select('*').eq('user_id', userId).order('created_at', { ascending: false }))
      .map((a) => ({ id: a.id, userId: a.user_id, code: a.code, title: a.title, detail: a.detail, createdAt: a.created_at }));
  }

  // ---------- search & challenges ----------
  async suggestOpponent() {
    const me = this.meCache; await this.refresh();
    const since = new Date(Date.now() - 21 * 864e5).toISOString();
    const recent = check(await this.sb.from('matches').select('team_a,team_b').eq('status', 'confirmed').gte('played_at', since)
      .or(`team_a.cs.{${me.id}},team_b.cs.{${me.id}}`));
    const played = new Set(recent.flatMap((m) => [...m.team_a, ...m.team_b]));
    const c = this.users.filter((u) => u.role === 'player' && u.id !== me.id && u.firstName && !played.has(u.id))
      .map((u) => ({ u, s: Math.abs(u.rating - me.rating) - 40 * u.availability.filter((t) => me.availability.includes(t)).length }))
      .sort((a, b) => a.s - b.s);
    return c[0]?.u || null;
  }
  async challenges() {
    return check(await this.sb.from('challenges').select('*').order('at')).map((c) => ({
      id: c.id, fromId: c.from_id, toId: c.to_id, at: c.at, format: c.format, note: c.note, status: c.status, createdAt: c.created_at }));
  }
  async createChallenge({ toId, at, format, note }) {
    check(await this.sb.from('challenges').insert({ from_id: this.uid(), to_id: toId, at, format, note }));
  }
  async answerChallenge(id, status) { check(await this.sb.rpc('answer_challenge', { p_id: id, p_status: status })); }

  // ---------- coaches ----------
  async coachStats(coachId) {
    const ts = check(await this.sb.from('trainings').select('player_id,hours').eq('coach_id', coachId).eq('status', 'confirmed'));
    const rv = check(await this.sb.from('reviews').select('*').eq('coach_id', coachId).order('created_at', { ascending: false }))
      .map((r) => ({ id: r.id, coachId: r.coach_id, authorId: r.author_id, stars: Number(r.stars), text: r.text, createdAt: r.created_at }));
    const avg = rv.length ? Math.round((rv.reduce((s, r) => s + r.stars, 0) / rv.length) * 10) / 10 : null;
    return { trainings: ts.length, students: new Set(ts.map((t) => t.player_id)).size, hours: ts.reduce((s, t) => s + Number(t.hours), 0), avg, reviews: rv };
  }
  async canReview(coachId) {
    const r = check(await this.sb.from('trainings').select('id').eq('coach_id', coachId).eq('player_id', this.uid()).eq('status', 'confirmed').limit(1));
    return r.length > 0;
  }
  async addReview(coachId, stars, text) {
    check(await this.sb.from('reviews').upsert({ coach_id: coachId, author_id: this.uid(), stars, text }, { onConflict: 'coach_id,author_id' }));
  }
  async coachRanking() {
    await this.refresh();
    const out = [];
    for (const c of this.users.filter((u) => u.role === 'coach')) out.push({ ...c, stats: await this.coachStats(c.id) });
    return out.sort((a, b) => b.stats.students - a.stats.students || b.stats.trainings - a.stats.trainings);
  }

  // ---------- fair play & complaints ----------
  async rateFairplay(kind, refId, rateeId, stars) {
    check(await this.sb.rpc('rate_fairplay', { p_kind: kind, p_ref: refId, p_ratee: rateeId, p_stars: stars }));
  }
  async ratedFairplay(refId) {
    return check(await this.sb.from('fairplay').select('id').eq('ref_id', refId).eq('rater_id', this.uid()).limit(1)).length > 0;
  }
  async complain({ targetId, reason, refId }) {
    check(await this.sb.from('complaints').insert({ author_id: this.uid(), target_id: targetId, reason, ref_id: refId || null }));
  }
  async complaints() {
    return check(await this.sb.from('complaints').select('*').order('created_at', { ascending: false })).map((c) => ({
      id: c.id, authorId: c.author_id, targetId: c.target_id, reason: c.reason, refId: c.ref_id, status: c.status, createdAt: c.created_at }));
  }
  async resolveComplaint(id, accept) { check(await this.sb.rpc('resolve_complaint', { p_id: id, p_accept: accept })); }
  async disputes() { return check(await this.sb.from('matches').select('*').eq('status', 'disputed')).map(toMatch); }
  async resolveDispute(id, keep) { check(await this.sb.rpc('resolve_dispute', { p_match: id, p_keep: keep })); }
  async setBan(userId, days) { check(await this.sb.rpc('set_ban', { p_user: userId, p_days: days })); }

  // ---------- tournaments ----------
  async tournaments() {
    const ts = check(await this.sb.from('tournaments').select('*').order('created_at', { ascending: false }));
    const es = check(await this.sb.from('tournament_entries').select('*'));
    return ts.map((t) => toTournament(t, es));
  }
  async tournament(id) {
    const t = check(await this.sb.from('tournaments').select('*').eq('id', id).single());
    const es = check(await this.sb.from('tournament_entries').select('*').eq('tournament_id', id));
    return toTournament(t, es);
  }
  async applyTournament(id) {
    const me = this.meCache; const fp = fairplay(me.fpSum, me.fpCount);
    if (fp !== null && fp < FAIRPLAY_MIN_FOR_TOURNAMENT) throw new Error('Fair Play ниже 3,5 — заявка недоступна');
    check(await this.sb.rpc('apply_tournament', { p_t: id }));
  }
  async createTournament(d) {
    check(await this.sb.from('tournaments').insert({ name: d.name, league: d.league, starts_at: d.startsAt, ends_at: d.endsAt, sponsor: d.sponsor }));
  }
  async approveEntry(tid, userId, ok) {
    check(await this.sb.from('tournament_entries').update({ status: ok ? 'approved' : 'rejected' }).eq('tournament_id', tid).eq('user_id', userId));
  }
  async startTournament(tid) { check(await this.sb.rpc('start_tournament', { p_t: tid })); }
  async createTournamentMatch(tid, slotPath, sets) {
    const path = Array.isArray(slotPath) ? [slotPath[0], String(slotPath[1])] : ['final'];
    check(await this.sb.rpc('create_tournament_match', { p_t: tid, p_path: path, p_sets: sets }));
  }

  // ---------- news ----------
  async news() {
    const ns = check(await this.sb.from('news').select('*').order('created_at', { ascending: false }).limit(30));
    const cs = check(await this.sb.from('news_comments').select('*').order('created_at'));
    return ns.map((n) => ({ id: n.id, title: n.title, body: n.body, section: n.section, photos: n.photos, createdAt: n.created_at,
      comments: cs.filter((c) => c.news_id === n.id).map((c) => ({ id: c.id, userId: c.user_id, text: c.text, createdAt: c.created_at })) }));
  }
  async newsItem(id) { return (await this.news()).find((n) => n.id === id); }
  async addNews(d) { check(await this.sb.from('news').insert({ title: d.title, body: d.body, section: d.section, photos: d.photos || [] })); }
  async addComment(newsId, text) { check(await this.sb.from('news_comments').insert({ news_id: newsId, user_id: this.uid(), text })); }
  async hideComment(newsId, cid) { check(await this.sb.from('news_comments').delete().eq('id', cid)); }

  // ---------- admin ----------
  async inviteCoach({ phone, firstName, lastName }) { check(await this.sb.rpc('invite_coach', { p_phone: phone, p_first: firstName, p_last: lastName })); }
  async stats() {
    await this.refresh();
    const week = new Date(Date.now() - 7 * 864e5).toISOString();
    const month = new Date(Date.now() - 30 * 864e5).toISOString();
    const mw = await this.sb.from('matches').select('id', { count: 'exact', head: true }).eq('status', 'confirmed').gte('played_at', week);
    const tw = await this.sb.from('trainings').select('id', { count: 'exact', head: true }).eq('status', 'confirmed').gte('played_at', week);
    const am = check(await this.sb.from('matches').select('team_a,team_b').gte('played_at', month));
    return {
      users: this.users.filter((u) => u.role === 'player').length,
      coaches: this.users.filter((u) => u.role === 'coach').length,
      matchesWeek: mw.count ?? 0, trainingsWeek: tw.count ?? 0,
      activePlayers: new Set(am.flatMap((m) => [...m.team_a, ...m.team_b])).size,
    };
  }
}
