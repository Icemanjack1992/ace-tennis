// Real store: Supabase (PostgreSQL + phone auth). Same interface as DemoStore.
// Heavy rules (rating, points, bracket, sanctions) run inside the database — see supabase/schema.sql.
import { fairplay, FAIRPLAY_MIN_FOR_TOURNAMENT } from './rating.js';
import { L } from './ui.js';

const toUser = (r) => r && ({
  id: r.id, role: r.role, firstName: r.first_name, lastName: r.last_name, photo: r.photo_url, gender: r.gender,
  birthYear: r.birth_year, region: r.region || '', district: r.district, years: r.years, selfLevel: r.self_level, hand: r.hand,
  availability: r.availability || [], phone: r.phone, rating: r.rating, matches: r.matches, wins: r.wins,
  form: r.form, league: r.league, pointsQ: r.points_q, pointsY: r.points_y, fpSum: Number(r.fp_sum),
  fpCount: r.fp_count, bannedUntil: r.banned_until, top10Days: r.top10_days, top1Days: r.top1_days,
  coachPro: !!r.coach_pro,
  coach: r.role === 'coach' ? { verified: r.coach_verified, price: null, specialization: [], worksWith: '', experience: r.years, ...(r.coach || {}) } : null,
  lang: r.lang, createdAt: r.created_at, termsVer: r.terms_ver || '', playerNo: r.player_no || null, banReason: r.ban_reason || '', updatedAt: r.updated_at || null,
});
const fromUser = (p) => {
  const map = { firstName: 'first_name', lastName: 'last_name', photo: 'photo_url', gender: 'gender', birthYear: 'birth_year',
    region: 'region', district: 'district', years: 'years', selfLevel: 'self_level', hand: 'hand', availability: 'availability', lang: 'lang' };
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
  disputeReason: r.dispute_reason, createdAt: r.created_at, courtId: r.court_id || null, court: r.court || null,
});
// Courts: the joined court of a match / challenge (name, city, point on the map)
const MATCH_COLS = '*, court:courts(id,name,city,lat,lng)';
const toCourt = (r) => ({ id: r.id, region: r.region, city: r.city || '', name: r.name, address: r.address || '', lat: r.lat, lng: r.lng, courts: r.courts_count || 1,
  surface: r.surface || '', indoor: !!r.indoor, lights: !!r.lights, phone: r.phone || '', price: r.price || '', note: r.note || '', checked: !!r.checked, active: r.active !== false,
  ownerId: r.owner_id || null, verified: !!r.verified, amenities: r.amenities || [], photos: { court: [], shower: [], locker: [], ...(r.photos || {}) },
  openMin: r.open_min ?? 420, closeMin: r.close_min ?? 1380, priceRules: r.price_rules || [], bookingOn: !!r.booking_on, description: r.description || '',
  ratingSum: r.rating_sum || 0, ratingCount: r.rating_count || 0 });
const COURT_COLS = 'id,region,city,name,address,lat,lng,courts_count,surface,indoor,lights,phone,price,note,checked,active,owner_id,verified,amenities,photos,open_min,close_min,price_rules,booking_on,description,rating_sum,rating_count';
const toBooking = (r) => r && ({ id: r.id, courtId: r.court_id, unit: r.unit, start: r.starts_at, end: r.ends_at, playerId: r.player_id, kind: r.kind, pay: r.pay,
  status: r.status, price: r.price, playerName: r.player_name || '', playerPhone: r.player_phone || '', note: r.note || '', receipt: r.receipt_path || '',
  holdUntil: r.hold_until, noshow: !!r.noshow, cancelReason: r.cancel_reason || '', cancelledBy: r.cancelled_by || '', createdAt: r.created_at,
  playerNoshows: r.player_noshows ?? 0, court: r.court ? toCourt(r.court) : null, reviewed: !!(r.review && r.review.length) });
const fileId = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(36).slice(2));
const fromCourt = (c) => ({ region: c.region, city: c.city || '', name: c.name, address: c.address || '', lat: c.lat ?? null, lng: c.lng ?? null, courts_count: +c.courts || 1,
  surface: c.surface || '', indoor: !!c.indoor, lights: !!c.lights, phone: c.phone || '', price: c.price || '', note: c.note || '', checked: c.checked !== false, active: c.active !== false,
  ...(c.verified !== undefined ? { verified: !!c.verified } : {}) });
const toTraining = (r) => ({
  id: r.id, playerId: r.player_id, coachId: r.coach_id, hours: Number(r.hours), skills: r.skills, note: r.note,
  playedAt: r.played_at, status: r.status, deadline: r.deadline, createdAt: r.created_at,
});
const toTournament = (r, entries = []) => ({
  id: r.id, name: r.name, league: r.league, startsAt: r.starts_at, endsAt: r.ends_at, sponsor: r.sponsor,
  status: r.status, bracket: r.bracket, createdAt: r.created_at, kind: r.kind || 'cup', seasonKey: r.season_key || '', region: r.region || 'namangan',
  entries: entries.filter((e) => e.tournament_id === r.id).map((e) => ({ userId: e.user_id, status: e.status })),
});
// Phone numbers are not readable by other users (supabase/update-02.sql)
const PROFILE_COLS = 'id,role,first_name,last_name,photo_url,gender,birth_year,region,district,years,self_level,hand,availability,rating,matches,wins,form,league,points_q,points_y,q_key,y_key,fp_sum,fp_count,banned_until,top10_days,top1_days,coach_verified,coach,lang,created_at,tg_username,terms_ver,player_no,ban_reason,updated_at,coach_pro';
// Supabase auth messages → Russian
function authError(m = '') {
  if (/invalid login credentials/i.test(m)) return 'Неверная почта или пароль';
  if (/already registered|already been registered|already exists/i.test(m)) return 'Эта почта уже зарегистрирована — нажмите «Вход»';
  if (/password should be at least|weak password|password.*characters/i.test(m)) return 'Пароль слишком простой: минимум 6 символов';
  if (/valid email|invalid.*email|unable to validate email/i.test(m)) return 'Проверьте адрес почты';
  if (/email not confirmed/i.test(m)) return 'Почта не подтверждена — откройте письмо от Supabase';
  if (/rate limit|too many/i.test(m)) return 'Слишком много попыток, подождите минуту';
  if (/signups not allowed|signup.*disabled/i.test(m)) return 'Регистрация по почте выключена в настройках Supabase';
  if (/not authorized|sending.*email|error sending/i.test(m)) return 'Отправка писем пока не настроена — напишите администратору Ace Tennis';
  if (/expired|invalid.*(token|otp)|token.*invalid/i.test(m)) return 'Неверный или устаревший код. Запросите новый';
  if (/only request this after|security purposes/i.test(m)) return 'Подождите минуту и запросите код снова';
  if (/should be different|same.*password/i.test(m)) return 'Новый пароль должен отличаться от старого';
  return m;
}
const check = ({ data, error }) => { if (error) throw new Error(error.message); return data; };

// Speed: read queries are cached for a short time, so going back and forth between screens is instant.
// Any change (match, challenge, profile…) clears the cache.
const QUERY_TTL = 30e3;      // lists: ranking, news, tournaments…
const USERS_TTL = 3 * 60e3;  // profiles of my region: only changes are downloaded (delta)
const FULL_TTL = 24 * 3600e3; // once a day the region list is downloaded in full
const PENDING_TTL = 30e3;    // "waiting for my confirmation" gate
const CACHED = ['adminContacts', 'adminUsers', 'supportThreads', 'supportThread', 'supportMine', 'supportUnread', 'coachRequests', 'contacts', 'ranking', 'leaders', 'fairplayRanking', 'achievements', 'suggestOpponent', 'challenges', 'outgoing', 'history',
  'coachStats', 'canReview', 'courts', 'court', 'courtReviews', 'courtRequests', 'myCourt', 'adminCoachStats', 'adminCourtStats', 'coachRanking', 'ratedFairplay', 'complaints', 'disputes', 'tournaments', 'tournament', 'news', 'worldNews', 'stats'];
const MUTATIONS = ['saveCourt', 'setCoach', 'supportSend', 'supportReply', 'supportRead', 'resolveCoachRequest', 'sharePhone', 'saveProfile', 'createMatch', 'createTraining', 'confirm', 'dispute', 'cancelOwn', 'createChallenge', 'answerChallenge',
  'addReview', 'rateFairplay', 'complain', 'resolveComplaint', 'resolveDispute', 'setBan', 'applyTournament', 'createTournament',
  'approveEntry', 'startTournament', 'createTournamentMatch', 'addNews', 'deleteNews', 'addComment', 'hideComment', 'inviteCoach',
  'resolveCourtRequest', 'saveMyCourt', 'bookCourt', 'attachReceipt', 'cancelBooking', 'courtAction', 'courtBlock', 'reviewCourt', 'adminDeleteAccount', 'adminDeleteCourt'];
// These change ratings / profiles, so the profile list is reloaded too
const PROFILE_MUTATIONS = new Set(['setCoach', 'resolveCoachRequest', 'resolveCourtRequest', 'saveProfile', 'confirm', 'rateFairplay', 'resolveComplaint', 'resolveDispute', 'setBan', 'createTournamentMatch', 'inviteCoach', 'adminDeleteAccount', 'adminDeleteCourt']);
// Telegram login nonce lives 15 minutes; localStorage survives iPhone reloading the app while you are in Telegram
const TG_KEY = 'ace_tg_login';
const tgRead = () => { try { const v = JSON.parse(localStorage.getItem(TG_KEY) || 'null'); return v && Date.now() - v.t < 15 * 60e3 ? v : null; } catch { return null; } };
const tgWrite = (v) => { try { v ? localStorage.setItem(TG_KEY, JSON.stringify(v)) : localStorage.removeItem(TG_KEY); } catch { /* ignore */ } };

// Instant start: the last data is kept on the phone. The app opens with it at once,
// then fresh data comes in the background and the screen updates quietly.
const SNAP_KEY = 'ace_snap_v1';
const snapRead = () => { try { return JSON.parse(localStorage.getItem(SNAP_KEY) || 'null'); } catch { return null; } };
const snapClear = () => { try { localStorage.removeItem(SNAP_KEY); } catch { /* ignore */ } };
const LIB = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
const SYNC = new Set(['constructor', 'accounts', 'init', 'refresh', 'memo', 'invalidate', 'me', 'user', 'uid', 'pendingPeek', 'telegramNonce',
  'telegramPending', 'telegramClicked', 'notify', 'changed', 'saveSnap', 'listUsers', 'newsItem', 'setUsers', 'addUsers', 'myRegion']);

// Saved logins for switching accounts (only on this phone): [{id, email, name, role, at, rt}]
const ACC_KEY = 'ace_accounts';
const accList = () => { try { return JSON.parse(localStorage.getItem(ACC_KEY) || '[]'); } catch { return []; } };
const accWrite = (l) => { try { localStorage.setItem(ACC_KEY, JSON.stringify(l)); } catch { /* storage is off */ } };
const accUpsert = (info, ses) => { const l = accList().filter((a) => a.id !== info.id); l.push({ ...info, at: ses.access_token, rt: ses.refresh_token }); accWrite(l); };
const accRemove = (id) => accWrite(accList().filter((a) => a.id !== id));
function accSaveTokens(ses, me) {
  const l = accList(); const a = l.find((x) => x.id === ses.user?.id); if (!a) return;
  a.at = ses.access_token; a.rt = ses.refresh_token;
  if (me) { a.name = [me.firstName, me.lastName].filter(Boolean).join(' '); a.role = me.role; }
  accWrite(l);
}

export class SupabaseStore {
  constructor(url, key) {
    this.mode = 'live'; this.url = url; this.key = key; this.users = []; this.byId = new Map(); this.meCache = null;
    this.usersAt = 0; this.syncAt = null; this.fullAt = 0; this.syncRegion = null; this.cache = new Map(); this.pendingLast = null;
    // Load the Supabase library right away, in parallel with everything else
    this.ready = import(LIB).then(({ createClient }) => {
      this.sbFactory = createClient;
      this.sb = createClient(url, key, { auth: { persistSession: true } });
      // keep the saved copy of this account's login fresh (the token changes about once an hour)
      this.sb.auth.onAuthStateChange((ev, ses) => { if (ses && (ev === 'TOKEN_REFRESHED' || ev === 'SIGNED_IN')) accSaveTokens(ses); });
    });
    // Every request waits for the library (only the very first moment after start)
    for (const name of Object.getOwnPropertyNames(SupabaseStore.prototype)) {
      if (SYNC.has(name)) continue;
      const fn = this[name];
      if (typeof fn === 'function') this[name] = async (...args) => { await this.ready; return fn.apply(this, args); };
    }
    for (const name of CACHED) {
      const fn = this[name];
      this[name] = (...args) => this.memo(`${name}:${JSON.stringify(args)}`, QUERY_TTL, () => fn.apply(this, args));
    }
    for (const name of MUTATIONS) {
      const fn = this[name];
      this[name] = async (...args) => {
        try { return await fn.apply(this, args); } finally {
          this.cache.clear(); this.pendingLast = null;
          if (PROFILE_MUTATIONS.has(name)) this.usersAt = 0;
        }
      };
    }
  }
  // Cached read. Old data is returned at once and refreshed in the background ("stale while revalidate").
  memo(key, ttl, fn) {
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.t < ttl) return hit.p;
    if (hit && hit.done) {
      if (!hit.busy) {
        hit.busy = true;
        fn().then((v) => {
          if (this.cache.get(key) !== hit) return;
          this.cache.set(key, { t: Date.now(), p: Promise.resolve(v), v, done: true });
          if (JSON.stringify(v) !== JSON.stringify(hit.v)) this.changed(); else this.saveSnap();
        }).catch(() => { hit.busy = false; });
      }
      return hit.p;
    }
    const entry = { t: Date.now(), p: null, v: undefined, done: false };
    entry.p = fn();
    entry.p.then((v) => { entry.v = v; entry.done = true; this.saveSnap(); },
      () => { if (this.cache.get(key) === entry) this.cache.delete(key); });
    this.cache.set(key, entry);
    return entry.p;
  }
  // Drop everything cached (used when the app comes back from the background)
  invalidate() { this.cache.clear(); this.usersAt = 0; this.pendingLast = null; }
  // New data arrived in the background → the app re-draws the current screen
  changed() {
    this.saveSnap();
    clearTimeout(this.changedTimer);
    this.changedTimer = setTimeout(() => window.dispatchEvent(new Event('ace:data')), 60);
  }
  saveSnap() {
    clearTimeout(this.snapTimer);
    this.snapTimer = setTimeout(() => {
      if (!this.meCache) return;
      const q = {};
      for (const [k, e] of this.cache) if (e.done) q[k] = e.v;
      const snap = { v: 2, meId: this.meCache.id, phone: this.meCache.phone || '', users: this.users, q, pending: this.pendingLast?.v || null,
        syncAt: this.syncAt, fullAt: this.fullAt, syncRegion: this.syncRegion };
      try { localStorage.setItem(SNAP_KEY, JSON.stringify(snap)); } catch { try { localStorage.setItem(SNAP_KEY, JSON.stringify({ ...snap, q: {} })); } catch { /* full */ } }
    }, 800);
  }

  async init() {
    const snap = snapRead();
    if (snap?.v === 2 && snap.meId && snap.users?.length) {
      // Open instantly with the saved data
      this.setUsers(snap.users);
      this.syncAt = snap.syncAt || null; this.fullAt = snap.fullAt || 0; this.syncRegion = snap.syncRegion ?? null;
      this.meCache = this.byId.get(snap.meId) || null;
      if (this.meCache) {
        this.meCache.phone = snap.phone;
        for (const [k, v] of Object.entries(snap.q || {})) this.cache.set(k, { t: 0, p: Promise.resolve(v), v, done: true });
        if (snap.pending) this.pendingLast = { t: 0, v: snap.pending };
        // In the background: check the login is still valid, load fresh profiles
        this.ready.then(async () => {
          const { data } = await this.sb.auth.getSession();
          if (!data.session || data.session.user.id !== snap.meId) {
            snapClear(); this.meCache = null; this.setUsers([]); this.syncAt = null; this.fullAt = 0; this.invalidate();
            window.dispatchEvent(new Event('ace:loggedout')); return;
          }
          const before = JSON.stringify(this.users);
          await this.refresh(true);
          if (JSON.stringify(this.users) !== before) this.changed();
        }).catch(() => {});
        return;
      }
    }
    await this.ready;
    const { data } = await this.sb.auth.getSession();
    if (data.session) await this.refresh();
  }
  // Profiles: only my region is kept on the phone (the country can have tens of thousands of players).
  // First time — the whole region, page by page; then only the rows changed since the last time (delta).
  // Players from other regions are loaded one by one when a screen needs them (addUsers / ensureUsers).
  setUsers(list) { this.users = list; this.byId = new Map(list.map((u) => [u.id, u])); }
  addUsers(list) {
    let n = 0;
    for (const u of list) { if (u) { this.byId.set(u.id, u); n++; } }
    if (n) this.users = [...this.byId.values()];
  }
  myRegion() { return this.meCache?.region || ''; }
  async ensureUsers(ids) {
    const miss = [...new Set(ids.filter((id) => id && !this.byId.has(id)))];
    for (let i = 0; i < miss.length; i += 150) {
      const rows = check(await this.sb.from('profiles').select(PROFILE_COLS).in('id', miss.slice(i, i + 150)));
      this.addUsers(rows.map(toUser));
    }
  }
  refresh(force = false) {
    if (!force && this.usersAt && Date.now() - this.usersAt < USERS_TTL) return Promise.resolve();
    if (this.refreshing && !force && !this.users.length) return this.refreshing;
    if (!force && this.users.length && this.meCache) {
      if (!this.refreshing) {
        const before = this.syncAt + ':' + this.users.length;
        this.refresh(true).then(() => { if (this.syncAt + ':' + this.users.length !== before) this.changed(); }).catch(() => {});
      }
      return Promise.resolve();
    }
    // A forced refresh (after my own change) must not reuse a request that started before the change
    if (this.refreshing) return force ? this.refreshing.catch(() => {}).then(() => this.refresh(true)) : this.refreshing;
    const run = (async () => {
      await this.ready;
      const { data: s } = await this.sb.auth.getSession();
      if (!s.session) { this.meCache = null; this.setUsers([]); this.usersAt = 0; this.syncAt = null; return; }
      const myId = s.session.user.id;
      const [mine, phone] = await Promise.all([this.sb.from('profiles').select(PROFILE_COLS).eq('id', myId).maybeSingle(), this.sb.rpc('my_phone')]);
      const me = toUser(check(mine));
      const rg = me?.role === 'admin' ? '' : (me?.region || '');
      const full = !this.syncAt || this.syncRegion !== rg || Date.now() - this.fullAt > FULL_TTL;
      let rows = [];
      if (rg) {
        const since = full ? null : new Date(new Date(this.syncAt).getTime() - 5000).toISOString();
        for (let from = 0; ; from += 1000) {
          let q = this.sb.from('profiles').select(PROFILE_COLS).eq('region', rg);
          if (since) q = q.gt('updated_at', since);
          const page = check(await q.order('updated_at').range(from, from + 999));
          rows = rows.concat(page);
          if (page.length < 1000) break;
        }
      }
      const list = rows.map(toUser);
      if (full) { this.setUsers(me ? [me, ...list.filter((u) => u.id !== me.id)] : list); this.fullAt = Date.now(); this.syncRegion = rg; }
      else this.addUsers(me ? [...list, me] : list);
      const maxAt = [me, ...list].reduce((m, u) => (u?.updatedAt && u.updatedAt > m ? u.updatedAt : m), this.syncAt || '');
      this.syncAt = maxAt || new Date().toISOString();
      this.meCache = this.byId.get(myId) || null;
      if (this.meCache) this.meCache.phone = phone.data || '';
      this.usersAt = Date.now();
      this.saveSnap();
      // "last seen" for the administrator — at most every 10 minutes
      if (this.meCache && Date.now() - (this.seenAt || 0) > 600e3) { this.seenAt = Date.now(); this.sb.rpc('touch_seen').then(() => {}, () => {}); }
      // switching accounts is only for the administrator (and the accounts he keeps next to his own on this phone)
      if (this.meCache && !(this.meCache.role === 'admin' || accList().some((a) => a.role === 'admin'))) accWrite([]);
      else if (this.meCache) accUpsert({ id: myId, email: s.session.user.email || '', name: [this.meCache.firstName, this.meCache.lastName].filter(Boolean).join(' '), role: this.meCache.role }, s.session);
    })();
    const p = run.finally(() => { if (this.refreshing === p) this.refreshing = null; });
    this.refreshing = p;
    return p;
  }
  me() { return this.meCache; }
  user(id) { return this.byId.get(id) || null; }
  uid() { return this.meCache?.id; }

  // ---------- auth ----------
  async sendCode(phone) { check(await this.sb.auth.signInWithOtp({ phone })); return { ok: true }; }
  async verifyCode(phone, code) {
    check(await this.sb.auth.verifyOtp({ phone, token: code, type: 'sms' }));
    snapClear(); this.invalidate(); await this.refresh(true);
    return { user: this.meCache, isNew: !this.meCache?.firstName };
  }
  // ---------- e-mail + password ----------
  async signUpEmail(email, password) {
    const { data, error } = await this.sb.auth.signUp({ email, password });
    if (error) throw new Error(authError(error.message));
    if (!data.session) return { confirm: true }; // "Confirm email" is on in Supabase
    snapClear(); this.invalidate(); await this.refresh(true);
    return { user: this.meCache };
  }
  async signInEmail(email, password) {
    const { error } = await this.sb.auth.signInWithPassword({ email, password });
    if (error) throw new Error(authError(error.message));
    await this.claimInvite();
    snapClear(); this.invalidate(); await this.refresh(true);
    return { user: this.meCache };
  }
  // Admin approved a coach / court: a sign-in code goes to the e-mail of the request.
  // A separate client without a saved session, so the admin stays signed in.
  async sendInviteCode(email) {
    await this.ready;
    const tmp = this.sbFactory(this.url, this.key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'ace-invite-tmp' } });
    const { error } = await tmp.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
    if (error) throw new Error(authError(error.message));
  }
  // Admin: activity of coaches and courts, deleting
  async adminCoachStats(region = '') { return check(await this.sb.rpc('admin_coach_stats', { p_region: region || '' })) || []; }
  async adminCourtStats(region = '') { return check(await this.sb.rpc('admin_court_stats', { p_region: region || '' })) || []; }
  async adminDeleteAccount(userId) { check(await this.sb.rpc('admin_delete_account', { p_user: userId })); }
  async adminDeleteCourt(courtId, withOwner = false) { check(await this.sb.rpc('admin_delete_court', { p_court: courtId, p_with_owner: !!withOwner })); }
  // After every sign-in: an approved coach / court request for my e-mail switches the account
  async claimInvite() { try { await this.sb.rpc('claim_my_invite'); } catch { /* not critical */ } }
  // Registration with a code: the letter proves the address exists and belongs to the user,
  // then the user creates a password (the account is created when the code is confirmed)
  async signUpCode(email) {
    const { error } = await this.sb.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
    if (error) throw new Error(authError(error.message));
  }
  async confirmSignUp(email, code, password) {
    const v = await this.sb.auth.verifyOtp({ email, token: code, type: 'email' });
    if (v.error) throw new Error(authError(v.error.message));
    const u = await this.sb.auth.updateUser({ password });
    if (u.error && !/should be different|same.*password/i.test(u.error.message)) throw new Error(authError(u.error.message));
    await this.claimInvite();
    snapClear(); this.invalidate(); await this.refresh(true);
    return { user: this.meCache };
  }
  // Forgotten password: a code comes by e-mail, the user types it in the app with a new password
  async resetPassword(email) {
    const { error } = await this.sb.auth.resetPasswordForEmail(email);
    if (error) throw new Error(authError(error.message));
  }
  async confirmReset(email, code, password) {
    const v = await this.sb.auth.verifyOtp({ email, token: code, type: 'recovery' });
    if (v.error) throw new Error(authError(v.error.message));
    const u = await this.sb.auth.updateUser({ password });
    if (u.error) throw new Error(authError(u.error.message));
    await this.claimInvite();
    snapClear(); this.invalidate(); await this.refresh(true);
    return { user: this.meCache };
  }
  async changePassword(password) {
    const { error } = await this.sb.auth.updateUser({ password });
    if (error) throw new Error(authError(error.message));
  }
  // Admin: phone and e-mail of every user (only the administrator gets an answer)
  async adminContacts() {
    const rows = check(await this.sb.rpc('admin_contacts')) || [];
    return Object.fromEntries(rows.map((r) => [r.id, { phone: r.phone, email: r.email }]));
  }
  // The user deletes his own account: photos, personal data and login (the administrator cannot)
  async deleteAccount() {
    const uid = this.uid();
    try {
      const files = check(await this.sb.storage.from('photos').list(uid, { limit: 1000 })) || [];
      if (files.length) await this.sb.storage.from('photos').remove(files.map((f) => `${uid}/${f.name}`));
    } catch { /* photos are optional */ }
    check(await this.sb.rpc('delete_my_account'));
    accRemove(uid);
    snapClear(); try { await this.sb.auth.signOut({ scope: 'local' }); } catch { /* session is already closed */ }
    this.meCache = null; this.setUsers([]); this.syncAt = null; this.fullAt = 0; this.invalidate();
  }
  async signOut() { const id = this.uid(); snapClear(); await this.sb.auth.signOut(); accRemove(id); this.meCache = null; this.setUsers([]); this.syncAt = null; this.fullAt = 0; this.invalidate(); }

  // ---------- several accounts on one phone (e.g. admin + own player account) ----------
  accounts() { if (!accList().some((a) => a.role === 'admin')) return []; return accList().map(({ id, email, name, role }) => ({ id, email, name, role, current: id === this.uid() })); }
  async rememberAccount() {
    await this.ready;
    const { data } = await this.sb.auth.getSession();
    const me = this.meCache;
    if (!data.session || !me || data.session.user.id !== me.id) return;
    accUpsert({ id: me.id, email: data.session.user.email || '', name: [me.firstName, me.lastName].filter(Boolean).join(' '), role: me.role }, data.session);
  }
  // Switch to a saved account: the current login stays saved, nothing is signed out on the server
  async switchAccount(id) {
    await this.rememberAccount();
    const a = accList().find((x) => x.id === id);
    if (!a?.rt) throw new Error(L('Войдите в этот аккаунт заново', 'Bu akkauntga qaytadan kiring'));
    const { data, error } = await this.sb.auth.setSession({ access_token: a.at, refresh_token: a.rt });
    if (error || !data.session) { accRemove(id); throw new Error(L('Вход в этот аккаунт устарел — войдите заново', 'Bu akkauntga kirish eskirgan — qaytadan kiring')); }
    snapClear(); this.meCache = null; this.setUsers([]); this.syncAt = null; this.fullAt = 0; this.invalidate();
    await this.refresh(true);
    await this.rememberAccount();
    return this.meCache;
  }
  // Add one more account: keep the current login saved and open the login screen (no sign-out on the server)
  async addAccount() {
    await this.rememberAccount();
    if (typeof this.sb.auth._removeSession === 'function') await this.sb.auth._removeSession();
    else localStorage.removeItem(this.sb.auth.storageKey);
    snapClear(); this.meCache = null; this.setUsers([]); this.syncAt = null; this.fullAt = 0; this.invalidate();
  }

  // ---------- Telegram bot login ----------
  telegramNonce() {
    let v = tgRead();
    if (!v) { v = { n: [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join(''), t: Date.now(), clicked: false }; tgWrite(v); }
    return v.n;
  }
  telegramPending() { return !!tgRead()?.clicked; }
  telegramClicked() { const v = tgRead(); if (v) tgWrite({ ...v, clicked: true }); }
  async telegramCheck(nonce) {
    const { data, error } = await this.sb.functions.invoke('telegram-login', { body: { nonce } });
    if (error) throw new Error(error.message);
    if (data.status === 'ready') {
      check(await this.sb.auth.verifyOtp({ token_hash: data.token_hash, type: 'email' }));
      tgWrite(null); snapClear(); this.invalidate(); await this.refresh(true);
    } else if (data.status === 'expired' || data.status === 'used') tgWrite(null);
    return data.status;
  }
  // Telegram message to the other side (challenge, match to confirm…). Never blocks the app.
  notify(kind, id) {
    if (!id) return;
    this.ready.then(() => this.sb.functions.invoke('telegram-login', { body: { action: 'notify', kind, id } })).catch(() => {});
  }

  // ---------- users ----------
  async saveProfile(patch) {
    // The phone is protected: it is saved through a database function (also turns an invited coach into a coach)
    if (patch.phone !== undefined) check(await this.sb.rpc('set_my_phone', { p_phone: patch.phone }));
    // Acceptance of the user agreement: the time is written by the server
    if (patch.termsVer) check(await this.sb.rpc('accept_terms', { p_ver: patch.termsVer }));
    const row = fromUser(patch);
    if (Object.keys(row).length) check(await this.sb.from('profiles').update(row).eq('id', this.uid()));
    if (patch.region !== undefined && patch.region !== this.syncRegion) this.syncAt = null; // new region → load its players
    await this.refresh(true); return this.meCache;
  }
  async uploadPhoto(file) {
    const path = `${this.uid()}/${Date.now()}.jpg`;
    check(await this.sb.storage.from('photos').upload(path, file, { upsert: false, contentType: file.type }));
    return this.sb.storage.from('photos').getPublicUrl(path).data.publicUrl;
  }
  // Players of my region (other regions: findByNo / admin lists)
  async listUsers({ role } = {}) {
    await this.refresh(); const rg = this.myRegion();
    return this.users.filter((u) => (role ? u.role === role : u.role !== 'admin') && u.firstName && (!rg || u.region === rg));
  }
  async findByNo(no) {
    const n = Number(String(no || '').replace(/\D/g, '')); if (!n) return null;
    const row = check(await this.sb.from('profiles').select(PROFILE_COLS).eq('player_no', n).maybeSingle());
    const u = toUser(row); if (u) this.addUsers([u]); return u;
  }

  // ---------- matches & trainings ----------
  async createMatch(d) {
    const m = toMatch(check(await this.sb.from('matches').insert({
      type: d.type, team_a: d.teamA, team_b: d.teamB, sets: d.sets, decider: d.decider, played_at: d.playedAt, created_by: this.uid(), court_id: d.courtId || null,
    }).select().single()));
    if (m.status === 'pending') this.notify('match', m.id);
    return m;
  }
  async createTraining(d) {
    const t = toTraining(check(await this.sb.from('trainings').insert({
      player_id: this.uid(), coach_id: d.coachId || null, hours: d.hours, skills: d.skills, note: d.note, played_at: d.playedAt,
      status: d.coachId ? 'pending' : 'confirmed',
    }).select().single()));
    if (t.status === 'pending') this.notify('training', t.id);
    return t;
  }
  async pending() {
    const id = this.uid(); const now = new Date().toISOString();
    const [mr, tr] = await Promise.all([
      this.sb.from('matches').select(MATCH_COLS).eq('status', 'pending').gt('deadline', now).or(`team_a.cs.{${id}},team_b.cs.{${id}}`),
      this.sb.from('trainings').select('*').eq('status', 'pending').eq('coach_id', id).gt('deadline', now),
    ]);
    const ms = check(mr).map(toMatch).filter((m) => (m.teamA.includes(m.createdBy) ? m.teamB : m.teamA).includes(id));
    const ts = check(tr).map(toTraining);
    await this.ensureUsers([...ms.flatMap((m) => [...m.teamA, ...m.teamB]), ...ts.map((t) => t.playerId)]);
    const v = { matches: ms, trainings: ts, count: ms.length + ts.length };
    this.pendingLast = { t: Date.now(), v }; this.saveSnap();
    return v;
  }
  // Last known gate result without waiting. Refreshes in the background when old; calls onChange if something new appeared.
  pendingPeek(onChange) {
    const c = this.pendingLast;
    if (!c) return null;
    if (Date.now() - c.t > PENDING_TTL && !this.pendingBusy) {
      this.pendingBusy = this.pending().then((v) => { if (v.count > 0) onChange?.(v); }).catch(() => {}).finally(() => { this.pendingBusy = null; });
    }
    return c.v;
  }
  async outgoing() {
    const id = this.uid();
    const [mr, tr] = await Promise.all([
      this.sb.from('matches').select(MATCH_COLS).eq('created_by', id).or('status.eq.pending,and(status.eq.cancelled,expired.eq.true,complained.eq.false)'),
      this.sb.from('trainings').select('*').eq('player_id', id).eq('status', 'pending'),
    ]);
    const out = { matches: check(mr).map(toMatch), trainings: check(tr).map(toTraining) };
    await this.ensureUsers([...out.matches.flatMap((m) => [...m.teamA, ...m.teamB]), ...out.trainings.map((t) => t.coachId)]);
    return out;
  }
  async confirm(kind, id) {
    check(await this.sb.rpc(kind === 'match' ? 'confirm_match' : 'confirm_training', kind === 'match' ? { p_match: id } : { p_training: id }));
    this.pendingLast = null; await this.refresh(true);
  }
  async dispute(kind, id, reason) { check(await this.sb.rpc('dispute_record', { p_kind: kind, p_id: id, p_reason: reason })); }
  async cancelOwn(kind, id) { check(await this.sb.rpc('cancel_own', { p_kind: kind, p_id: id })); }
  async history(userId) {
    const [mr, tr] = await Promise.all([
      this.sb.from('matches').select(MATCH_COLS).eq('status', 'confirmed').or(`team_a.cs.{${userId}},team_b.cs.{${userId}}`).order('played_at', { ascending: false }).limit(1000),
      this.sb.from('trainings').select('*').eq('status', 'confirmed').or(`player_id.eq.${userId},coach_id.eq.${userId}`).order('played_at', { ascending: false }).limit(1000),
    ]);
    const out = { matches: check(mr).map(toMatch), trainings: check(tr).map(toTraining) };
    await this.ensureUsers([...out.matches.flatMap((m) => [...m.teamA, ...m.teamB]), ...out.trainings.flatMap((t) => [t.playerId, t.coachId])]);
    return out;
  }

  // ---------- rating ----------
  // Leagues are regional: the ranking is always inside one region
  async ranking({ league, period, region }) {
    if (region === undefined) region = this.myRegion();
    let q = this.sb.from('profiles').select(PROFILE_COLS).gt('matches', 0).neq('role', 'admin');
    if (region) q = q.eq('region', region);
    if (league) q = q.eq('league', league);
    const col = period === 'year' ? 'points_y' : 'points_q';
    const rows = check(await q.order(col, { ascending: false }).order('rating', { ascending: false }).limit(100));
    this.addUsers(rows.map(toUser));
    return rows.map(toUser).map((u, i) => ({ ...u, place: i + 1, points: period === 'year' ? u.pointsY : u.pointsQ }));
  }
  async leaders(region) {
    const month = new Date(); month.setDate(1); month.setHours(0, 0, 0, 0);
    region = region || this.myRegion();
    const [, mr] = await Promise.all([this.refresh(), this.sb.from('matches').select('team_a,team_b').eq('status', 'confirmed').gte('played_at', month.toISOString()).limit(5000)]);
    let ps = this.users.filter((u) => u.role !== 'admin' && u.matches > 0 && (!region || u.region === region));
    if (region && region !== this.myRegion()) { // the admin looks at another region
      ps = check(await this.sb.from('profiles').select(PROFILE_COLS).eq('region', region).gt('matches', 0).neq('role', 'admin').order('points_q', { ascending: false }).limit(500)).map(toUser);
    }
    if (!ps.length) return { top1: null, streak: null, active: null, activeCount: 0 };
    const top1 = [...ps].sort((a, b) => b.top1Days - a.top1Days)[0];
    const streak = [...ps].sort((a, b) => b.form.match(/^В*/)[0].length - a.form.match(/^В*/)[0].length)[0];
    const ms = check(mr);
    const cnt = {}; for (const m of ms) for (const id of [...m.team_a, ...m.team_b]) cnt[id] = (cnt[id] || 0) + 1;
    const active = [...ps].sort((a, b) => (cnt[b.id] || 0) - (cnt[a.id] || 0))[0];
    return { top1, streak, active, activeCount: cnt[active.id] || 0 };
  }
  async fairplayRanking(region) {
    region = region ?? this.myRegion();
    let q = this.sb.from('profiles').select(PROFILE_COLS).gt('fp_count', 0).neq('role', 'admin');
    if (region) q = q.eq('region', region);
    const list = check(await q.order('fp_count', { ascending: false }).limit(500)).map(toUser);
    this.addUsers(list);
    return list.sort((a, b) => fairplay(b.fpSum, b.fpCount) - fairplay(a.fpSum, a.fpCount));
  }
  async achievements(userId) {
    return check(await this.sb.from('achievements').select('*').eq('user_id', userId).order('created_at', { ascending: false }))
      .map((a) => ({ id: a.id, userId: a.user_id, code: a.code, title: a.title, detail: a.detail, createdAt: a.created_at }));
  }

  // ---------- search & challenges ----------
  async suggestOpponent() {
    const me = this.meCache;
    const since = new Date(Date.now() - 21 * 864e5).toISOString();
    const [, rr] = await Promise.all([this.refresh(), this.sb.from('matches').select('team_a,team_b').eq('status', 'confirmed').gte('played_at', since)
      .or(`team_a.cs.{${me.id}},team_b.cs.{${me.id}}`)]);
    const recent = check(rr);
    const played = new Set(recent.flatMap((m) => [...m.team_a, ...m.team_b]));
    const c = this.users.filter((u) => u.role === 'player' && u.id !== me.id && u.firstName && !played.has(u.id) && (!me.region || u.region === me.region))
      .map((u) => ({ u, s: Math.abs(u.rating - me.rating) - 40 * u.availability.filter((t) => me.availability.includes(t)).length }))
      .sort((a, b) => a.s - b.s);
    return c[0]?.u || null;
  }
  async challenges() {
    const since = new Date(Date.now() - 60 * 864e5).toISOString(); // older challenges are not shown anywhere
    const rows = check(await this.sb.from('challenges').select('*, court:courts(id,name,city,lat,lng)').gte('created_at', since).order('at').limit(300));
    await this.ensureUsers(rows.flatMap((c) => [c.from_id, c.to_id]));
    return rows.map((c) => ({
      id: c.id, fromId: c.from_id, toId: c.to_id, at: c.at, format: c.format, note: c.note, status: c.status, createdAt: c.created_at,
      shareFrom: !!c.share_from, shareTo: !!c.share_to, courtId: c.court_id || null, court: c.court || null }));
  }
  async createChallenge({ toId, at, format, note, share = false, courtId = null }) {
    const row = check(await this.sb.from('challenges').insert({ from_id: this.uid(), to_id: toId, at, format, note, share_from: !!share, court_id: courtId || null }).select('id').single());
    this.notify('challenge', row?.id);
  }
  async answerChallenge(id, status, share = false) {
    check(await this.sb.rpc('answer_challenge', { p_id: id, p_status: status, p_share: !!share }));
    this.notify('answer', id);
  }
  // Phone numbers opponents chose to show me: { challengeId: '998…' }
  async contacts() {
    const rows = check(await this.sb.rpc('my_contacts')) || [];
    return Object.fromEntries(rows.map((r) => [r.challenge_id, r.phone]));
  }
  async sharePhone(challengeId) { check(await this.sb.rpc('share_phone', { p_id: challengeId })); }

  // ---------- coaches ----------
  async coachStats(coachId) {
    const [tr, rr] = await Promise.all([
      this.sb.from('trainings').select('player_id,hours').eq('coach_id', coachId).eq('status', 'confirmed'),
      this.sb.from('reviews').select('*').eq('coach_id', coachId).order('created_at', { ascending: false }),
    ]);
    const ts = check(tr);
    await this.ensureUsers(check(rr).map((r) => r.author_id));
    const rv = check(rr).map((r) => ({ id: r.id, coachId: r.coach_id, authorId: r.author_id, stars: Number(r.stars), text: r.text, createdAt: r.created_at }));
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
  // Counted inside the database: one short answer for all coaches of the region
  async coachRanking(region) {
    region = region ?? this.myRegion();
    const rows = check(await this.sb.rpc('coach_ranking', { p_region: region || '' })) || [];
    await this.ensureUsers(rows.map((r) => r.coach_id));
    return rows.map((r) => this.user(r.coach_id) && ({ ...this.user(r.coach_id), stats: { trainings: r.trainings, students: r.students, hours: Number(r.hours), avg: r.avg_stars === null ? null : Number(r.avg_stars), reviewsCount: r.reviews, reviews: [] } })).filter(Boolean);
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
    const rows = check(await this.sb.from('complaints').select('*').order('created_at', { ascending: false }).limit(200));
    await this.ensureUsers(rows.flatMap((c) => [c.author_id, c.target_id]));
    return rows.map((c) => ({
      id: c.id, authorId: c.author_id, targetId: c.target_id, reason: c.reason, refId: c.ref_id, status: c.status, createdAt: c.created_at }));
  }
  async resolveComplaint(id, accept) { check(await this.sb.rpc('resolve_complaint', { p_id: id, p_accept: accept })); }
  async disputes() {
    const ms = check(await this.sb.from('matches').select('*').eq('status', 'disputed').limit(200)).map(toMatch);
    await this.ensureUsers(ms.flatMap((m) => [...m.teamA, ...m.teamB])); return ms;
  }
  async resolveDispute(id, keep) { check(await this.sb.rpc('resolve_dispute', { p_match: id, p_keep: keep })); }
  async setBan(userId, days, reason = '') { check(await this.sb.rpc('set_ban', { p_user: userId, p_days: days, p_reason: reason })); }

  // ---------- tournaments ----------
  async tournaments() {
    // Players: tournaments of their region; the admin: all. Only the latest ones, entries only for them.
    let q = this.sb.from('tournaments').select('*');
    if (this.meCache?.role !== 'admin' && this.myRegion()) q = q.eq('region', this.myRegion());
    const ts = check(await q.order('created_at', { ascending: false }).limit(60));
    const es = ts.length ? check(await this.sb.from('tournament_entries').select('*').in('tournament_id', ts.map((t) => t.id))) : [];
    await this.ensureUsers(es.map((e) => e.user_id));
    return ts.map((t) => toTournament(t, es));
  }
  async tournament(id) {
    const [tr, er] = await Promise.all([this.sb.from('tournaments').select('*').eq('id', id).single(), this.sb.from('tournament_entries').select('*').eq('tournament_id', id)]);
    const t = toTournament(check(tr), check(er));
    const b = t.bracket || {};
    await this.ensureUsers([...t.entries.map((e) => e.userId), ...[...(b.qf || []), ...(b.sf || []), ...(b.cons || []), b.final || {}].flatMap((x) => [x.a, x.b])]);
    return t;
  }
  async applyTournament(id) {
    const me = this.meCache; const fp = fairplay(me.fpSum, me.fpCount);
    if (fp !== null && fp < FAIRPLAY_MIN_FOR_TOURNAMENT) throw new Error('Fair Play ниже 3,5 — заявка недоступна');
    check(await this.sb.rpc('apply_tournament', { p_t: id }));
  }
  async createTournament(d) {
    check(await this.sb.from('tournaments').insert({ name: d.name, league: d.league, region: d.region, starts_at: d.startsAt, ends_at: d.endsAt, sponsor: d.sponsor }));
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
  // Local news: the newest 30 with their comments only (old news are never loaded)
  async news() {
    let q = this.sb.from('news').select('*');
    const rg = this.myRegion();
    if (this.meCache?.role !== 'admin' && rg) q = q.in('region', ['', rg]); // my region + news for everyone
    const ns = check(await q.order('created_at', { ascending: false }).limit(30));
    const cs = ns.length ? check(await this.sb.from('news_comments').select('*').in('news_id', ns.map((n) => n.id)).order('created_at').limit(1000)) : [];
    await this.ensureUsers(cs.map((c) => c.user_id));
    return ns.map((n) => ({ id: n.id, title: n.title, body: n.body, titleUz: n.title_uz || '', bodyUz: n.body_uz || '', auto: !!n.auto, region: n.region || '',
      section: n.section, photos: n.photos, createdAt: n.created_at,
      comments: cs.filter((c) => c.news_id === n.id).map((c) => ({ id: c.id, userId: c.user_id, text: c.text, createdAt: c.created_at })) }));
  }
  async newsItem(id) { return (await this.news()).find((n) => n.id === id); }
  // World tennis news (headline + photo + link to the original), kept 7 days
  async worldNews() {
    return check(await this.sb.from('world_news').select('id,title,summary,image,url,source,published_at').order('published_at', { ascending: false }).limit(30))
      .map((n) => ({ id: n.id, title: n.title, summary: n.summary, image: n.image, url: n.url, source: n.source, publishedAt: n.published_at }));
  }
  async addNews(d) { check(await this.sb.from('news').insert({ title: d.title, body: d.body, section: d.section, photos: d.photos || [], region: d.region || '' })); }
  async deleteNews(id) { check(await this.sb.from('news').delete().eq('id', id)); }
  async addComment(newsId, text) { check(await this.sb.from('news_comments').insert({ news_id: newsId, user_id: this.uid(), text })); }
  async hideComment(newsId, cid) { check(await this.sb.from('news_comments').delete().eq('id', cid)); }

  // ---------- coach requests (login screen → admin) ----------
  async coachRequest({ firstName, lastName, phone, email = '', experience, about, termsVer, region, docs = [] }) {
    // Document photos go to a private folder: only the administrator can open them
    const docPaths = [];
    for (const f of docs) {
      const path = `req/${crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(36).slice(2)}.jpg`;
      check(await this.sb.storage.from('coach-docs').upload(path, f, { contentType: 'image/jpeg' }));
      docPaths.push(path);
    }
    const { error } = await this.sb.from('coach_requests').insert({ first_name: firstName, last_name: lastName, phone, experience: experience || null, about: about || '', terms_ver: termsVer || '', region: region || '', doc_paths: docPaths, email: (email || '').toLowerCase() });
    if (error) throw new Error(/duplicate|unique/i.test(error.message) ? 'Заявка с этим номером уже отправлена — администратор свяжется с вами' : error.message);
  }
  async coachRequests() {
    return check(await this.sb.from('coach_requests').select('*').order('created_at', { ascending: false }).limit(100)).map((r) => ({
      id: r.id, firstName: r.first_name, lastName: r.last_name, phone: r.phone, experience: r.experience, about: r.about, region: r.region || '', docs: r.doc_paths || [], status: r.status, createdAt: r.created_at, email: r.email || '' }));
  }
  async resolveCoachRequest(id, approve, region = null) { check(await this.sb.rpc('resolve_coach_request', { p_id: id, p_approve: !!approve, p_region: region || null })); }
  // Temporary links (10 minutes) to the document photos of a coach request
  async coachDocUrls(paths) {
    if (!paths?.length) return [];
    const data = check(await this.sb.storage.from('coach-docs').createSignedUrls(paths, 600));
    return data.map((d) => d.signedUrl).filter(Boolean);
  }
  async setCoach(userId, { region, pro }) { check(await this.sb.rpc('set_coach', { p_user: userId, p_region: region || '', p_pro: pro ?? null })); }

  // ---------- courts ----------
  async courts(region) {
    let q = this.sb.from('courts').select(COURT_COLS);
    if (region) q = q.eq('region', region);
    if (this.meCache?.role !== 'admin') q = q.eq('active', true);
    return check(await q.order('city').order('name').limit(1000)).map(toCourt);
  }
  async saveCourt(c) {
    const row = fromCourt(c);
    if (c.id) check(await this.sb.from('courts').update(row).eq('id', c.id));
    else check(await this.sb.from('courts').insert(row));
  }

  // ---------- court accounts and booking (supabase/update-12.sql) ----------
  async courtRequest({ ownerName, phone, email = '', venueName, region, city, address, courtsCount, about, termsVer, docs = [], claimCourt = null, lat = null, lng = null }) {
    const docPaths = [];
    for (const f of docs) {
      const path = `req/${fileId()}.jpg`;
      check(await this.sb.storage.from('coach-docs').upload(path, f, { contentType: 'image/jpeg' }));
      docPaths.push(path);
    }
    const { error } = await this.sb.from('court_requests').insert({ owner_name: ownerName, phone, venue_name: venueName, region: region || '', city: city || '',
      address: address || '', courts_count: Math.max(1, Math.min(60, +courtsCount || 1)), about: about || '', terms_ver: termsVer || '', doc_paths: docPaths,
      claim_court: claimCourt || null, lat: claimCourt ? null : lat, lng: claimCourt ? null : lng, email: (email || '').toLowerCase() });
    if (error) throw new Error(/duplicate|unique/i.test(error.message) ? 'Заявка с этим номером уже отправлена — администратор свяжется с вами' : error.message);
  }
  async courtRequests() {
    return check(await this.sb.from('court_requests').select('*').order('created_at', { ascending: false }).limit(100)).map((r) => ({
      id: r.id, ownerName: r.owner_name, phone: r.phone, venueName: r.venue_name, region: r.region, city: r.city, address: r.address, courtsCount: r.courts_count,
      about: r.about, docs: r.doc_paths || [], status: r.status, courtId: r.court_id, createdAt: r.created_at,
      claimCourt: r.claim_court || null, lat: r.lat ?? null, lng: r.lng ?? null, email: r.email || '' }));
  }
  async resolveCourtRequest(id, approve, courtId = null) { return check(await this.sb.rpc('resolve_court_request', { p_id: id, p_approve: !!approve, p_court: courtId || null })); }
  async court(id) {
    const r = check(await this.sb.from('courts').select(COURT_COLS).eq('id', id).maybeSingle());
    return r ? toCourt(r) : null;
  }
  async courtReviews(courtId) {
    const rows = check(await this.sb.from('court_reviews').select('*').eq('court_id', courtId).order('created_at', { ascending: false }).limit(50));
    await this.ensureUsers(rows.map((r) => r.author_id).filter(Boolean));
    return rows.map((r) => ({ id: r.id, authorId: r.author_id, stars: r.stars, text: r.text, createdAt: r.created_at }));
  }
  async myCourt() {
    const r = check(await this.sb.from('courts').select(COURT_COLS).eq('owner_id', this.uid()).maybeSingle());
    if (!r) return null;
    const card = check(await this.sb.from('court_cards').select('card_number,card_holder').eq('court_id', r.id).maybeSingle());
    return { ...toCourt(r), cardNumber: card?.card_number || '', cardHolder: card?.card_holder || '' };
  }
  async saveMyCourt(c) {
    check(await this.sb.rpc('save_my_court', { p: {
      name: c.name, city: c.city, address: c.address, lat: c.lat ?? null, lng: c.lng ?? null, courts_count: c.courts, surface: c.surface || '',
      indoor: !!c.indoor, lights: !!c.lights, phone: c.phone || '', description: c.description || '', amenities: c.amenities || [], photos: c.photos || {},
      open_min: c.openMin, close_min: c.closeMin, price_rules: c.priceRules || [], booking_on: !!c.bookingOn, card_number: c.cardNumber || '', card_holder: c.cardHolder || '',
      price_text: c.priceText || '' } }));
  }
  async uploadCourtPhoto(courtId, file) {
    const path = `${courtId}/${fileId()}.jpg`;
    check(await this.sb.storage.from('court-photos').upload(path, file, { upsert: false, contentType: file.type || 'image/jpeg' }));
    return this.sb.storage.from('court-photos').getPublicUrl(path).data.publicUrl;
  }
  async courtBusy(courtId, day) {
    return (check(await this.sb.rpc('court_busy', { p_court: courtId, p_day: day })) || []).map((r) => ({ unit: r.unit, start: r.starts_at, end: r.ends_at }));
  }
  async bookCourt({ courtId, unit, start, minutes, pay }) {
    const id = check(await this.sb.rpc('book_court', { p_court: courtId, p_unit: unit, p_start: start, p_minutes: minutes, p_pay: pay }));
    this.notify('bk_new', id);
    return id;
  }
  async payInfo(bookingId) { return check(await this.sb.rpc('booking_pay_info', { p_id: bookingId })); }
  async attachReceipt(bookingId, file) {
    const ext = file.type === 'application/pdf' ? 'pdf' : 'jpg';
    const path = `${this.uid()}/${fileId()}.${ext}`;
    check(await this.sb.storage.from('receipts').upload(path, file, { contentType: file.type || 'image/jpeg' }));
    check(await this.sb.rpc('booking_receipt', { p_id: bookingId, p_path: path }));
    this.notify('bk_receipt', bookingId);
  }
  async receiptUrl(path) {
    if (!path) return '';
    return check(await this.sb.storage.from('receipts').createSignedUrl(path, 600))?.signedUrl || '';
  }
  async myBookings() {
    await this.sb.rpc('expire_court_holds');
    const rows = check(await this.sb.from('court_bookings').select(`*, court:courts(${COURT_COLS}), review:court_reviews(id)`).eq('player_id', this.uid())
      .order('starts_at', { ascending: false }).limit(100));
    return rows.map(toBooking);
  }
  async cancelBooking(id, reason = '') { const prev = check(await this.sb.rpc('cancel_booking', { p_id: id, p_reason: reason })); this.notify('bk_cancel', id); return prev; }
  // Bookings that need the court's attention: receipts to check, unpaid, upcoming cash
  async courtInbox(courtId) {
    await this.sb.rpc('expire_court_holds');
    return check(await this.sb.from('court_bookings').select('*').eq('court_id', courtId).in('status', ['paid', 'await_pay', 'cash'])
      .gte('ends_at', new Date().toISOString()).order('starts_at').limit(60)).map(toBooking);
  }
  async courtDay(courtId, day) { return (check(await this.sb.rpc('court_day', { p_court: courtId, p_day: day })) || []).map(toBooking); }
  async courtAction(id, action, reason = '') {
    check(await this.sb.rpc('court_booking_action', { p_id: id, p_action: action, p_reason: reason }));
    if (action === 'paid') this.notify('bk_paid', id);
    if (action === 'decline') this.notify('bk_declined', id);
  }
  async courtBlock({ courtId, unit, start, minutes, note }) { return check(await this.sb.rpc('court_block', { p_court: courtId, p_unit: unit, p_start: start, p_minutes: minutes, p_note: note || '' })); }
  async reviewCourt(bookingId, stars, text) { check(await this.sb.rpc('review_court', { p_booking: bookingId, p_stars: stars, p_text: text || '' })); }

  // ---------- push notifications ----------
  async pushKey() {
    const { data, error } = await this.sb.functions.invoke('telegram-login', { body: { action: 'vapid' } });
    if (error || !data?.key) throw new Error('Сервер уведомлений недоступен');
    return data.key;
  }
  async savePushSub(sub) {
    const j = sub.toJSON();
    await this.sb.from('push_subs').delete().eq('endpoint', j.endpoint);
    check(await this.sb.from('push_subs').insert({ user_id: this.uid(), endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth }));
  }
  async deletePushSub(endpoint) { await this.sb.from('push_subs').delete().eq('endpoint', endpoint); }

  // ---------- admin ----------
  async inviteCoach({ phone, firstName, lastName }) { check(await this.sb.rpc('invite_coach', { p_phone: phone, p_first: firstName, p_last: lastName })); }
  async stats(region = '') { return check(await this.sb.rpc('admin_stats', { p_region: region || '' })); }

  // One page of users for the administrator (any region), with phone and e-mail
  async adminUsers({ region = '', role = '', q = '', filter = '', offset = 0, limit = 50 } = {}) {
    const rows = check(await this.sb.rpc('admin_users', { p_region: region, p_role: role, p_q: q, p_filter: filter, p_offset: offset, p_limit: limit })) || [];
    const ids = rows.map((r) => r.id);
    await this.ensureUsers(ids);
    return { total: Number(rows[0]?.total || 0), rows: rows.map((r) => ({ ...(this.user(r.id) || {}), id: r.id, playerNo: r.player_no, role: r.role,
      firstName: r.first_name, lastName: r.last_name, photo: r.photo_url, region: r.region, district: r.district, league: r.league, rating: r.rating,
      matches: r.matches, bannedUntil: r.banned_until, banReason: r.ban_reason, createdAt: r.created_at, phone: r.phone || '', email: r.email || '' })) };
  }
  // Everything for a file (page by page, any size)
  async adminExport({ region = '', role = '' } = {}) {
    let all = [];
    for (let from = 0; ; from += 1000) {
      const rows = check(await this.sb.rpc('admin_users', { p_region: region, p_role: role, p_q: '', p_filter: '', p_offset: from, p_limit: 1000 })) || [];
      all = all.concat(rows);
      if (rows.length < 1000) break;
    }
    return all;
  }

  // ---------- support chat (player ↔ administration) ----------
  async supportMine() {
    return check(await this.sb.from('support_messages').select('*').eq('user_id', this.uid()).order('created_at', { ascending: false }).limit(100))
      .reverse().map((m) => ({ id: m.id, fromAdmin: m.from_admin, text: m.text, createdAt: m.created_at, readAt: m.read_at }));
  }
  async supportUnread() {
    const r = await this.sb.from('support_messages').select('id', { count: 'exact', head: true }).eq('user_id', this.uid()).eq('from_admin', true).is('read_at', null);
    return r.count || 0;
  }
  async supportSend(text) { check(await this.sb.from('support_messages').insert({ user_id: this.uid(), text, from_admin: false })); }
  async supportRead(userId = null) { check(await this.sb.rpc('support_read', { p_user: userId })); }
  async supportThreads() {
    const rows = check(await this.sb.rpc('support_threads', { p_limit: 200 })) || [];
    await this.ensureUsers(rows.map((r) => r.user_id));
    return rows.map((r) => ({ userId: r.user_id, lastText: r.last_text, lastFromAdmin: r.last_from_admin, lastAt: r.last_at, unread: r.unread }));
  }
  async supportThread(userId) {
    await this.ensureUsers([userId]);
    return check(await this.sb.from('support_messages').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(200))
      .reverse().map((m) => ({ id: m.id, fromAdmin: m.from_admin, text: m.text, createdAt: m.created_at, readAt: m.read_at }));
  }
  async supportReply(userId, text) { check(await this.sb.from('support_messages').insert({ user_id: userId, text, from_admin: true })); }
}
