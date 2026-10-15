// "Поделиться": a story picture 1080×1920 (Instagram, Telegram, WhatsApp…) made on the phone.
// Player card, coach card, a match result or an award. Shared through the phone's share menu.
import { L, esc, sheet, toast, fullName, shortName, fmtDate, comma, fmtNum } from './ui.js';
import { regionShort, regionOf } from './regions.js';
import { formatStrength, LEAGUES, fairplay, formatSets, winnerFromSets } from './rating.js';
import { equipmentName } from './courts.js';

const W = 1080, H = 1920;
const C = { court: '#0E3B2C', court2: '#164A38', deep: '#06261B', ball: '#D8F244', white: '#FFFFFF', soft: '#C9D8CF' };
const CUPS = {
  tour_win: { bg: '#F2C53D', bd: '#B8860B', fg: '#5A3D00', ru: 'Победитель турнира', uz: 'Turnir g‘olibi' },
  tour_final: { bg: '#D9DEE3', bd: '#8A949E', fg: '#39424A', ru: 'Финалист турнира', uz: 'Turnir finalchisi' },
  tour_semi: { bg: '#E3A774', bd: '#95582A', fg: '#4A2508', ru: 'Полуфиналист турнира', uz: 'Turnir yarim finalchisi' },
  season_champion: { bg: '#D8F244', bd: '#FFFFFF', fg: '#0E3B2C', ru: 'Чемпион сезона', uz: 'Mavsum chempioni' },
  season_final: { bg: '#0E3B2C', bd: '#D8F244', fg: '#D8F244', ru: 'Финалист сезона', uz: 'Mavsum finalchisi' },
};
const leagueName = (id) => { const l = LEAGUES.find((x) => x.id === id); return l ? L(l.ru, l.uz) : ''; };
const wonBy = (m, id) => (m.winner || winnerFromSets(m.sets)) === (m.teamA.includes(id) ? 'A' : 'B');

// ---------- drawing helpers ----------
const F = (w, size, fam = 'Manrope') => `${w} ${size}px ${fam === 'Oswald' ? '"Oswald", "Arial Narrow", sans-serif' : '"Manrope", system-ui, sans-serif'}`;
function text(g, s, x, y, { size = 40, weight = 700, fam = 'Manrope', color = C.white, align = 'center', max = 960, upper = false } = {}) {
  g.font = F(weight, size, fam); g.fillStyle = color; g.textAlign = align; g.textBaseline = 'alphabetic';
  let t = upper ? String(s).toUpperCase() : String(s);
  while (g.measureText(t).width > max && size > 20) { size -= 2; g.font = F(weight, size, fam); }
  if (g.measureText(t).width > max) { while (t.length > 1 && g.measureText(t + '…').width > max) t = t.slice(0, -1); t += '…'; }
  g.fillText(t, x, y);
  return size;
}
function rrect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function loadImg(src) {
  return new Promise((ok) => {
    if (!src) { ok(null); return; }
    const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => ok(im); im.onerror = () => ok(null); im.src = src;
    setTimeout(() => ok(null), 6000);
  });
}
const svgImg = (svg) => loadImg('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg));
const cupSvg = (fg) => `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 24 24" fill="none" stroke="${fg}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/></svg>`;

async function base(g) {
  try { await Promise.all([document.fonts.load(F(700, 80, 'Oswald')), document.fonts.load(F(800, 40)), document.fonts.load(F(500, 40))]); } catch { /* system fonts */ }
  const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, C.court2); bg.addColorStop(1, C.deep);
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  // court lines
  g.strokeStyle = 'rgba(255,255,255,.07)'; g.lineWidth = 6;
  g.strokeRect(90, 230, W - 180, H - 460); g.beginPath(); g.moveTo(90, H / 2); g.lineTo(W - 90, H / 2); g.moveTo(W / 2, 600); g.lineTo(W / 2, H - 600); g.stroke();
  g.beginPath(); g.moveTo(90, 600); g.lineTo(W - 90, 600); g.moveTo(90, H - 600); g.lineTo(W - 90, H - 600); g.stroke();
  // brand
  g.font = F(700, 64, 'Oswald'); const tw = g.measureText('ACE TENNIS').width;
  const bx = W / 2 - (tw + 84) / 2 + 30; // ball 60 px + gap 24 px, then the name
  g.fillStyle = C.ball; g.beginPath(); g.arc(bx, 128, 30, 0, Math.PI * 2); g.fill();
  g.save(); g.beginPath(); g.arc(bx, 128, 30, 0, Math.PI * 2); g.clip();
  g.strokeStyle = C.court; g.lineWidth = 4; g.beginPath(); g.arc(bx - 34, 128, 26, -0.9, 0.9); g.stroke(); g.beginPath(); g.arc(bx + 34, 128, 26, Math.PI - 0.9, Math.PI + 0.9); g.stroke(); g.restore();
  text(g, 'ACE TENNIS', bx + 54, 150, { size: 64, fam: 'Oswald', color: C.white, align: 'left' });
  text(g, 'ace-tennis.uz', W / 2, H - 120, { size: 44, weight: 800, color: C.ball });
  text(g, L('Сообщество любителей тенниса Узбекистана', 'O‘zbekiston tennis havaskorlari hamjamiyati'), W / 2, H - 64, { size: 30, weight: 500, color: C.soft });
}
async function avatarAt(g, u, cx, cy, r) {
  g.save(); g.beginPath(); g.arc(cx, cy, r + 14, 0, Math.PI * 2); g.fillStyle = C.ball; g.fill(); g.restore();
  const im = await loadImg(u.photo);
  g.save(); g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.clip();
  if (im) { const s = Math.max((2 * r) / im.width, (2 * r) / im.height); g.drawImage(im, cx - (im.width * s) / 2, cy - (im.height * s) / 2, im.width * s, im.height * s); }
  else { g.fillStyle = C.court; g.fillRect(cx - r, cy - r, 2 * r, 2 * r); text(g, `${(u.firstName || '?')[0]}${(u.lastName || '')[0] || ''}`, cx, cy + r * 0.3, { size: r * 0.8, fam: 'Oswald', color: C.ball }); }
  g.restore();
}
function tile(g, x, y, w, h, big, small, color = C.white) {
  rrect(g, x, y, w, h, 28); g.fillStyle = 'rgba(255,255,255,.08)'; g.fill();
  text(g, big, x + w / 2, y + h / 2 + 18, { size: 76, fam: 'Oswald', color, max: w - 30 });
  text(g, small, x + w / 2, y + h - 28, { size: 28, weight: 600, color: C.soft, max: w - 30 });
}
const tiles3 = (g, y, items) => { const w = 290, gap = 30, x0 = (W - (3 * w + 2 * gap)) / 2; items.forEach(([b, s, c], i) => tile(g, x0 + i * (w + gap), y, w, 220, b, s, c)); };

// ---------- the four pictures ----------
async function playerCard(g, u, ach, place) {
  await base(g);
  await avatarAt(g, u, W / 2, 470, 190);
  text(g, fullName(u), W / 2, 790, { size: 88, fam: 'Oswald', upper: true });
  text(g, [regionShort(regionOf(u)), u.playerNo ? 'ID ' + u.playerNo : ''].filter(Boolean).join(' · '), W / 2, 850, { size: 36, weight: 600, color: C.soft });
  // level
  rrect(g, 140, 910, W - 280, 300, 36); g.fillStyle = C.ball; g.fill();
  text(g, L('УРОВЕНЬ СИЛЫ', 'KUCH DARAJASI'), W / 2, 975, { size: 34, weight: 800, color: C.court });
  text(g, formatStrength(u.rating), W / 2, 1135, { size: 170, fam: 'Oswald', color: C.court });
  text(g, `${L('Лига', 'Liga')} ${leagueName(u.league)}${place ? ` · ${place} ${L('место', 'o‘rin')}` : ''}`, W / 2, 1190, { size: 34, weight: 800, color: C.court });
  const fp = fairplay(u.fpSum, u.fpCount);
  tiles3(g, 1250, [[String(u.matches || 0), L('матчей', 'o‘yin')], [`${u.matches ? Math.round((u.wins / u.matches) * 100) : 0}%`, L('побед', 'g‘alaba'), C.ball], [fp === null ? '—' : comma(fp.toFixed(1)), 'Fair Play']]);
  const cups = ach.filter((a) => CUPS[a.code]);
  if (cups.length) {
    const kinds = Object.keys(CUPS).map((k) => [k, cups.filter((a) => a.code === k).length]).filter(([, n]) => n);
    const step = 200, x0 = W / 2 - ((kinds.length - 1) * step) / 2;
    for (const [i, [k, n]] of kinds.entries()) {
      const c = CUPS[k], cx = x0 + i * step, cy = 1590;
      g.beginPath(); g.arc(cx, cy, 70, 0, Math.PI * 2); g.fillStyle = c.bg; g.fill(); g.lineWidth = 8; g.strokeStyle = c.bd; g.stroke();
      const im = await svgImg(cupSvg(c.fg)); if (im) g.drawImage(im, cx - 42, cy - 42, 84, 84);
      if (n > 1) text(g, '×' + n, cx + 62, cy - 50, { size: 34, weight: 800, color: C.ball });
    }
    text(g, L('Награды', 'Mukofotlar'), W / 2, 1720, { size: 30, weight: 600, color: C.soft });
  }
}
async function coachCard(g, u, st) {
  await base(g);
  await avatarAt(g, u, W / 2, 470, 190);
  text(g, fullName(u), W / 2, 790, { size: 88, fam: 'Oswald', upper: true });
  rrect(g, W / 2 - 260, 825, 520, 64, 32); g.fillStyle = u.coachPro ? C.ball : 'rgba(255,255,255,.12)'; g.fill();
  text(g, u.coachPro ? '✓ ' + L('ПРОВЕРЕННЫЙ ТРЕНЕР', 'TEKSHIRILGAN MURABBIY') : L('ТРЕНЕР', 'MURABBIY'), W / 2, 870, { size: 32, weight: 800, color: u.coachPro ? C.court : C.white, max: 500 });
  text(g, regionShort(regionOf(u)), W / 2, 950, { size: 36, weight: 600, color: C.soft });
  tiles3(g, 1000, [[st.avg ? comma(st.avg) + '★' : '—', `${st.reviews.length} ${L('отзывов', 'fikr')}`, C.ball], [String(st.students), L('учеников', 'shogird')], [String(st.trainings), L('занятий', 'mashg‘ulot')]]);
  const cc = u.coach || {}; let y = 1320;
  if (cc.price) { text(g, `${fmtNum(cc.price)} ${L('сум / час', 'so‘m / soat')}`, W / 2, y, { size: 60, fam: 'Oswald', color: C.ball }); y += 90; }
  for (const k of (cc.equipment || []).slice(0, 4)) { text(g, '✓  ' + equipmentName(k), W / 2, y, { size: 40, weight: 700 }); y += 66; }
  if ((cc.specialization || []).length && y < 1650) text(g, cc.specialization.slice(0, 3).join(' · '), W / 2, y + 10, { size: 34, weight: 600, color: C.soft });
}
async function matchCard(g, u, m, store) {
  await base(g);
  const won = wonBy(m, u.id); const mine = m.teamA.includes(u.id) ? 'A' : 'B';
  text(g, won ? L('ПОБЕДА!', 'G‘ALABA!') : L('МАТЧ', 'O‘YIN'), W / 2, 420, { size: 170, fam: 'Oswald', color: won ? C.ball : C.white });
  text(g, `${m.type === 'double' ? L('Парный', 'Juftlik') : L('Одиночный', 'Yakka')} · ${fmtDate(m.playedAt)}`, W / 2, 500, { size: 38, weight: 600, color: C.soft });
  const side = (s) => (s === 'A' ? m.teamA : m.teamB).map((id) => (m.type === 'double' ? shortName(store.user(id)) : fullName(store.user(id)))).join(' / ');
  const rows = [[side(mine), mine], [side(mine === 'A' ? 'B' : 'A'), mine === 'A' ? 'B' : 'A']];
  rrect(g, 90, 600, W - 180, 470, 40); g.fillStyle = 'rgba(255,255,255,.08)'; g.fill();
  const winSide = m.winner || winnerFromSets(m.sets);
  rows.forEach(([name, s], i) => {
    const y = 760 + i * 200;
    text(g, name, 140, y, { size: 54, weight: 800, align: 'left', max: 520, color: s === winSide ? C.ball : C.white });
    m.sets.forEach((set, k) => {
      const v = s === 'A' ? set[0] : set[1], o = s === 'A' ? set[1] : set[0];
      const x = 720 + k * 100 - (m.sets.length - 3) * 50;
      text(g, String(v), x, y + 10, { size: 96, fam: 'Oswald', color: v > o ? C.ball : 'rgba(255,255,255,.55)' });
    });
  });
  g.strokeStyle = 'rgba(255,255,255,.15)'; g.lineWidth = 3; g.beginPath(); g.moveTo(140, 835); g.lineTo(W - 140, 835); g.stroke();
  let y = 1170;
  if (m.court) { text(g, '📍 ' + m.court.name + (m.court.city ? ', ' + m.court.city : ''), W / 2, y, { size: 40, weight: 700 }); y += 80; }
  const d = m.deltas?.[u.id];
  if (d) { text(g, `${L('Рейтинг', 'Reyting')} ${d > 0 ? '+' : '−'}${Math.abs(d)}`, W / 2, y + 40, { size: 64, fam: 'Oswald', color: d > 0 ? C.ball : C.soft }); y += 120; }
  text(g, `${L('Уровень силы', 'Kuch darajasi')} ${formatStrength(u.rating)} · ${leagueName(u.league)}`, W / 2, y + 40, { size: 40, weight: 700, color: C.soft });
}
async function awardCard(g, u, a) {
  await base(g);
  const c = CUPS[a.code] || { bg: C.ball, bd: C.white, fg: C.court, ru: a.title, uz: a.title };
  g.beginPath(); g.arc(W / 2, 640, 260, 0, Math.PI * 2); g.fillStyle = c.bg; g.fill(); g.lineWidth = 22; g.strokeStyle = c.bd; g.stroke();
  const im = await svgImg(cupSvg(c.fg)); if (im) g.drawImage(im, W / 2 - 160, 640 - 160, 320, 320);
  text(g, L(c.ru, c.uz) || a.title, W / 2, 1060, { size: 92, fam: 'Oswald', upper: true, color: C.ball });
  text(g, (a.detail || '').split(' · ')[0], W / 2, 1150, { size: 48, weight: 800 });
  const rest = (a.detail || '').split(' · ').slice(1).join(' · ');
  if (rest) text(g, rest, W / 2, 1215, { size: 36, weight: 600, color: C.soft });
  await avatarAt(g, u, W / 2, 1420, 110);
  text(g, fullName(u), W / 2, 1620, { size: 64, fam: 'Oswald', upper: true });
  text(g, fmtDate(a.createdAt), W / 2, 1680, { size: 34, weight: 600, color: C.soft });
}

async function render(kind, payload) {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  if (kind === 'card') await playerCard(g, ...payload);
  if (kind === 'coach') await coachCard(g, ...payload);
  if (kind === 'match') await matchCard(g, ...payload);
  if (kind === 'award') await awardCard(g, ...payload);
  return new Promise((ok) => cv.toBlob(ok, 'image/png'));
}

async function shareBlob(blob, caption) {
  const file = new File([blob], 'ace-tennis.png', { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], text: caption }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'ace-tennis.png';
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 30000);
  toast(L('Картинка сохранена — опубликуйте её в Instagram', 'Rasm saqlandi — uni Instagramga joylang'));
}

// Chooser: card / one of the last matches / an award → preview → share
export async function shareSheet(store, userId) {
  const u = store.user(userId); if (!u) return;
  const isCoach = u.role === 'coach';
  const [hist, ach, st] = await Promise.all([isCoach ? { matches: [] } : store.history(userId), store.achievements(userId).catch(() => []),
    isCoach ? store.coachStats(userId) : null]);
  const place = !isCoach ? (await store.ranking({ league: u.league, period: 'quarter', region: regionOf(u) }).catch(() => [])).find((x) => x.id === userId)?.place : null;
  const awards = ach.filter((a) => CUPS[a.code]).slice(0, 6);
  const matches = hist.matches.slice(0, 5);
  const opt = (k, title, sub) => `<button type="button" class="card" data-k="${k}" style="display:block;width:100%;text-align:left;margin:8px 0 0;cursor:pointer"><div class="strong">${title}</div>${sub ? `<div class="muted small">${sub}</div>` : ''}</button>`;
  sheet(`<h2 class="h">${L('Поделиться', 'Ulashish')}</h2>
    <div class="muted small">${L('Сделаем картинку для истории Instagram, Telegram или WhatsApp.', 'Instagram, Telegram yoki WhatsApp hikoyasi uchun rasm tayyorlaymiz.')}</div>
    <div id="shOpts">
      ${opt('card', isCoach ? L('Карточка тренера', 'Murabbiy kartasi') : L('Моя карточка игрока', 'O‘yinchi kartam'), isCoach ? L('Рейтинг, ученики, инвентарь', 'Reyting, shogirdlar, jihozlar') : L('Уровень силы, лига, место, награды', 'Kuch darajasi, liga, o‘rin, mukofotlar'))}
      ${matches.map((m, i) => opt('m' + i, `${wonBy(m, userId) ? L('Победа', 'G‘alaba') : L('Матч', 'O‘yin')}: ${esc((m.teamA.includes(userId) ? m.teamB : m.teamA).map((id) => shortName(store.user(id))).join(' / '))}`, `${fmtDate(m.playedAt)} · ${formatSets(m.sets.map(([a, b]) => (m.teamA.includes(userId) ? [a, b] : [b, a])))}`)).join('')}
      ${awards.map((a, i) => opt('a' + i, L(CUPS[a.code].ru, CUPS[a.code].uz), esc((a.detail || '').split(' · ')[0]))).join('')}
    </div>
    <div id="shPrev" hidden>
      <img id="shImg" alt="" style="display:block;width:100%;max-width:300px;margin:12px auto;border-radius:16px;box-shadow:0 6px 24px rgba(0,0,0,.25)">
      <div class="muted small center">${L('Нажмите «Поделиться» и выберите Instagram → История', '«Ulashish»ni bosing va Instagram → Hikoya ni tanlang')}</div>
      <div class="grid2 mt"><button type="button" class="btn ghost" id="shBack">${L('Назад', 'Orqaga')}</button><button type="button" class="btn ball" id="shGo">${L('Поделиться', 'Ulashish')}</button></div>
    </div>
    <button type="button" class="btn ghost block mt" data-close>${L('Закрыть', 'Yopish')}</button>`, (el) => {
    let blob = null; let caption = '';
    el.querySelectorAll('[data-k]').forEach((b) => b.addEventListener('click', async () => {
      const k = b.dataset.k; b.disabled = true;
      try {
        if (k === 'card') { blob = await render(isCoach ? 'coach' : 'card', isCoach ? [u, st] : [u, ach, place]); caption = isCoach ? L(`Тренер по теннису ${fullName(u)} в Ace Tennis — ace-tennis.uz`, `Tennis murabbiyi ${fullName(u)} Ace Tennis’da — ace-tennis.uz`) : L(`Мой теннисный профиль в Ace Tennis — ace-tennis.uz`, `Ace Tennis’dagi tennis profilim — ace-tennis.uz`); }
        if (k[0] === 'm') { blob = await render('match', [u, matches[+k.slice(1)], store]); caption = L('Мой матч в Ace Tennis — ace-tennis.uz', 'Ace Tennis’dagi o‘yinim — ace-tennis.uz'); }
        if (k[0] === 'a') { blob = await render('award', [u, awards[+k.slice(1)]]); caption = L('Моя награда в Ace Tennis — ace-tennis.uz', 'Ace Tennis’dagi mukofotim — ace-tennis.uz'); }
        const img = el.querySelector('#shImg'); if (img.src) URL.revokeObjectURL(img.src); img.src = URL.createObjectURL(blob);
        el.querySelector('#shOpts').hidden = true; el.querySelector('#shPrev').hidden = false;
      } catch (e) { toast(e.message); } finally { b.disabled = false; }
    }));
    el.querySelector('#shBack').addEventListener('click', () => { el.querySelector('#shOpts').hidden = false; el.querySelector('#shPrev').hidden = true; });
    el.querySelector('#shGo').addEventListener('click', () => { if (blob) shareBlob(blob, caption); });
  });
}
