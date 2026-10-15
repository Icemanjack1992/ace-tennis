import { DemoStore } from './store-demo.js';
import { SupabaseStore } from './store-supabase.js';
import * as C from './courts.js';
import { L, icon, setLang, getLang, toast, profileDone, newerVersion, updateApp } from './ui.js';
import * as V from './views.js';

const cfg = window.ACE_CONFIG || {};
export const store = cfg.supabaseUrl && cfg.supabaseKey ? new SupabaseStore(cfg.supabaseUrl, cfg.supabaseKey) : new DemoStore();
const app = document.getElementById('app');

const routes = [
  [/^#\/login$/, V.login, { open: true }],
  [/^#\/terms$/, V.termsPage, { open: true }],
  [/^#\/delete-account$/, V.deleteAccountPage, { open: true }],
  [/^#\/onboarding$/, V.onboarding, { open: true, gateFree: true }],
  [/^#\/confirm$/, V.confirmScreen, { gateFree: true }],
  [/^#\/home$/, V.home, { tab: 'home' }],
  [/^#\/search$/, V.search, { tab: 'search' }],
  [/^#\/add(?:\/(\w+))?(?:\?(.*))?$/, V.add, { tab: 'add' }],
  [/^#\/rating$/, V.rating, { tab: 'rating' }],
  [/^#\/profile(?:\/([\w-]+))?$/, V.profile, { tab: 'profile' }],
  [/^#\/edit$/, V.onboarding, { tab: 'profile' }],
  [/^#\/coach\/([\w-]+)$/, V.coach, { tab: 'search' }],
  [/^#\/tournaments$/, V.tournaments, { tab: 'home' }],
  [/^#\/tournament\/([\w-]+)$/, V.tournament, { tab: 'home' }],
  [/^#\/courts$/, C.courtsView, { tab: 'home' }],
  [/^#\/news$/, V.news, { tab: 'home' }],
  [/^#\/news\/([\w-]+)$/, V.newsItem, { tab: 'home' }],
  [/^#\/admin(?:\/(\w+))?(?:\/([\w-]+))?$/, V.admin, { tab: 'admin', admin: true }],
  [/^#\/support$/, V.support, { tab: 'profile', gateFree: true }],
];

function nav(active) {
  const a = (href, key, ic, label) => `<a href="${href}" data-k="${key}" class="${active === key ? 'on' : ''}" ${active === key ? 'aria-current="page"' : ''}>${ic}${label}</a>`;
  // The administrator does not play: his menu has no "+", challenges or own profile
  if (store.me()?.role === 'admin') {
    return `<nav class="tabs" aria-label="${L('Меню администратора', 'Administrator menyusi')}">
    ${a('#/admin', 'admin', icon.shield, L('Админ', 'Admin'))}
    ${a('#/search', 'search', icon.search, L('Игроки', 'O‘yinchilar'))}
    ${a('#/admin/tournaments', 'tournaments', icon.bracket, L('Турниры', 'Turnirlar'))}
    ${a('#/rating', 'rating', icon.trophy, L('Рейтинг', 'Reyting'))}
    ${a('#/news', 'home', icon.news, L('Новости', 'Yangiliklar'))}
  </nav>`;
  }
  return `<nav class="tabs" aria-label="${L('Основное меню', 'Asosiy menyu')}">
    ${a('#/home', 'home', icon.home, L('Главная', 'Asosiy'))}
    ${a('#/search', 'search', icon.search, L('Поиск', 'Qidiruv'))}
    <a href="#/add" class="plus" aria-label="${L('Добавить матч или тренировку', 'O‘yin yoki mashg‘ulot qo‘shish')}">${icon.plus}</a>
    ${a('#/rating', 'rating', icon.trophy, L('Рейтинг', 'Reyting'))}
    ${a('#/profile', 'profile', icon.user, L('Профиль', 'Profil'))}
  </nav>`;
}

// Thin progress line at the top while a screen loads (only if it takes longer than a moment)
let loadingTimer = null;
function loading(on) {
  clearTimeout(loadingTimer);
  if (on) loadingTimer = setTimeout(() => document.body.classList.add('loading'), 120);
  else document.body.classList.remove('loading');
}
const GATE_KEY = 'ace:pending';
const toGate = () => { const r = currentRoute(); if (r && !r[2].open && !r[2].gateFree) location.hash = '#/confirm'; };
function currentRoute() {
  const hash = location.hash || '#/home';
  for (const r of routes) { const m = hash.match(r[0]); if (m) return [m, ...r.slice(1)]; }
  return null;
}

// A newer version on the server → a thin banner "update" at the top (checked at start and every 30 min)
let updateReady = null;
const checkUpdate = async () => { const v = await newerVersion(); if (v && v !== updateReady) { updateReady = v; window.dispatchEvent(new Event('ace:data')); } };
setTimeout(checkUpdate, 4000); setInterval(checkUpdate, 30 * 60e3);

let renderSeq = 0;
// keepScroll: re-draw the same screen after an action or filter, without jumping to the top
export async function render(keepScroll = false) {
  const seq = ++renderSeq;
  const hash = location.hash || '#/home';
  const cur = currentRoute();
  if (!cur) { location.hash = '#/home'; return; }
  const [match, view, opts] = cur;
  const me = store.me();
  if (!opts.open && !me) { location.hash = '#/login'; return; }
  if (me && !profileDone(me) && hash !== '#/onboarding' && hash !== '#/terms' && hash !== '#/delete-account') { location.hash = '#/onboarding'; return; }
  if (opts.admin && me?.role !== 'admin') { location.hash = '#/home'; return; }
  if (me?.role === 'admin' && /^#\/(add|confirm|edit|profile$|home)/.test(hash)) { location.hash = '#/admin'; return; }
  if (me?.role === 'admin' && hash === '#/tournaments') { location.hash = '#/admin/tournaments'; return; }
  // The administrator has a separate "Tournaments" tab in the bottom menu
  const tab = me?.role === 'admin' && /^#\/(admin\/tournaments|tournament\/)/.test(hash) ? 'tournaments' : opts.tab;
  // Instant feedback: highlight the tab right away, the screen follows
  if (!keepScroll) app.querySelectorAll('nav.tabs a').forEach((a) => a.classList.toggle('on', a.dataset.k === tab));
  loading(true);
  // Gate: anything waiting for my confirmation must be handled first.
  // The answer is remembered, so this costs no waiting on normal navigation.
  // If the answer is not known yet, the check and the screen load at the same time.
  let gate = null;
  if (me && !opts.open && !opts.gateFree) {
    const p = store.pendingPeek ? store.pendingPeek(toGate) : null;
    if (p) { if (p.count > 0) { loading(false); location.hash = '#/confirm'; return; } }
    else gate = store.pending().catch(() => ({ count: 0 }));
  }
  let html;
  const htmlP = Promise.resolve().then(() => view.render(match.slice(1), store));
  if (gate) {
    const p = await gate;
    if (seq !== renderSeq) return;
    if (p.count > 0) { htmlP.catch(() => {}); loading(false); location.hash = '#/confirm'; return; }
  }
  try { html = await htmlP; }
  catch (e) { console.error(e); html = `<div class="wrap"><div class="card">${L('Ошибка', 'Xatolik')}: ${e.message}<div class="mt"><button class="btn sm" onclick="location.reload()">${L('Обновить', 'Yangilash')}</button></div></div></div>`; }
  if (seq !== renderSeq) return;
  loading(false);
  const y = window.scrollY;
  const upd = updateReady && me ? `<div class="demo-banner" style="background:var(--ball);color:var(--court)">${L('Вышло обновление приложения', 'Ilovaning yangi versiyasi chiqdi')} · <button data-do-update style="all:unset;text-decoration:underline;cursor:pointer;font-weight:800">${L('обновить', 'yangilash')}</button></div>` : '';
  const banner = upd + (store.mode === 'demo' && me ? `<div class="demo-banner">${L('Демо-режим: тестовые данные', 'Demo rejim: sinov ma’lumotlari')} · <button class="linkbtn" data-reset style="all:unset;text-decoration:underline;cursor:pointer">${L('сбросить', 'qayta tiklash')}</button></div>` : '');
  app.innerHTML = `${banner}<div class="screen">${html}</div>${tab && me ? nav(tab) : ''}`;
  app.querySelector('[data-do-update]')?.addEventListener('click', () => { toast(L('Обновляем…', 'Yangilanmoqda…')); updateApp(); });
  app.querySelector('[data-reset]')?.addEventListener('click', () => { store.reset(); location.hash = '#/home'; render(); toast(L('Демо-данные сброшены', 'Demo ma’lumotlar tiklandi')); });
  window.scrollTo(0, keepScroll ? y : 0);
  try { await view.mount?.(app, match.slice(1), store); }
  catch (e) { console.error(e); toast(e.message); }
  if (!keepScroll) prefetch();
}

// While the user looks at a screen, quietly load the main tabs so they open instantly
let prefetched = 0;
function prefetch() {
  const me = store.me();
  if (!me || store.mode !== 'live' || Date.now() - prefetched < 25e3) return;
  prefetched = Date.now();
  const idle = window.requestIdleCallback || ((f) => setTimeout(f, 400));
  idle(() => {
    const quiet = (p) => p?.catch?.(() => {});
    quiet(store.listUsers({ role: 'player' }));
    quiet(store.challenges());
    if (me.role !== 'admin') quiet(store.ranking({ league: me.role === 'player' ? (me.league || 'novice') : 'gold', period: 'quarter', region: me.region || '' }));
    quiet(store.tournaments());
  });
}

export function go(hash) { if (location.hash === hash) render(); else location.hash = hash; }

window.addEventListener('hashchange', () => render(false));
window.addEventListener('ace:rerender', () => render(true));
window.addEventListener(GATE_KEY, toGate);
// Fresh data arrived in the background: quietly re-draw the screen (not while the user is typing or in a dialog)
window.addEventListener('ace:data', () => {
  const r = currentRoute();
  const busy = document.querySelector('.sheet-bg') || /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '');
  if (!r || r[2].open || busy || /^#\/(edit|onboarding|add|login)/.test(location.hash)) return;
  render(true);
});
window.addEventListener('ace:loggedout', () => { location.hash = '#/login'; render(); });

// Back from the background (e.g. after Telegram): fresh data, without jumping to the top
let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') { hiddenAt = Date.now(); return; }
  if (hiddenAt && Date.now() - hiddenAt > 30e3 && store.me() && store.invalidate && !document.querySelector('.sheet-bg')) {
    store.invalidate();
    const r = currentRoute();
    if (r && !r[2].open && !/^#\/(edit|onboarding|add)/.test(location.hash)) render(true);
  }
});

// A fast second tap on the same button is ignored (no double challenges, double saves…)
let lastTap = { el: null, t: 0 };
document.addEventListener('click', (e) => {
  const b = e.target.closest?.('button, a.btn, nav.tabs a');
  if (!b) return;
  if (b === lastTap.el && Date.now() - lastTap.t < 450) { e.preventDefault(); e.stopImmediatePropagation(); return; }
  lastTap = { el: b, t: Date.now() };
}, true);

// Portrait only: the web cannot lock rotation on iPhone, so in landscape we show "turn the phone".
function checkOrientation() {
  // All signs must agree: a touch phone, the system says "landscape", and the window really is wider than tall
  const phone = Math.min(screen.width, screen.height) < 600 && !!window.matchMedia?.('(pointer: coarse)').matches;
  const type = screen.orientation?.type || (Math.abs(window.orientation || 0) === 90 ? 'landscape' : 'portrait');
  const wide = window.innerWidth > window.innerHeight;
  document.documentElement.classList.toggle('landscape', phone && type.startsWith('landscape') && wide);
}
screen.orientation?.addEventListener?.('change', checkOrientation);
window.addEventListener('orientationchange', checkOrientation);
window.addEventListener('resize', checkOrientation);
checkOrientation();
try { screen.orientation?.lock?.('portrait').catch(() => {}); } catch { /* not supported */ }
(async () => {
  setLang(getLang());
  try { await store.init(); }
  catch (e) { app.innerHTML = `<div class="wrap"><div class="card">${L('Не удалось подключиться к серверу', 'Serverga ulanib bo‘lmadi')}: ${e.message}</div></div>`; return; }
  if (!location.hash) location.hash = store.me() ? '#/home' : '#/login';
  render();
  // Old profiles kept the photo inside the database: move it to file storage once (the profile list becomes light)
  const me = store.me();
  if (me?.photo?.startsWith('data:') && store.uploadPhoto) {
    setTimeout(async () => {
      try {
        const blob = await (await fetch(me.photo)).blob();
        const url = await store.uploadPhoto(new File([blob], 'p.jpg', { type: 'image/jpeg' }));
        await store.saveProfile({ photo: url });
      } catch { /* next start */ }
    }, 3000);
  }
})();

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
