// UI helpers: language, escaping, icons, avatars, formatting, toasts, sheets
let lang = (() => { try { return localStorage.getItem('ace_lang') || 'ru'; } catch { return 'ru'; } })();
export const getLang = () => lang;
export function setLang(l) { lang = l; try { localStorage.setItem('ace_lang', l); } catch { /* ignore */ } document.documentElement.lang = l === 'uz' ? 'uz' : 'ru'; }
// Bilingual string: L('Главная', 'Bosh sahifa')
export const L = (ru, uz) => (lang === 'uz' && uz ? uz : ru);

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const P = (d, extra = '') => `<svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${extra}>${d}</svg>`;
export const icon = {
  home: P('<path d="M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z"/>'),
  search: P('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
  plus: P('<path d="M12 5v14M5 12h14"/>', 'stroke-width="2.6"'),
  trophy: P('<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>'),
  user: P('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
  back: P('<path d="m15 18-6-6 6-6"/>'),
  close: P('<path d="M18 6 6 18M6 6l12 12"/>'),
  bell: P('<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>'),
  shield: P('<path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6z"/><path d="m9 12 2 2 4-4"/>'),
  news: P('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9h10M7 13h10M7 17h6"/>'),
  clock: P('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  check: P('<path d="m5 12 5 5L20 7"/>'),
  settings: P('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  bolt: P('<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>'),
};

export const logo = (size = 32) => `<svg role="img" aria-label="Ace Tennis" width="${size}" height="${size}" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="#D8F244"/><path d="M31 75 50 24l19 51" fill="none" stroke="#0E3B2C" stroke-width="${size < 36 ? 10 : 8}" stroke-linecap="round" stroke-linejoin="round"/><path d="M37 57q13 7 26 0" fill="none" stroke="#FFFFFF" stroke-width="5" stroke-linecap="round"/></svg>`;

// Required profile fields are filled (admins are exempt)
export const profileDone = (u) => !!u && (u.role === 'admin' || !!(u.firstName && u.lastName && u.gender && u.district && u.availability?.length));

export const fullName = (u) => u ? `${u.firstName || ''} ${u.lastName || ''}`.trim() || L('Без имени', 'Ismsiz') : '—';
export const shortName = (u) => u ? `${u.firstName || ''} ${u.lastName ? u.lastName[0] + '.' : ''}`.trim() : '—';

export function avatar(u, cls = '') {
  if (u?.photo) return `<span class="av ${cls}"><img src="${esc(u.photo)}" alt=""></span>`;
  const ini = u ? `${(u.firstName || '?')[0]}${(u.lastName || '')[0] || ''}`.toUpperCase() : '?';
  return `<span class="av ${cls}" aria-hidden="true">${esc(ini)}</span>`;
}

export function formBadges(form = '', cls = '') {
  if (!form) return `<span class="muted">${L('пока нет матчей', 'hali o‘yin yo‘q')}</span>`;
  return `<span class="form ${cls}" aria-label="${L('Последние матчи', 'So‘nggi o‘yinlar')}: ${esc(form)}">${[...form].map((c) =>
    `<b class="${c === 'П' ? 'l' : ''}">${c === 'В' ? L('В', 'G') : L('П', 'M')}</b>`).join('')}</span>`;
}

const MONTHS_RU = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const MONTHS_UZ = ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avg', 'sen', 'okt', 'noy', 'dek'];
export function fmtDate(iso, withTime = false) {
  if (!iso) return '';
  const d = new Date(iso);
  const m = (lang === 'uz' ? MONTHS_UZ : MONTHS_RU)[d.getMonth()];
  const t = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return `${d.getDate()} ${m}${withTime ? ', ' + t : ''}`;
}
export function hoursLeft(iso) { return Math.max(0, Math.round((new Date(iso) - Date.now()) / 3600e3)); }
export const fmtNum = (n) => String(n ?? 0).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
export const comma = (x) => String(x).replace('.', ',');

export function toast(msg) {
  document.querySelector('.toast')?.remove();
  const el = document.createElement('div');
  el.className = 'toast'; el.setAttribute('role', 'status'); el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

// Bottom sheet; returns a close function
export function sheet(html, onMount) {
  const bg = document.createElement('div');
  bg.className = 'sheet-bg';
  bg.innerHTML = `<div class="sheet" role="dialog" aria-modal="true">${html}</div>`;
  const close = () => bg.remove();
  bg.addEventListener('click', (e) => { if (e.target === bg || e.target.closest('[data-close]')) close(); });
  document.body.appendChild(bg);
  onMount?.(bg.querySelector('.sheet'), close);
  return close;
}

// Parse 'a:b' or 'a-b' pairs list from inputs
export function readSets(root) {
  const sets = [];
  root.querySelectorAll('[data-set]').forEach((el) => {
    const i = +el.dataset.set; const side = el.dataset.side;
    sets[i] = sets[i] || [null, null];
    sets[i][side === 'a' ? 0 : 1] = el.value === '' ? null : Math.max(0, Math.min(99, parseInt(el.value, 10) || 0));
  });
  return sets.filter((s) => s && s[0] !== null && s[1] !== null);
}
