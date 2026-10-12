// Ace Tennis — rating logic (single source of truth, mirrored in supabase/schema.sql)

export const START_RATING = 1000;

// K factor: faster movement for the first 10 matches
export function kFactor(matchesPlayed) {
  return matchesPlayed < 10 ? 32 : 16;
}

// Expected score of A against B (0..1)
export function expected(ratingA, ratingB) {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

// Rating change for one player. score: 1 win, 0 loss
export function eloDelta(own, opponent, score, matchesPlayed) {
  return Math.round(kFactor(matchesPlayed) * (score - expected(own, opponent)));
}

// Strength level (УС): 1.0 + (rating − 700) / 200, clamped 1.0..7.0, one decimal
export function strength(rating) {
  const v = 1 + (rating - 700) / 200;
  return Math.round(Math.min(7, Math.max(1, v)) * 10) / 10;
}

export function formatStrength(rating) {
  return strength(rating).toFixed(1).replace('.', ',');
}

export const LEAGUES = [
  { id: 'novice', ru: 'Новички', uz: 'Yangi boshlovchilar', min: null },
  { id: 'bronze', ru: 'Бронза', uz: 'Bronza', min: 0 },
  { id: 'silver', ru: 'Серебро', uz: 'Kumush', min: 950 },
  { id: 'gold', ru: 'Золото', uz: 'Oltin', min: 1050 },
  { id: 'masters', ru: 'Мастерс', uz: 'Masters', min: 1150 },
];

// League by rating; first 5 matches = novice
export function leagueFor(rating, matchesPlayed) {
  if (matchesPlayed < 5) return 'novice';
  if (rating >= 1150) return 'masters';
  if (rating >= 1050) return 'gold';
  if (rating >= 950) return 'silver';
  return 'bronze';
}

export function leagueRank(id) {
  return LEAGUES.findIndex((l) => l.id === id);
}

// Season points for one player in one match
// Base 10 for playing, +20 for a win, +15 bonus for beating a higher league, ×2 in tournaments
export function seasonPoints({ won, beatHigherLeague = false, tournament = false, farmed = false }) {
  if (farmed) return 0; // more than 2 matches with the same opponent in a month
  let p = 10;
  if (won) p += 20;
  if (won && beatHigherLeague) p += 15;
  return tournament ? p * 2 : p;
}

export const TOURNAMENT_BONUS = { winner: 100, finalist: 60 };

// Sets: [[6,4],[3,6],[10,8]] from team A perspective → 'A' | 'B' | null
export function winnerFromSets(sets) {
  let a = 0, b = 0;
  for (const [x, y] of sets) {
    if (x > y) a++;
    else if (y > x) b++;
  }
  if (a === b) return null;
  return a > b ? 'A' : 'B';
}

export function formatSets(sets) {
  return sets.map(([x, y]) => `${x}:${y}`).join(' ');
}

// Apply a confirmed match to players. players: map id → {rating, matches}
// Returns { [id]: { delta, newRating, won } }
export function applyMatch({ teamA, teamB, winner }, players) {
  const avg = (ids) => ids.reduce((s, id) => s + players[id].rating, 0) / ids.length;
  const ra = avg(teamA), rb = avg(teamB);
  const out = {};
  for (const id of teamA) {
    const won = winner === 'A';
    const d = eloDelta(ra, rb, won ? 1 : 0, players[id].matches);
    out[id] = { delta: d, newRating: players[id].rating + d, won };
  }
  for (const id of teamB) {
    const won = winner === 'B';
    const d = eloDelta(rb, ra, won ? 1 : 0, players[id].matches);
    out[id] = { delta: d, newRating: players[id].rating + d, won };
  }
  return out;
}

// Last-5 form string, newest first: 'ВВПВП'
export function pushForm(form, won) {
  return ((won ? 'В' : 'П') + (form || '')).slice(0, 5);
}

export function fairplay(sum, count) {
  if (!count) return null;
  return Math.round((sum / count) * 10) / 10;
}

export const FAIRPLAY_MIN_FOR_TOURNAMENT = 3.5;

export function quarterKey(date = new Date()) {
  const d = new Date(date);
  return `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`;
}

export function yearKey(date = new Date()) {
  return String(new Date(date).getFullYear());
}

export const CONFIRM_HOURS = 48;
