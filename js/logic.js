// Business rules shared by the demo store (mirrored in supabase/schema.sql for the real server)
import {
  applyMatch, winnerFromSets, seasonPoints, pushForm, leagueFor, leagueRank,
  seasonKey, yearKey, CONFIRM_HOURS, START_RATING,
} from './rating.js';

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
export const nowIso = () => new Date().toISOString();
export const addHours = (iso, h) => new Date(new Date(iso).getTime() + h * 3600e3).toISOString();

export function newPlayer(p) {
  return {
    id: uid(), role: 'player', firstName: '', lastName: '', photo: null, gender: '', birthYear: null,
    region: '', district: '', years: 0, selfLevel: '', hand: '', availability: [], phone: '',
    rating: START_RATING, matches: 0, wins: 0, form: '', league: 'novice',
    pointsQ: 0, pointsY: 0, qKey: seasonKey(), yKey: yearKey(),
    fpSum: 0, fpCount: 0, bannedUntil: null, top10Days: 0, top1Days: 0,
    coach: null, createdAt: nowIso(), ...p,
  };
}

// Who must confirm a match: the opposing side of the creator
export function confirmersOf(match) {
  return match.teamA.includes(match.createdBy) ? match.teamB : match.teamA;
}

export function involves(match, userId) {
  return match.teamA.includes(userId) || match.teamB.includes(userId);
}

function monthKey(iso) { const d = new Date(iso); return `${d.getFullYear()}-${d.getMonth()}`; }

// Mutates db: applies a confirmed match to every player
export function confirmMatch(db, match, byUserId) {
  const winner = winnerFromSets(match.sets);
  const ids = [...match.teamA, ...match.teamB];
  const players = Object.fromEntries(ids.map((id) => {
    const u = db.users.find((x) => x.id === id);
    return [id, { rating: u.rating, matches: u.matches }];
  }));
  const res = applyMatch({ teamA: match.teamA, teamB: match.teamB, winner }, players);
  const month = monthKey(match.playedAt);
  const leagueOfSide = (side) => Math.max(...side.map((id) => leagueRank(db.users.find((x) => x.id === id).league)));
  const rankA = leagueOfSide(match.teamA), rankB = leagueOfSide(match.teamB);
  match.deltas = {}; match.points = {};
  for (const id of ids) {
    const u = db.users.find((x) => x.id === id);
    const onA = match.teamA.includes(id);
    const opp = onA ? match.teamB : match.teamA;
    const sameOppThisMonth = db.matches.filter((m) => m.status === 'confirmed' && m.id !== match.id &&
      monthKey(m.playedAt) === month && involves(m, id) && opp.some((o) => involves(m, o))).length;
    const ownRank = leagueRank(u.league);
    const pts = seasonPoints({
      won: res[id].won,
      beatHigherLeague: (onA ? rankB : rankA) > ownRank,
      tournament: !!match.tournamentId,
      farmed: sameOppThisMonth >= 2,
    });
    rollSeason(u);
    u.rating = res[id].newRating;
    u.matches += 1;
    if (res[id].won) u.wins += 1;
    u.form = pushForm(u.form, res[id].won);
    u.pointsQ += pts; u.pointsY += pts;
    if (u.league === 'novice' && u.matches >= 5) u.league = leagueFor(u.rating, u.matches);
    match.deltas[id] = res[id].delta; match.points[id] = pts;
    grantMatchAchievements(db, u, res[id].won && (onA ? rankB : rankA) > ownRank);
  }
  match.winner = winner;
  match.status = 'confirmed';
  match.confirmedBy = byUserId;
  match.confirmedAt = nowIso();
}

function grant(db, userId, code, title, detail = '') {
  if (db.achievements.some((a) => a.userId === userId && a.code === code && a.detail === detail)) return;
  db.achievements.push({ id: uid(), userId, code, title, detail, createdAt: nowIso() });
}

function grantMatchAchievements(db, u, beatHigher) {
  if (u.form.startsWith('ВВВВВ')) grant(db, u.id, 'streak5', 'Серия 5 побед');
  if (u.wins >= 10 && u.form.startsWith('ВВВВВ') && streakLen(db, u.id) >= 10) grant(db, u.id, 'streak10', 'Серия 10 побед');
  for (const n of [10, 50, 100]) if (u.matches === n) grant(db, u.id, `matches${n}`, `${n} матчей`);
  if (beatHigher) grant(db, u.id, 'giant', 'Победа над лигой выше');
}

function streakLen(db, userId) {
  const ms = db.matches.filter((m) => m.status === 'confirmed' && involves(m, userId))
    .sort((a, b) => b.playedAt.localeCompare(a.playedAt));
  let n = 0;
  for (const m of ms) {
    const onA = m.teamA.includes(userId);
    if ((m.winner === 'A') === onA) n++; else break;
  }
  return n;
}

// Season rollover for a single user (points reset, league recalculated each season)
export function rollSeason(u) {
  const q = seasonKey(), y = yearKey();
  if (u.qKey !== q) { u.pointsQ = 0; u.qKey = q; if (u.matches >= 5) u.league = leagueFor(u.rating, u.matches); }
  if (u.yKey !== y) { u.pointsY = 0; u.yKey = y; }
}

// Pending records past 48h are cancelled
export function expirePending(db) {
  const now = nowIso();
  for (const list of [db.matches, db.trainings]) {
    for (const r of list) {
      if (r.status === 'pending' && r.deadline < now) { r.status = 'cancelled'; r.expired = true; }
    }
  }
}

export function pendingFor(db, userId) {
  const m = db.matches.filter((x) => x.status === 'pending' && confirmersOf(x).includes(userId));
  const t = db.trainings.filter((x) => x.status === 'pending' && x.coachId === userId);
  return { matches: m, trainings: t, count: m.length + t.length };
}

export function newMatch({ type, teamA, teamB, sets, decider, playedAt, createdBy, tournamentId = null, round = null }) {
  const createdAt = nowIso();
  return {
    id: uid(), type, teamA, teamB, sets, decider, playedAt, createdBy, tournamentId, round,
    status: 'pending', createdAt, deadline: addHours(createdAt, CONFIRM_HOURS), deltas: {}, points: {},
  };
}

export function newTraining({ playerId, coachId, hours, skills, note, playedAt }) {
  const createdAt = nowIso();
  return {
    id: uid(), playerId, coachId: coachId || null, hours, skills, note, playedAt, createdAt,
    status: coachId ? 'pending' : 'confirmed', deadline: addHours(createdAt, CONFIRM_HOURS),
  };
}

// Complaints → automatic bans: 2 accepted in 30 days → 7 days; 2 more after a ban → 30 days
export function applySanctions(db, userId) {
  const since = new Date(Date.now() - 30 * 864e5).toISOString();
  const accepted = db.complaints.filter((c) => c.targetId === userId && c.status === 'accepted' && c.resolvedAt >= since);
  const u = db.users.find((x) => x.id === userId);
  if (accepted.length >= 4) u.bannedUntil = addHours(nowIso(), 30 * 24);
  else if (accepted.length >= 2) u.bannedUntil = addHours(nowIso(), 7 * 24);
  if (accepted.length) { u.fpSum += 1; u.fpCount += 1; } // a confirmed complaint counts as a 1-star rating
}

// Tournament bracket for 8 players seeded by rating: 1v8, 4v5, 3v6, 2v7
export function makeBracket(entryIds, users) {
  const seeded = [...entryIds].sort((a, b) => users.find((u) => u.id === b).rating - users.find((u) => u.id === a).rating);
  const pairs = [[0, 7], [3, 4], [2, 5], [1, 6]];
  return {
    qf: pairs.map(([i, j]) => ({ a: seeded[i], b: seeded[j], winner: null, matchId: null })),
    sf: [{ a: null, b: null, winner: null, matchId: null }, { a: null, b: null, winner: null, matchId: null }],
    final: { a: null, b: null, winner: null, matchId: null },
    cons: [{ a: null, b: null, winner: null, matchId: null }, { a: null, b: null, winner: null, matchId: null }],
  };
}

// Feed a confirmed tournament match into the bracket
export function advanceBracket(t, match) {
  const b = t.bracket;
  const winnerId = match.winner === 'A' ? match.teamA[0] : match.teamB[0];
  const loserId = match.winner === 'A' ? match.teamB[0] : match.teamA[0];
  const slot = [...b.qf, ...b.sf, b.final, ...b.cons].find((s) => s.matchId === match.id);
  if (!slot) return;
  slot.winner = winnerId;
  const qi = b.qf.indexOf(slot);
  if (qi >= 0) {
    const sf = b.sf[Math.floor(qi / 2)];
    sf[qi % 2 === 0 ? 'a' : 'b'] = winnerId;
    const cons = b.cons[Math.floor(qi / 2)];
    cons[qi % 2 === 0 ? 'a' : 'b'] = loserId;
  }
  const si = b.sf.indexOf(slot);
  if (si >= 0) b.final[si === 0 ? 'a' : 'b'] = winnerId;
  if (slot === b.final) t.status = 'finished';
}

// ---------- court booking: Tashkent time (UTC+5, no summer time) and prices ----------
export const TZ_MIN = 5 * 60;
// ISO → { date: 'YYYY-MM-DD', min: minutes from midnight, dow: 1 (Mon) … 7 (Sun) } in Tashkent time
export function tashLocal(iso) {
  const d = new Date(new Date(iso).getTime() + TZ_MIN * 60e3);
  return { date: d.toISOString().slice(0, 10), min: d.getUTCHours() * 60 + d.getUTCMinutes(), dow: d.getUTCDay() || 7 };
}
// 'YYYY-MM-DD' + minutes in Tashkent → ISO (UTC)
export const tashIso = (date, min) => new Date(Date.parse(`${date}T00:00:00Z`) + (min - TZ_MIN) * 60e3).toISOString();
export const tashToday = () => tashLocal(new Date().toISOString()).date;
export const addDays = (date, n) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
// Price of [start, start+minutes) by the court's rules, same as court_price() in the database. null = closed / no price.
export function courtPrice(c, startIso, minutes) {
  let total = 0;
  for (let k = 0; k < minutes; k += 30) {
    const { min, dow } = tashLocal(new Date(new Date(startIso).getTime() + k * 60e3).toISOString());
    if (min < c.openMin || min + 30 > c.closeMin) return null;
    let p = null;
    for (const r of c.priceRules || []) {
      const day = r.d === 'all' || (r.d === 'wd' && dow <= 5) || (r.d === 'we' && dow >= 6);
      if (day && min >= r.f && min + 30 <= r.t && (p === null || r.d !== 'all')) p = +r.p;
    }
    if (p === null) return null;
    total += p / 2;
  }
  return Math.round(total);
}
export const ACTIVE_BOOKING = ['cash', 'await_pay', 'paid', 'confirmed', 'blocked'];
