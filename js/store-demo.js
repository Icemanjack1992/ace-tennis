// Demo store: everything lives in localStorage, seeded with realistic Namangan data.
import {
  uid, nowIso, addHours, newPlayer, confirmMatch, expirePending, pendingFor, newMatch, newTraining,
  confirmersOf, involves, applySanctions, makeBracket, advanceBracket, rollSeason,
  courtPrice, tashIso, tashToday, addDays, ACTIVE_BOOKING,
} from './logic.js';
import { winnerFromSets, leagueFor, FAIRPLAY_MIN_FOR_TOURNAMENT, fairplay, TOURNAMENT_BONUS } from './rating.js';

const KEY = 'ace_demo_v2';
const clone = (x) => JSON.parse(JSON.stringify(x));

function safeGet() { try { return localStorage.getItem(KEY); } catch { return null; } }
function safeSet(v) { try { localStorage.setItem(KEY, v); } catch { /* private mode */ } }

const DISTRICTS = ['г. Наманган', 'Чустский район', 'Наманганский район', 'Учкурганский район', 'Касансайский район'];
// Experience is stored in months: 3, 6, 12, 24, 36, 48 (= more than 3 years)
const toMonths = (y) => (y >= 4 ? 48 : y * 12);
const TIMES = ['утро', 'день', 'вечер', 'выходные'];

// Demo courts (real places from OpenStreetMap)
const DEMO_COURTS = [
  ['namangan', 'Наманган', 'Теннисные корты «Дўстлик»', '', 41.00167, 71.60223, 9, 'hard', true],
  ['namangan', 'Наманган', 'Теннисные корты', '', 40.99883, 71.60807, 3, '', false],
  ['andijan', 'Андижан', 'Корты стадиона «Бобур Арена»', '', 40.7779, 72.3517, 2, 'hard', true],
  ['tashkent_city', 'Ташкент', 'СК «Юнусабад»', 'Юнусабадский район', 41.3469, 69.28396, 6, 'mixed', true],
].map(([region, city, name, address, lat, lng, courts, surface, checked], i) => ({ id: 'court' + i, region, city, name, address, lat, lng, courts, surface, indoor: false, lights: i === 0, phone: '', price: '', note: '', checked, active: true }));
const courtSnap = (c) => (c ? { id: c.id, name: c.name, city: c.city, lat: c.lat, lng: c.lng } : null);

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
      firstName: f, lastName: l, gender: g, birthYear: by, years: toMonths(yrs), region: 'namangan', district: DISTRICTS[i % 5],
      selfLevel: yrs >= 5 ? 'продвинутый' : yrs >= 3 ? 'средний' : 'начинающий', hand: i % 6 === 2 ? 'левша' : 'правша',
      availability: [TIMES[i % 4], TIMES[(i + 2) % 4]], phone: `+99890${String(1000000 + i)}`,
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
      role: 'coach', firstName: f, lastName: l, gender: g, years: 48, region: 'namangan', district: 'г. Наманган', phone: '', availability: ['утро', 'вечер'],
      coach: { verified: true, price: null, specialization: spec.split(';'), worksWith: ww, experience: 48, equipment: f === 'Дильшод' ? ['balls', 'rackets', 'machine'] : [], courts: f === 'Дильшод' ? ['court0'] : [] },
      coachPro: f === 'Дильшод',
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
    // Player numbers (ID) and region for old demo data
    this.db.users.forEach((u, i) => { if (!u.playerNo) u.playerNo = 10001 + i; if (!u.region && u.district) u.region = 'namangan'; });
    if (!this.db.courts) this.db.courts = clone(DEMO_COURTS);
    this.seedVenue();
    this.save();
  }
  // Demo court account: «Дўстлик» with prices, photos, a card and a few bookings
  seedVenue() {
    if (this.db.venueSeeded) return;
    this.db.venueSeeded = true; this.db.bookings = this.db.bookings || []; this.db.courtReviews = this.db.courtReviews || []; this.db.courtRequests = this.db.courtRequests || [];
    const owner = newPlayer({ role: 'court', firstName: 'Шухрат', lastName: 'Каримов', phone: '+998901234500', region: 'namangan', district: 'г. Наманган', availability: ['вечер'] });
    owner.termsVer = (this.db.users.find((u) => u.termsVer) || {}).termsVer || '';
    this.db.users.push(owner);
    const svg = (bg, fg, t) => 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500"><rect width="800" height="500" fill="${bg}"/><rect x="120" y="90" width="560" height="320" fill="none" stroke="${fg}" stroke-width="6"/><path d="M400 90v320M120 250h560" stroke="${fg}" stroke-width="4"/><text x="400" y="470" font-family="sans-serif" font-size="28" fill="${fg}" text-anchor="middle">${t}</text></svg>`);
    Object.assign(this.db.courts[0], { ownerId: owner.id, verified: true, checked: true, bookingOn: true, phone: '+998 90 123 45 00', courts: 3, surface: 'hard', lights: true,
      amenities: ['shower', 'locker', 'parking', 'water'], description: 'Три хард-корта с освещением в центре Наманган.',
      photos: { court: [svg('#2E6F95', '#fff', 'Корт 1'), svg('#3A7D5C', '#fff', 'Корт 2')], shower: [svg('#E7ECEF', '#456', 'Душ')], locker: [svg('#EFE8DF', '#654', 'Раздевалка')] },
      openMin: 420, closeMin: 1380, priceRules: [{ d: 'wd', f: 420, t: 1020, p: 80000 }, { d: 'wd', f: 1020, t: 1380, p: 120000 }, { d: 'we', f: 420, t: 1380, p: 150000 }],
      cardNumber: '8600 0000 0000 0000', cardHolder: 'SHUKHRAT KARIMOV', ratingSum: 9, ratingCount: 2 });
    const p = this.db.users.filter((u) => u.role === 'player');
    const today = tashToday();
    const mk = (pl, day, min, minutes, unit, status, pay) => this.db.bookings.push({ id: uid(), courtId: 'court0', unit, start: tashIso(addDays(today, day), min),
      end: tashIso(addDays(today, day), min + minutes), playerId: pl ? pl.id : null, kind: pl ? 'app' : 'offline', pay, status,
      price: pl ? courtPrice(this.db.courts[0], tashIso(addDays(today, day), min), minutes) : 0, playerName: pl ? `${pl.firstName} ${pl.lastName}` : '',
      playerPhone: pl ? pl.phone.replace(/\D/g, '') : '', note: pl ? '' : 'Алишер, постоянный клиент', receipt: '', holdUntil: null, noshow: false, cancelReason: '', cancelledBy: '', createdAt: nowIso() });
    mk(p[1], 1, 18 * 60, 90, 1, 'cash', 'cash');
    mk(p[2], 1, 19 * 60, 60, 2, 'confirmed', 'card');
    mk(null, 1, 8 * 60, 120, 1, 'blocked', 'none');
    mk(p[3], 2, 17 * 60, 60, 1, 'paid', 'card');
    this.db.bookings[this.db.bookings.length - 1].receipt = svg('#fff', '#333', 'Чек: 120 000 сум');
    this.db.courtReviews.push({ id: uid(), courtId: 'court0', bookingId: 'old1', authorId: p[4].id, stars: 5, text: 'Отличное покрытие, есть душ.', createdAt: nowIso() },
      { id: uid(), courtId: 'court0', bookingId: 'old2', authorId: p[5].id, stars: 4, text: 'Хорошо, но вечером много людей.', createdAt: nowIso() });
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
      : role === 'court' ? this.db.users.find((x) => x.role === 'court')
      : this.db.users.find((x) => x.role === 'player');
    this.db.meId = u.id; this.save(); return clone(u);
  }
  async signOut() { this.db.meId = null; this.save(); }
  async deleteAccount() {
    const me = this.me(); if (!me || me.role === 'admin') throw new Error('Аккаунт администратора удалить нельзя');
    Object.assign(me, { role: 'player', firstName: 'Удалённый', lastName: 'игрок', photo: null, phone: '', region: '', district: '', coach: null, coachPro: false, deletedAt: new Date().toISOString() });
    this.db.challenges = this.db.challenges.filter((c) => c.fromId !== me.id && c.toId !== me.id);
    this.db.meId = null; this.save();
  }

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
    m.courtId = data.courtId || null; m.court = courtSnap(this.db.courts.find((c) => c.id === data.courtId));
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
  async createChallenge({ toId, at, format, note, share = false, courtId = null }) {
    this.db.challenges.push({ id: uid(), fromId: this.db.meId, toId, at, format, note, status: 'sent', shareFrom: !!share, shareTo: false, createdAt: nowIso(),
      courtId, court: courtSnap(this.db.courts.find((c) => c.id === courtId)) });
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
  async setBan(userId, days, reason = '') {
    const u = this.user(userId); u.bannedUntil = days ? addHours(nowIso(), days * 24) : null; u.banReason = days ? reason : ''; this.save();
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
  async worldNews() { return []; } // world news come from the server only
  async deleteNews(id) { this.db.news = this.db.news.filter((n) => n.id !== id); this.save(); }
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
  // ---------- coach requests ----------
  async coachRequest(d) {
    this.db.coachRequests = this.db.coachRequests || [];
    if (this.db.coachRequests.some((r) => r.phone === d.phone && r.status === 'new')) throw new Error('Заявка с этим номером уже отправлена — администратор свяжется с вами');
    const docs = [];
    for (const f of d.docs || []) docs.push(await new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(f); }));
    this.db.coachRequests.unshift({ id: uid(), ...d, docs, status: 'new', createdAt: nowIso() }); this.save();
  }
  async coachDocUrls(paths) { return paths || []; }
  async setCoach(userId, { region, pro }) {
    const u = this.db.users.find((x) => x.id === userId); if (!u || u.role !== 'coach') throw new Error('Тренер не найден');
    if (region) u.region = region; if (pro !== undefined && pro !== null) u.coachPro = !!pro; this.save();
  }
  async courts(region) { return clone(this.db.courts.filter((c) => (!region || c.region === region) && (c.active || this.me()?.role === 'admin'))); }
  async saveCourt(c) {
    if (c.id) Object.assign(this.db.courts.find((x) => x.id === c.id), c);
    else this.db.courts.push({ indoor: false, lights: false, phone: '', price: '', note: '', checked: true, active: true, ...c, id: uid() });
    this.save();
  }

  // ---------- court accounts and booking (same rules as supabase/update-12.sql) ----------
  bk() { this.db.bookings = this.db.bookings || []; this.db.bookings.forEach((b) => { if (b.status === 'await_pay' && b.holdUntil && new Date(b.holdUntil) < new Date()) b.status = 'expired'; }); return this.db.bookings; }
  ownerOf(courtId) { const c = this.db.courts.find((x) => x.id === courtId); return c && c.ownerId === this.db.meId; }
  async courtRequest(d) {
    this.db.courtRequests = this.db.courtRequests || [];
    if (this.db.courtRequests.some((r) => r.phone === d.phone && r.status === 'new')) throw new Error('Заявка с этим номером уже отправлена — администратор свяжется с вами');
    const docs = [];
    for (const f of d.docs || []) docs.push(await new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(f); }));
    this.db.courtRequests.unshift({ id: uid(), ...d, docs, status: 'new', courtId: null, createdAt: nowIso() }); this.save();
  }
  async courtRequests() { return clone(this.db.courtRequests || []); }
  async resolveCourtRequest(id, approve, courtId = null) {
    const r = (this.db.courtRequests || []).find((x) => x.id === id);
    if (!r || r.status !== 'new') throw new Error('Заявка не найдена');
    if (!approve) { r.status = 'rejected'; this.save(); return null; }
    const cid = courtId || r.claimCourt;
    let c = cid ? this.db.courts.find((x) => x.id === cid) : null;
    if (c && c.lat == null && r.lat != null) Object.assign(c, { lat: r.lat, lng: r.lng });
    if (!c) { c = { id: uid(), region: r.region, city: r.city || '', name: r.venueName, address: r.address || '', lat: r.lat ?? null, lng: r.lng ?? null, courts: r.courtsCount || 1, surface: '', indoor: false, lights: false, phone: '+' + r.phone, price: '', note: '', checked: true, active: true }; this.db.courts.push(c); }
    let u = this.db.users.find((x) => x.phone && x.phone.replace(/\D/g, '') === r.phone.replace(/\D/g, ''));
    if (!u) { u = newPlayer({ phone: '+' + r.phone, firstName: r.ownerName.split(' ')[0] || r.ownerName, lastName: r.ownerName.split(' ').slice(1).join(' '), region: r.region }); this.db.users.push(u); }
    this.db.courts.forEach((x) => { if (x.ownerId === u.id) x.ownerId = null; });
    Object.assign(c, { ownerId: u.id, verified: true, checked: true, active: true });
    u.role = 'court'; r.status = 'approved'; r.courtId = c.id; this.save(); return c.id;
  }
  async court(id) { return clone(this.db.courts.find((c) => c.id === id) || null); }
  async courtReviews(courtId) { return clone((this.db.courtReviews || []).filter((r) => r.courtId === courtId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))); }
  async myCourt() { const c = this.db.courts.find((x) => x.ownerId === this.db.meId); return c ? clone({ cardNumber: '', cardHolder: '', ...c }) : null; }
  async saveMyCourt(d) {
    const c = this.db.courts.find((x) => x.ownerId === this.db.meId); if (!c) throw new Error('У вас нет корта');
    if (d.bookingOn) {
      if (!(d.priceRules || []).length) throw new Error('Чтобы включить бронь, укажите цены');
      if (!(d.photos?.court || []).length) throw new Error('Чтобы включить бронь, добавьте хотя бы одно фото корта');
      if (!d.phone) throw new Error('Чтобы включить бронь, укажите телефон корта');
    }
    if (d.openMin >= d.closeMin) throw new Error('Проверьте часы работы');
    for (const r of d.priceRules || []) if (!(r.f < r.t && r.f % 30 === 0 && r.t % 30 === 0 && r.p >= 0)) throw new Error('Проверьте цены: время с … до …, цена за час');
    const { id, ownerId, verified, checked, active, ratingSum, ratingCount, ...rest } = d;
    Object.assign(c, rest, { courts: Math.max(1, Math.min(60, +d.courts || 1)) }); this.save();
  }
  async uploadCourtPhoto(courtId, file) { return new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(file); }); }
  async courtBusy(courtId, day) {
    const a = Date.parse(tashIso(day, 0)), b = Date.parse(tashIso(day, 1440));
    return this.bk().filter((x) => x.courtId === courtId && ACTIVE_BOOKING.includes(x.status) && Date.parse(x.start) < b && Date.parse(x.end) > a).map((x) => ({ unit: x.unit, start: x.start, end: x.end }));
  }
  async bookCourt({ courtId, unit, start, minutes, pay }) {
    const me = this.me(); const c = this.db.courts.find((x) => x.id === courtId);
    if (!me || !['player', 'coach'].includes(me.role)) throw new Error('Бронировать корт может только игрок или тренер');
    if (!me.phone) throw new Error('Укажите номер телефона в профиле');
    if (!c || !c.bookingOn || !c.ownerId) throw new Error('Этот корт пока не принимает брони');
    if (unit < 1 || unit > c.courts) throw new Error('Нет такого корта');
    if (![60, 90, 120, 150, 180].includes(minutes)) throw new Error('Бронь — от 1 до 3 часов');
    if (Date.parse(start) < Date.now()) throw new Error('Это время уже прошло');
    if (pay === 'card' && !c.cardNumber) throw new Error('Корт пока не принимает предоплату картой — выберите наличные');
    const price = courtPrice(c, start, minutes); if (price === null) throw new Error('В это время корт не работает');
    const end = new Date(Date.parse(start) + minutes * 60e3).toISOString();
    if (this.bk().filter((x) => x.playerId === me.id && ['cash', 'await_pay', 'paid', 'confirmed'].includes(x.status) && Date.parse(x.end) > Date.now()).length >= 4) throw new Error('У вас уже 4 активные брони — сначала сыграйте или отмените одну');
    if (this.bk().some((x) => x.courtId === courtId && x.unit === unit && ACTIVE_BOOKING.includes(x.status) && Date.parse(x.start) < Date.parse(end) && Date.parse(x.end) > Date.parse(start))) throw new Error('Это время уже занято — выберите другое');
    const b = { id: uid(), courtId, unit, start: new Date(start).toISOString(), end, playerId: me.id, kind: 'app', pay, status: pay === 'card' ? 'await_pay' : 'cash', price,
      playerName: `${me.firstName} ${me.lastName}`.trim(), playerPhone: String(me.phone).replace(/\D/g, ''), note: '', receipt: '', holdUntil: pay === 'card' ? new Date(Date.now() + 30 * 60e3).toISOString() : null,
      noshow: false, cancelReason: '', cancelledBy: '', createdAt: nowIso() };
    this.db.bookings.push(b); this.save(); return b.id;
  }
  async payInfo(id) {
    const b = this.bk().find((x) => x.id === id); const c = this.db.courts.find((x) => x.id === b?.courtId); if (!b) throw new Error('Бронь не найдена');
    return { card: c.cardNumber || '', holder: c.cardHolder || '', price: b.price, holdUntil: b.holdUntil, phone: c.phone, court: c.name };
  }
  async attachReceipt(id, file) {
    const b = this.bk().find((x) => x.id === id && x.playerId === this.db.meId); if (!b) throw new Error('Бронь не найдена');
    if (b.status === 'expired') throw new Error('Время на оплату вышло (30 минут) — забронируйте снова');
    if (!['await_pay', 'paid'].includes(b.status)) throw new Error('Чек уже не нужен');
    b.receipt = await new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(file); });
    b.status = 'paid'; b.holdUntil = null; this.save();
  }
  async receiptUrl(path) { return path; }
  async myBookings() {
    const rv = new Set((this.db.courtReviews || []).map((r) => r.bookingId));
    return clone(this.bk().filter((b) => b.playerId === this.db.meId).sort((a, b) => b.start.localeCompare(a.start))
      .map((b) => ({ ...b, court: this.db.courts.find((c) => c.id === b.courtId), reviewed: rv.has(b.id) })));
  }
  async cancelBooking(id, reason = '') {
    const b = this.bk().find((x) => x.id === id); if (!b) throw new Error('Бронь не найдена');
    const byCourt = this.ownerOf(b.courtId) || this.me()?.role === 'admin';
    if (!byCourt && b.playerId !== this.db.meId) throw new Error('Нет доступа');
    if (!ACTIVE_BOOKING.includes(b.status)) throw new Error('Бронь уже не активна');
    const c = this.db.courts.find((x) => x.id === b.courtId);
    if (!byCourt && b.status !== 'await_pay' && Date.parse(b.start) - Date.now() < 12 * 3600e3) throw new Error(`Отменить можно не позднее чем за 12 часов до игры. Позвоните корту: ${c.phone}`);
    const prev = b.status; b.status = 'cancelled'; b.cancelledBy = byCourt && b.playerId !== this.db.meId ? 'court' : 'player'; b.cancelReason = reason || ''; this.save(); return prev;
  }
  async courtInbox(courtId) {
    if (!this.ownerOf(courtId) && this.me()?.role !== 'admin') throw new Error('Нет доступа');
    return clone(this.bk().filter((x) => x.courtId === courtId && ['paid', 'await_pay', 'cash'].includes(x.status) && Date.parse(x.end) > Date.now()).sort((a, b) => a.start.localeCompare(b.start)));
  }
  async courtDay(courtId, day) {
    if (!this.ownerOf(courtId) && this.me()?.role !== 'admin') throw new Error('Нет доступа');
    const a = Date.parse(tashIso(day, 0)), z = Date.parse(tashIso(day, 1440));
    return clone(this.bk().filter((x) => x.courtId === courtId && Date.parse(x.start) < z && Date.parse(x.end) > a).sort((x, y) => x.start.localeCompare(y.start) || x.unit - y.unit)
      .map((x) => ({ ...x, playerNoshows: this.bk().filter((y) => y.playerId && y.playerId === x.playerId && y.noshow).length })));
  }
  async courtAction(id, action, reason = '') {
    const b = this.bk().find((x) => x.id === id); if (!b || !(this.ownerOf(b.courtId) || this.me()?.role === 'admin')) throw new Error('Нет доступа');
    if (action === 'paid') { if (!['await_pay', 'paid', 'cash'].includes(b.status)) throw new Error('Бронь уже не активна'); b.status = 'confirmed'; b.holdUntil = null; }
    else if (action === 'decline') { if (b.kind !== 'app' || !['cash', 'await_pay', 'paid', 'confirmed'].includes(b.status)) throw new Error('Бронь уже не активна'); b.status = 'declined'; b.cancelledBy = 'court'; b.cancelReason = reason || ''; }
    else if (action === 'noshow') { if (Date.parse(b.start) > Date.now()) throw new Error('Отметить неявку можно после начала игры'); b.noshow = !b.noshow; }
    this.save();
  }
  async courtBlock({ courtId, unit, start, minutes, note }) {
    if (!this.ownerOf(courtId) && this.me()?.role !== 'admin') throw new Error('Нет доступа');
    const end = new Date(Date.parse(start) + minutes * 60e3).toISOString();
    if (this.bk().some((x) => x.courtId === courtId && x.unit === unit && ACTIVE_BOOKING.includes(x.status) && Date.parse(x.start) < Date.parse(end) && Date.parse(x.end) > Date.parse(start))) throw new Error('Это время уже занято');
    const b = { id: uid(), courtId, unit, start: new Date(start).toISOString(), end, playerId: null, kind: 'offline', pay: 'none', status: 'blocked', price: 0, playerName: '', playerPhone: '', note: note || '', receipt: '', holdUntil: null, noshow: false, cancelReason: '', cancelledBy: '', createdAt: nowIso() };
    this.db.bookings.push(b); this.save(); return b.id;
  }
  async reviewCourt(bookingId, stars, text) {
    const b = this.bk().find((x) => x.id === bookingId && x.playerId === this.db.meId); if (!b) throw new Error('Бронь не найдена');
    if (!['cash', 'confirmed'].includes(b.status) || b.noshow) throw new Error('Оценить можно только корт, где вы играли');
    if (Date.parse(b.end) > Date.now()) throw new Error('Оценить можно после игры');
    this.db.courtReviews = (this.db.courtReviews || []).filter((r) => r.bookingId !== bookingId);
    this.db.courtReviews.push({ id: uid(), courtId: b.courtId, bookingId, authorId: this.db.meId, stars, text: text || '', createdAt: nowIso() });
    const c = this.db.courts.find((x) => x.id === b.courtId); const rs = this.db.courtReviews.filter((r) => r.courtId === c.id);
    c.ratingSum = rs.reduce((s, r) => s + r.stars, 0); c.ratingCount = rs.length; this.save();
  }
  async pushKey() { throw new Error('В демо-режиме уведомления не отправляются'); }
  async savePushSub() {}
  async deletePushSub() {}
  async coachRequests() { return clone(this.db.coachRequests || []); }
  async resolveCoachRequest(id, approve, region = null) {
    const r = (this.db.coachRequests || []).find((x) => x.id === id);
    if (approve) {
      r.region = region || r.region;
      if (!r.region) throw new Error('Выберите область тренера');
      await this.inviteCoach({ phone: '+' + r.phone, firstName: r.firstName, lastName: r.lastName, region: r.region, pro: (r.docs || []).length > 0 });
    }
    r.status = approve ? 'approved' : 'rejected'; this.save();
  }
  async inviteCoach({ phone, firstName, lastName, region = '', pro = false }) {
    let u = this.db.users.find((x) => x.phone && x.phone.replace(/\D/g, '') === phone.replace(/\D/g, ''));
    if (!u) { u = newPlayer({ phone, firstName, lastName }); this.db.users.push(u); }
    if (region) u.region = region; if (pro) u.coachPro = true;
    u.role = 'coach'; u.coach = { verified: true, price: null, specialization: [], worksWith: '', experience: u.years || 0, ...(u.coach || {}) };
    this.save();
  }
  async stats(region = '') {
    const week = addHours(nowIso(), -24 * 7);
    const inR = (u) => u && (!region || (u.region || 'namangan') === region);
    const us = this.db.users.filter((u) => u.role !== 'admin');
    const byRegion = {}; us.forEach((u) => { const r = u.region || '-'; byRegion[r] = (byRegion[r] || 0) + 1; });
    return {
      players: us.filter((u) => u.role === 'player' && inR(u)).length,
      coaches: us.filter((u) => u.role === 'coach' && inR(u)).length,
      newWeek: us.filter((u) => inR(u) && u.createdAt >= week).length,
      banned: us.filter((u) => inR(u) && u.bannedUntil && new Date(u.bannedUntil) > new Date()).length,
      matchesWeek: this.db.matches.filter((m) => m.status === 'confirmed' && m.playedAt >= week && inR(this.user(m.createdBy))).length,
      trainingsWeek: this.db.trainings.filter((t) => t.status === 'confirmed' && t.playedAt >= week && inR(this.user(t.playerId))).length,
      active30: new Set(this.db.matches.filter((m) => m.playedAt >= addHours(nowIso(), -24 * 30)).flatMap((m) => [...m.teamA, ...m.teamB]).filter((id) => inR(this.user(id)))).size,
      openComplaints: this.db.complaints.filter((c) => c.status === 'open').length,
      disputes: this.db.matches.filter((m) => m.status === 'disputed').length,
      coachRequests: (this.db.coachRequests || []).filter((r) => r.status === 'new').length,
      support: new Set((this.db.support || []).filter((m) => !m.fromAdmin && !m.readAt).map((m) => m.userId)).size,
      byRegion,
    };
  }
  async findByNo(no) { const n = Number(String(no || '').replace(/\D/g, '')); return clone(this.db.users.find((u) => Number(u.playerNo) === n) || null); }
  async adminUsers({ region = '', role = '', q = '', filter = '', offset = 0, limit = 50 } = {}) {
    const needle = String(q || '').trim().toLowerCase(); const no = /^#?\d+$/.test(needle) ? Number(needle.replace('#', '')) : null;
    const list = this.db.users.filter((u) => u.role !== 'admin' && (!region || (u.region || '') === region) && (!role || u.role === role)
      && (filter !== 'banned' || (u.bannedUntil && new Date(u.bannedUntil) > new Date()))
      && (!needle || (no ? Number(u.playerNo) === no : `${u.firstName} ${u.lastName}`.toLowerCase().includes(needle))))
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    return { total: list.length, rows: clone(list.slice(offset, offset + limit)).map((u) => ({ ...u, email: '' })) };
  }
  async adminExport(o = {}) {
    return (await this.adminUsers({ ...o, limit: 100000 })).rows.map((u) => ({ id: u.id, player_no: u.playerNo, role: u.role, first_name: u.firstName, last_name: u.lastName,
      region: u.region, district: u.district, league: u.league, rating: u.rating, matches: u.matches, banned_until: u.bannedUntil, created_at: u.createdAt, phone: u.phone, email: '' }));
  }
  // ---------- support chat ----------
  sup() { this.db.support = this.db.support || []; return this.db.support; }
  async supportMine() { const id = this.db.meId; return clone(this.sup().filter((m) => m.userId === id)); }
  async supportUnread() { const id = this.db.meId; return this.sup().filter((m) => m.userId === id && m.fromAdmin && !m.readAt).length; }
  async supportSend(text) { this.sup().push({ id: uid(), userId: this.db.meId, fromAdmin: false, text, createdAt: nowIso(), readAt: null }); this.save(); }
  async supportReply(userId, text) { this.sup().push({ id: uid(), userId, fromAdmin: true, text, createdAt: nowIso(), readAt: null }); this.save(); }
  async supportRead(userId = null) {
    const me = this.me();
    this.sup().forEach((m) => { if (userId && me.role === 'admin' ? (m.userId === userId && !m.fromAdmin) : (m.userId === me.id && m.fromAdmin)) m.readAt = m.readAt || nowIso(); });
    this.save();
  }
  async supportThreads() {
    const by = {};
    for (const m of this.sup()) { const t = by[m.userId] || (by[m.userId] = { userId: m.userId, unread: 0 }); t.lastText = m.text; t.lastFromAdmin = m.fromAdmin; t.lastAt = m.createdAt; if (!m.fromAdmin && !m.readAt) t.unread++; }
    return Object.values(by).sort((a, b) => (b.unread > 0) - (a.unread > 0) || b.lastAt.localeCompare(a.lastAt));
  }
  async supportThread(userId) { return clone(this.sup().filter((m) => m.userId === userId)); }
}
