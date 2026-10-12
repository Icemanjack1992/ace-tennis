// Demo store: everything lives in localStorage, seeded with realistic Namangan data.
import {
  uid, nowIso, addHours, newPlayer, confirmMatch, expirePending, pendingFor, newMatch, newTraining,
  confirmersOf, involves, applySanctions, makeBracket, advanceBracket, rollSeason,
} from './logic.js';
import { winnerFromSets, leagueFor, FAIRPLAY_MIN_FOR_TOURNAMENT, fairplay, TOURNAMENT_BONUS } from './rating.js';

const KEY = 'ace_demo_v1';
const clone = (x) => JSON.parse(JSON.stringify(x));

function safeGet() { try { return localStorage.getItem(KEY); } catch { return null; } }
function safeSet(v) { try { localStorage.setItem(KEY, v); } catch { /* private mode */ } }

const DISTRICTS = ['Центр', 'Давлатобод', 'Янги Наманган', 'Чорсу', 'Другой район'];
const TIMES = ['утро', 'день', 'вечер', 'выходные'];

function seed() {
  const db = { users: [], matches: [], trainings: [], challenges: [], reviews: [], fairplay: [],
    complaints: [], tournaments: [], news: [], achievements: [], meId: null, seeded: nowIso() };
  const names = [
    ['Бобур', 'Назаров', 'м', 1990, 3, 1180], ['Улугбек', 'Мирзаев', 'м', 1986, 6, 1320], ['Ильхом', 'Расулов', 'м', 1993, 2, 1260],
    ['Жасур', 'Алиев', 'м', 1995, 4, 1210], ['Шерзод', 'Тошпулатов', 'м', 1988, 5, 1190], ['Азамат', 'Собиров', 'м', 1997, 3, 1120],
    ['Нодир', 'Хасанов', 'м', 1992, 2, 1050], ['Сардор', 'Юсупов', 'м', 2000, 1, 960], ['Нодира', 'Юсупова', 'ж', 1994, 3, 1080],
    ['Дилноза', 'Каримова', 'ж', 1998, 2, 990], ['Отабек', 'Рахимов', 'м', 1985, 7, 1350], ['Санжар', 'Исмоилов', 'м', 2001, 1, 900],
    ['Камола', 'Ахмедова', 'ж', 1996, 4, 1100], ['Фаррух', 'Норматов', 'м', 1991, 3, 1040], ['Бехзод', 'Умаров', 'м', 1989, 5, 1230],
    ['Мадина', 'Абдуллаева', 'ж', 1999, 1, 940],
  ];
  const skill = {};
  names.forEach(([f, l, g, by, yrs, s], i) => {
    const u = newPlayer({
      firstName: f, lastName: l, gender: g, birthYear: by, years: yrs, district: DISTRICTS[i % 5],
      selfLevel: yrs >= 5 ? 'продвинутый' : yrs >= 3 ? 'средний' : 'начинающий', hand: i % 6 === 2 ? 'левша' : 'правша',
      availability: [TIMES[i % 4], TIMES[(i + 2) % 4]], phone: `+99890${String(1000000 + i).slice(1)}`,
      createdAt: addHours(nowIso(), -24 * 120),
    });
    skill[u.id] = s;
    db.users.push(u);
  });
  const coaches = [
    ['Дильшод', 'Каримов', 'м', 8, 'Подача;Техника для начинающих;Парная игра', 'дети и взрослые'],
    ['Рустам', 'Ахмедов', 'м', 12, 'Физподготовка;Тактика;Соревнования', 'взрослые'],
    ['Малика', 'Турсунова', 'ж', 6, 'Дети;Техника для начинающих', 'дети'],
  ];
  for (const [f, l, g, exp, spec, ww] of coaches) {
    db.users.push(newPlayer({
      role: 'coach', firstName: f, lastName: l, gender: g, years: exp, district: 'Центр', phone: '', availability: ['утро', 'вечер'],
      coach: { verified: true, price: null, specialization: spec.split(';'), worksWith: ww, experience: exp },
      createdAt: addHours(nowIso(), -24 * 150),
    }));
  }
  const admin = newPlayer({ role: 'admin', firstName: 'Администратор', lastName: 'Ace Tennis', phone: '+998900000000' });
  db.users.push(admin);
  const players = db.users.filter((u) => u.role === 'player');

  // ~140 historic matches over the past 100 days, decided by hidden skill
  let seedN = 7;
  const rnd = () => { seedN = (seedN * 9301 + 49297) % 233280; return seedN / 233280; };
  const hist = [];
  for (let i = 0; i < 280; i++) {
    const a = players[Math.floor(rnd() * players.length)];
    let b = players[Math.floor(rnd() * players.length)];
    if (a === b) continue;
    const pa = 1 / (1 + Math.pow(10, (skill[b.id] - skill[a.id]) / 160));
    const aWins = rnd() < pa;
    const setsWon = [];
    const three = rnd() < 0.35;
    const loseScore = () => [0, 1, 2, 3, 4, 5][Math.floor(rnd() * 6)];
    const mk = (win) => { const l = loseScore(); const s = l === 5 ? [7, 5] : [6, l]; return win ? s : [s[1], s[0]]; };
    if (three) setsWon.push(mk(aWins), mk(!aWins), mk(aWins)); else setsWon.push(mk(aWins), mk(aWins));
    const playedAt = addHours(nowIso(), -24 * (100 - i * 0.35) - rnd() * 10);
    hist.push(newMatch({ type: 'single', teamA: [a.id], teamB: [b.id], sets: setsWon, decider: 'set', playedAt, createdBy: a.id }));
  }
  hist.sort((x, y) => x.playedAt.localeCompare(y.playedAt));
  for (const m of hist) { db.matches.push(m); confirmMatch(db, m, m.teamB[0]); m.createdAt = m.playedAt; }
  // Leagues as they stand after the last quarterly recalculation
  for (const u of db.users) if (u.matches >= 5) u.league = leagueFor(u.rating, u.matches);

  const [me, ulug, ilhom, jasur, sherzod, azamat, nodir, sardor] = players;
  db.meId = null; // start at the login screen
  const [dilshod, rustam, malika] = db.users.filter((u) => u.role === 'coach');
  // Trainings + reviews
  const skills = ['Подача', 'Форхенд', 'Бэкхенд', 'Удар с лёта', 'Приём подачи', 'Физподготовка'];
  players.forEach((p, i) => {
    const c = [dilshod, rustam, malika][i % 3];
    for (let k = 0; k < 2 + (i % 4); k++) {
      const t = newTraining({ playerId: p.id, coachId: c.id, hours: [1, 1.5, 2][k % 3], skills: [skills[(i + k) % 6], skills[(i + k + 1) % 6]], note: '', playedAt: addHours(nowIso(), -24 * (60 - k * 9 - i)) });
      t.status = 'confirmed'; db.trainings.push(t);
    }
  });
  const rv = [
    [dilshod, me, 5, 'За месяц поставил подачу, объясняет понятно, всегда вовремя.'],
    [dilshod, players[8], 4.5, 'Хорошие упражнения на бэкхенд, хотелось бы больше игровой практики.'],
    [rustam, ulug, 5, 'Серьёзный подход к физподготовке, результат виден в матчах.'],
    [malika, players[9], 5, 'Очень терпеливая, отлично работает с начинающими.'],
  ];
  for (const [c, a, s, text] of rv) db.reviews.push({ id: uid(), coachId: c.id, authorId: a.id, stars: s, text, createdAt: addHours(nowIso(), -24 * 10) });
  // Fair Play ratings for everyone
  for (const u of db.users.filter((x) => x.role !== 'admin')) { u.fpCount = 6 + (u.matches % 9); u.fpSum = Math.round(u.fpCount * (4.4 + ((u.matches * 7) % 6) / 10)); }

  // Pending: Sherzod logged a match against me yesterday → I must confirm
  const pm = newMatch({ type: 'single', teamA: [sherzod.id], teamB: [me.id], sets: [[4, 6], [6, 3], [5, 7]], decider: 'set', playedAt: addHours(nowIso(), -20), createdBy: sherzod.id });
  pm.createdAt = addHours(nowIso(), -17); pm.deadline = addHours(pm.createdAt, 48);
  db.matches.push(pm);
  // Incoming challenge
  db.challenges.push({ id: uid(), fromId: jasur.id, toId: me.id, at: addHours(nowIso(), 50), format: 'single', status: 'sent', note: 'Сыграем на кортах в Давлатободе?', shareFrom: true, createdAt: nowIso() });
  // Upcoming accepted game
  db.challenges.push({ id: uid(), fromId: me.id, toId: ilhom.id, at: addHours(nowIso(), 26), format: 'single', status: 'accepted', note: '', shareFrom: true, shareTo: true, createdAt: nowIso() });

  // Tournaments: one running (silver), one open for registration (bronze)
  const silverish = [...players].sort((a, b) => b.rating - a.rating).slice(4, 12);
  if (!silverish.includes(me)) silverish[7] = me;
  const t1 = { id: uid(), name: 'Осенний кубок Намангана', league: me.league, startsAt: addHours(nowIso(), -24 * 4), endsAt: addHours(nowIso(), 24 * 6),
    sponsor: '', status: 'running', entries: silverish.map((u) => ({ userId: u.id, status: 'approved' })), bracket: null, createdAt: addHours(nowIso(), -24 * 9) };
  t1.bracket = makeBracket(silverish.map((u) => u.id), db.users);
  // Play quarterfinals except the one involving me
  t1.bracket.qf.forEach((s) => {
    if (s.a === me.id || s.b === me.id) return;
    const aw = db.users.find((u) => u.id === s.a).rating >= db.users.find((u) => u.id === s.b).rating;
    const m = newMatch({ type: 'single', teamA: [s.a], teamB: [s.b], sets: aw ? [[6, 3], [6, 4]] : [[3, 6], [6, 7]], decider: 'set', playedAt: addHours(nowIso(), -24 * 2), createdBy: s.a, tournamentId: t1.id, round: 'qf' });
    db.matches.push(m); confirmMatch(db, m, s.b); s.matchId = m.id; advanceBracket(t1, m);
  });
  db.tournaments.push(t1);
  db.tournaments.push({ id: uid(), name: 'Зимний кубок', league: 'bronze', startsAt: addHours(nowIso(), 24 * 20), endsAt: addHours(nowIso(), 24 * 30),
    sponsor: '', status: 'registration', entries: players.filter((u) => u.league === 'bronze').slice(0, 5).map((u) => ({ userId: u.id, status: 'approved' })), bracket: null, createdAt: nowIso() });

  db.news.push(
    { id: uid(), title: 'Открыта заявка на «Зимний кубок»', body: 'Турнир для лиги Бронза: 8 игроков, 3 матча у каждого, около 10 дней. Подайте заявку в разделе «Турниры».', section: 'tournaments', photos: [], createdAt: addHours(nowIso(), -24 * 2), comments: [] },
    { id: uid(), title: 'Стартовал Осенний сезон 26', body: 'Очки сезона обнулены, лиги пересчитаны по уровню силы. Осенний сезон идёт до конца ноября — удачи!', section: 'season', photos: [], createdAt: new Date(new Date().getFullYear(), 8, 1, 10).toISOString(), comments: [{ id: uid(), userId: ulug.id, text: 'Отлично, ждём турниров!', createdAt: addHours(nowIso(), -24 * 10) }] },
    { id: uid(), title: 'В приложении 3 тренера', body: 'Дильшод Каримов, Рустам Ахмедов и Малика Турсунова подтверждены администратором. Записывайтесь на тренировки!', section: 'community', photos: [], createdAt: addHours(nowIso(), -24 * 20), comments: [] },
  );
  // Days-in-top badges for the demo
  const byRating = [...players].sort((a, b) => b.pointsQ - a.pointsQ);
  byRating.forEach((u, i) => { if (i < 10) u.top10Days = 2 + ((i * 13) % 47); if (i === 0) u.top1Days = 9; });
  return db;
}

export class DemoStore {
  constructor() { this.mode = 'demo'; this.db = null; }

  async init() {
    const raw = safeGet();
    this.db = raw ? JSON.parse(raw) : seed();
    if (!raw) this.save();
    expirePending(this.db);
    this.db.users.forEach(rollSeason);
    this.save();
  }
  save() { safeSet(JSON.stringify(this.db)); }
  reset() { this.db = seed(); this.save(); }

  // ---------- auth ----------
  me() { return this.db.users.find((u) => u.id === this.db.meId) || null; }
  async sendCode(phone) { return { ok: true, hint: 'Демо-режим: подойдёт любой код из 4 цифр' }; }
  async verifyCode(phone, code) {
    if (!/^\d{4,6}$/.test(code)) throw new Error('Введите код из SMS');
    let u = this.db.users.find((x) => x.phone && x.phone.replace(/\D/g, '') === phone.replace(/\D/g, ''));
    if (!u) { u = newPlayer({ phone, firstName: '', lastName: '' }); this.db.users.push(u); }
    this.db.meId = u.id; this.save();
    return { user: clone(u), isNew: !u.firstName };
  }
  async loginAs(role) {
    const u = role === 'admin' ? this.db.users.find((x) => x.role === 'admin')
      : role === 'coach' ? this.db.users.find((x) => x.role === 'coach')
      : this.db.users.find((x) => x.role === 'player');
    this.db.meId = u.id; this.save(); return clone(u);
  }
  async signOut() { this.db.meId = null; this.save(); }

  // ---------- users ----------
  async saveProfile(patch) {
    const u = this.me(); Object.assign(u, patch); this.save(); return clone(u);
  }
  user(id) { return this.db.users.find((u) => u.id === id) || null; }
  async listUsers({ role } = {}) {
    return clone(this.db.users.filter((u) => (role ? u.role === role : u.role !== 'admin') && u.firstName));
  }

  // ---------- matches & trainings ----------
  async createMatch(data) {
    const me = this.me();
    const m = newMatch({ ...data, createdBy: me.id });
    if (!winnerFromSets(m.sets)) throw new Error('Счёт по сетам не определяет победителя');
    this.db.matches.push(m); this.save(); return clone(m);
  }
  async createTraining(data) {
    const t = newTraining({ ...data, playerId: this.me().id });
    this.db.trainings.push(t); this.save(); return clone(t);
  }
  async pending() { expirePending(this.db); return clone(pendingFor(this.db, this.db.meId)); }
  async outgoing() {
    const id = this.db.meId;
    return clone({
      matches: this.db.matches.filter((m) => m.createdBy === id && (m.status === 'pending' || (m.status === 'cancelled' && m.expired && !m.complained))),
      trainings: this.db.trainings.filter((t) => t.playerId === id && t.status === 'pending'),
    });
  }
  async confirm(kind, id) {
    if (kind === 'match') {
      const m = this.db.matches.find((x) => x.id === id);
      if (!confirmersOf(m).includes(this.db.meId)) throw new Error('Подтвердить может только соперник');
      confirmMatch(this.db, m, this.db.meId);
      if (m.tournamentId) {
        const t = this.db.tournaments.find((x) => x.id === m.tournamentId);
        advanceBracket(t, m);
        if (t.status === 'finished') this.finishTournament(t);
      }
    } else {
      const t = this.db.trainings.find((x) => x.id === id);
      if (t.coachId !== this.db.meId) throw new Error('Подтвердить может только тренер');
      t.status = 'confirmed';
    }
    this.save();
  }
  finishTournament(t) {
    const f = t.bracket.final;
    const loser = f.a === f.winner ? f.b : f.a;
    const winU = this.user(f.winner), loseU = this.user(loser);
    winU.pointsQ += TOURNAMENT_BONUS.winner; winU.pointsY += TOURNAMENT_BONUS.winner;
    loseU.pointsQ += TOURNAMENT_BONUS.finalist; loseU.pointsY += TOURNAMENT_BONUS.finalist;
    this.db.achievements.push({ id: uid(), userId: f.winner, code: 'tour_win', title: 'Победитель турнира', detail: t.name, createdAt: nowIso() });
    this.db.achievements.push({ id: uid(), userId: loser, code: 'tour_final', title: 'Финалист турнира', detail: t.name, createdAt: nowIso() });
  }
  async dispute(kind, id, reason) {
    const list = kind === 'match' ? this.db.matches : this.db.trainings;
    const r = list.find((x) => x.id === id);
    r.status = 'disputed'; r.disputeReason = reason; r.disputedBy = this.db.meId;
    this.save();
  }
  async cancelOwn(kind, id) {
    const list = kind === 'match' ? this.db.matches : this.db.trainings;
    const r = list.find((x) => x.id === id && (x.createdBy === this.db.meId || x.playerId === this.db.meId));
    if (r) { r.status = 'cancelled'; this.save(); }
  }
  async history(userId) {
    const ms = this.db.matches.filter((m) => m.status === 'confirmed' && involves(m, userId))
      .sort((a, b) => b.playedAt.localeCompare(a.playedAt));
    const ts = this.db.trainings.filter((t) => t.status === 'confirmed' && (t.playerId === userId || t.coachId === userId))
      .sort((a, b) => b.playedAt.localeCompare(a.playedAt));
    return clone({ matches: ms, trainings: ts });
  }

  // ---------- rating ----------
  async ranking({ league, period }) {
    const key = period === 'year' ? 'pointsY' : 'pointsQ';
    const list = this.db.users.filter((u) => (u.role === 'player' || u.role === 'coach') && u.matches > 0 && u.firstName && (!league || u.league === league))
      .sort((a, b) => b[key] - a[key] || b.rating - a.rating);
    return clone(list.map((u, i) => ({ ...u, place: i + 1, points: u[key] })));
  }
  async leaders() {
    const ps = this.db.users.filter((u) => u.role !== 'admin' && u.matches > 0);
    const top1 = [...ps].sort((a, b) => b.top1Days - a.top1Days)[0];
    const streak = [...ps].sort((a, b) => (b.form.match(/^В*/)[0].length) - (a.form.match(/^В*/)[0].length))[0];
    const month = new Date(); month.setDate(1); month.setHours(0, 0, 0, 0);
    const cnt = (u) => this.db.matches.filter((m) => m.status === 'confirmed' && involves(m, u.id) && m.playedAt >= month.toISOString()).length;
    const active = [...ps].sort((a, b) => cnt(b) - cnt(a))[0];
    return clone({ top1, streak, active, activeCount: active ? cnt(active) : 0 });
  }
  async fairplayRanking() {
    return clone(this.db.users.filter((u) => u.role !== 'admin' && u.fpCount > 0)
      .sort((a, b) => fairplay(b.fpSum, b.fpCount) - fairplay(a.fpSum, a.fpCount)));
  }
  async achievements(userId) {
    return clone(this.db.achievements.filter((a) => a.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  }

  // ---------- search & challenges ----------
  async suggestOpponent() {
    const me = this.me();
    const played = new Set(this.db.matches.filter((m) => m.status === 'confirmed' && involves(m, me.id) && m.playedAt > addHours(nowIso(), -24 * 21))
      .flatMap((m) => [...m.teamA, ...m.teamB]));
    const cands = this.db.users.filter((u) => u.role === 'player' && u.id !== me.id && u.firstName && !played.has(u.id))
      .map((u) => ({ u, score: Math.abs(u.rating - me.rating) - 40 * u.availability.filter((t) => me.availability.includes(t)).length }))
      .sort((a, b) => a.score - b.score);
    return cands[0] ? clone(cands[0].u) : null;
  }
  async challenges() {
    const id = this.db.meId;
    return clone(this.db.challenges.filter((c) => c.fromId === id || c.toId === id).sort((a, b) => a.at.localeCompare(b.at)));
  }
  async createChallenge({ toId, at, format, note, share = false }) {
    this.db.challenges.push({ id: uid(), fromId: this.db.meId, toId, at, format, note, status: 'sent', shareFrom: !!share, shareTo: false, createdAt: nowIso() });
    this.save();
  }
  async answerChallenge(id, status, share = false) {
    const c = this.db.challenges.find((x) => x.id === id);
    if (c.toId !== this.db.meId) throw new Error('Нет доступа');
    c.status = status; c.shareTo = status === 'accepted' && !!share; this.save();
  }
  async contacts() {
    const me = this.db.meId; const out = {};
    for (const c of this.db.challenges) {
      const other = this.db.users.find((u) => u.id === (c.fromId === me ? c.toId : c.fromId));
      if (!other?.phone) continue;
      if ((c.toId === me && c.shareFrom && c.status !== 'declined') || (c.fromId === me && c.shareTo && c.status === 'accepted')) out[c.id] = other.phone;
    }
    return out;
  }
  async sharePhone(id) {
    const c = this.db.challenges.find((x) => x.id === id); const me = this.db.meId;
    if (c.fromId === me) c.shareFrom = true; else if (c.toId === me) c.shareTo = true;
    this.save();
  }

  // ---------- coaches ----------
  async coachStats(coachId) {
    const ts = this.db.trainings.filter((t) => t.coachId === coachId && t.status === 'confirmed');
    const students = new Set(ts.map((t) => t.playerId));
    const rv = this.db.reviews.filter((r) => r.coachId === coachId);
    const avg = rv.length ? Math.round((rv.reduce((s, r) => s + r.stars, 0) / rv.length) * 10) / 10 : null;
    return { trainings: ts.length, students: students.size, hours: ts.reduce((s, t) => s + t.hours, 0), avg, reviews: clone(rv) };
  }
  canReview(coachId) {
    return this.db.trainings.some((t) => t.coachId === coachId && t.playerId === this.db.meId && t.status === 'confirmed');
  }
  async addReview(coachId, stars, text) {
    if (!this.canReview(coachId)) throw new Error('Отзыв могут оставить только ученики с подтверждённой тренировкой');
    const ex = this.db.reviews.find((r) => r.coachId === coachId && r.authorId === this.db.meId);
    if (ex) Object.assign(ex, { stars, text, createdAt: nowIso() });
    else this.db.reviews.push({ id: uid(), coachId, authorId: this.db.meId, stars, text, createdAt: nowIso() });
    this.save();
  }
  async coachRanking() {
    const coaches = this.db.users.filter((u) => u.role === 'coach');
    const out = [];
    for (const c of coaches) out.push({ ...clone(c), stats: await this.coachStats(c.id) });
    return out.sort((a, b) => b.stats.students - a.stats.students || b.stats.trainings - a.stats.trainings);
  }

  // ---------- fair play & complaints ----------
  async rateFairplay(refKind, refId, rateeId, stars) {
    if (this.db.fairplay.some((f) => f.refId === refId && f.raterId === this.db.meId)) return;
    this.db.fairplay.push({ id: uid(), refKind, refId, raterId: this.db.meId, rateeId, stars });
    const u = this.user(rateeId); u.fpSum += stars; u.fpCount += 1; this.save();
  }
  ratedFairplay(refId) { return this.db.fairplay.some((f) => f.refId === refId && f.raterId === this.db.meId); }
  async complain({ targetId, reason, refId }) {
    this.db.complaints.push({ id: uid(), authorId: this.db.meId, targetId, reason, refId, status: 'open', reply: '', createdAt: nowIso() });
    const m = this.db.matches.find((x) => x.id === refId); if (m) m.complained = true;
    this.save();
  }
  async complaints() { return clone(this.db.complaints.sort((a, b) => b.createdAt.localeCompare(a.createdAt))); }
  async resolveComplaint(id, accept) {
    const c = this.db.complaints.find((x) => x.id === id);
    c.status = accept ? 'accepted' : 'rejected'; c.resolvedAt = nowIso();
    if (accept) applySanctions(this.db, c.targetId);
    this.save();
  }
  async disputes() { return clone(this.db.matches.filter((m) => m.status === 'disputed')); }
  async resolveDispute(id, keep) {
    const m = this.db.matches.find((x) => x.id === id);
    if (keep) confirmMatch(this.db, m, 'admin'); else m.status = 'cancelled';
    this.save();
  }
  async setBan(userId, days) {
    const u = this.user(userId); u.bannedUntil = days ? addHours(nowIso(), days * 24) : null; this.save();
  }

  // ---------- tournaments ----------
  async tournaments() { return clone(this.db.tournaments.sort((a, b) => b.createdAt.localeCompare(a.createdAt))); }
  async tournament(id) { return clone(this.db.tournaments.find((t) => t.id === id)); }
  async applyTournament(id) {
    const t = this.db.tournaments.find((x) => x.id === id); const me = this.me();
    const fp = fairplay(me.fpSum, me.fpCount);
    if (fp !== null && fp < FAIRPLAY_MIN_FOR_TOURNAMENT) throw new Error('Fair Play ниже 3,5 — заявка недоступна');
    if (me.league !== t.league) throw new Error('Турнир для другой лиги');
    if (t.entries.some((e) => e.userId === me.id)) return;
    t.entries.push({ userId: me.id, status: 'pending' }); this.save();
  }
  async createTournament(data) {
    this.db.tournaments.push({ id: uid(), status: 'registration', entries: [], bracket: null, createdAt: nowIso(), ...data }); this.save();
  }
  async approveEntry(tid, userId, ok) {
    const t = this.db.tournaments.find((x) => x.id === tid);
    const e = t.entries.find((x) => x.userId === userId); e.status = ok ? 'approved' : 'rejected'; this.save();
  }
  async startTournament(tid) {
    const t = this.db.tournaments.find((x) => x.id === tid);
    const ids = t.entries.filter((e) => e.status === 'approved').map((e) => e.userId);
    if (ids.length !== 8) throw new Error(`Нужно ровно 8 утверждённых игроков (сейчас ${ids.length})`);
    t.bracket = makeBracket(ids, this.db.users); t.status = 'running'; this.save();
  }
  // Player logs a tournament match from their bracket slot
  async createTournamentMatch(tid, slotPath, sets) {
    const t = this.db.tournaments.find((x) => x.id === tid);
    const slot = slotPath === 'final' ? t.bracket.final : t.bracket[slotPath[0]][slotPath[1]];
    const me = this.db.meId;
    if (slot.a !== me && slot.b !== me) throw new Error('Это не ваш матч');
    const opp = slot.a === me ? slot.b : slot.a;
    const m = newMatch({ type: 'single', teamA: [me], teamB: [opp], sets, decider: 'set', playedAt: nowIso(), createdBy: me, tournamentId: tid, round: Array.isArray(slotPath) ? slotPath[0] : 'final' });
    if (!winnerFromSets(sets)) throw new Error('Счёт по сетам не определяет победителя');
    // orient result to bracket: slot.a is A in bracket terms
    slot.matchId = m.id;
    this.db.matches.push(m); this.save(); return clone(m);
  }

  // ---------- news ----------
  async news() { return clone(this.db.news.sort((a, b) => b.createdAt.localeCompare(a.createdAt))); }
  async newsItem(id) { return clone(this.db.news.find((n) => n.id === id)); }
  async addNews(data) { this.db.news.push({ id: uid(), createdAt: nowIso(), comments: [], photos: [], ...data }); this.save(); }
  async addComment(newsId, text) {
    const n = this.db.news.find((x) => x.id === newsId);
    n.comments.push({ id: uid(), userId: this.db.meId, text, createdAt: nowIso() }); this.save();
  }
  async hideComment(newsId, cid) {
    const n = this.db.news.find((x) => x.id === newsId);
    n.comments = n.comments.filter((c) => c.id !== cid); this.save();
  }

  // ---------- admin ----------
  async inviteCoach({ phone, firstName, lastName }) {
    let u = this.db.users.find((x) => x.phone && x.phone.replace(/\D/g, '') === phone.replace(/\D/g, ''));
    if (!u) { u = newPlayer({ phone, firstName, lastName }); this.db.users.push(u); }
    u.role = 'coach'; u.coach = { verified: true, price: null, specialization: [], worksWith: '', experience: u.years || 0, ...(u.coach || {}) };
    this.save();
  }
  async stats() {
    const week = addHours(nowIso(), -24 * 7);
    return {
      users: this.db.users.filter((u) => u.role === 'player').length,
      coaches: this.db.users.filter((u) => u.role === 'coach').length,
      matchesWeek: this.db.matches.filter((m) => m.status === 'confirmed' && m.playedAt >= week).length,
      trainingsWeek: this.db.trainings.filter((t) => t.status === 'confirmed' && t.playedAt >= week).length,
      activePlayers: new Set(this.db.matches.filter((m) => m.playedAt >= addHours(nowIso(), -24 * 30)).flatMap((m) => [...m.teamA, ...m.teamB])).size,
    };
  }
}
