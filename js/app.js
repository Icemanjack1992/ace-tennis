import { DemoStore } from './store-demo.js';
import { SupabaseStore } from './store-supabase.js';
import { L, icon, setLang, getLang, toast } from './ui.js';
import * as V from './views.js';

const cfg = window.ACE_CONFIG || {};
export const store = cfg.supabaseUrl && cfg.supabaseKey ? new SupabaseStore(cfg.supabaseUrl, cfg.supabaseKey) : new DemoStore();
const app = document.getElementById('app');

const routes = [
  [/^#\/login$/, V.login, { open: true }],
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
  [/^#\/news$/, V.news, { tab: 'home' }],
  [/^#\/news\/([\w-]+)$/, V.newsItem, { tab: 'home' }],
  [/^#\/admin(?:\/(\w+))?$/, V.admin, { tab: 'profile', admin: true }],
];

function nav(active) {
  const a = (href, key, ic, label) => `<a href="${href}" class="${active === key ? 'on' : ''}" ${active === key ? 'aria-current="page"' : ''}>${ic}${label}</a>`;
  return `<nav class="tabs" aria-label="${L('Основное меню', 'Asosiy menyu')}">
    ${a('#/home', 'home', icon.home, L('Главная', 'Asosiy'))}
    ${a('#/search', 'search', icon.search, L('Поиск', 'Qidiruv'))}
    <a href="#/add" class="plus" aria-label="${L('Добавить матч или тренировку', 'O‘yin yoki mashg‘ulot qo‘shish')}">${icon.plus}</a>
    ${a('#/rating', 'rating', icon.trophy, L('Рейтинг', 'Reyting'))}
    ${a('#/profile', 'profile', icon.user, L('Профиль', 'Profil'))}
  </nav>`;
}

let renderSeq = 0;
export async function render() {
  const seq = ++renderSeq;
  const hash = location.hash || '#/home';
  let match = null, route = null;
  for (const r of routes) { const m = hash.match(r[0]); if (m) { match = m; route = r; break; } }
  if (!route) { location.hash = '#/home'; return; }
  const [, view, opts] = route;
  const me = store.me();
  if (!opts.open && !me) { location.hash = '#/login'; return; }
  if (me && !me.firstName && hash !== '#/onboarding') { location.hash = '#/onboarding'; return; }
  if (opts.admin && me?.role !== 'admin') { location.hash = '#/home'; return; }
  // Gate: anything waiting for my confirmation must be handled first
  if (me && !opts.open && !opts.gateFree) {
    const p = await store.pending();
    if (p.count > 0) { location.hash = '#/confirm'; return; }
  }
  let html;
  try { html = await view.render(match.slice(1), store); }
  catch (e) { console.error(e); html = `<div class="wrap"><div class="card">${L('Ошибка', 'Xatolik')}: ${e.message}</div></div>`; }
  if (seq !== renderSeq) return;
  const banner = store.mode === 'demo' && me ? `<div class="demo-banner">${L('Демо-режим: тестовые данные', 'Demo rejim: sinov ma’lumotlari')} · <button class="linkbtn" data-reset style="all:unset;text-decoration:underline;cursor:pointer">${L('сбросить', 'qayta tiklash')}</button></div>` : '';
  app.innerHTML = `${banner}<div class="screen">${html}</div>${opts.tab && me ? nav(opts.tab) : ''}`;
  app.querySelector('[data-reset]')?.addEventListener('click', () => { store.reset(); location.hash = '#/home'; render(); toast(L('Демо-данные сброшены', 'Demo ma’lumotlar tiklandi')); });
  window.scrollTo(0, 0);
  try { await view.mount?.(app, match.slice(1), store); }
  catch (e) { console.error(e); toast(e.message); }
}

export function go(hash) { if (location.hash === hash) render(); else location.hash = hash; }

window.addEventListener('hashchange', render);
(async () => {
  setLang(getLang());
  try { await store.init(); }
  catch (e) { app.innerHTML = `<div class="wrap"><div class="card">${L('Не удалось подключиться к серверу', 'Serverga ulanib bo‘lmadi')}: ${e.message}</div></div>`; return; }
  if (!location.hash) location.hash = store.me() ? '#/home' : '#/login';
  render();
})();

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
