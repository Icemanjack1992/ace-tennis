// Court accounts and booking: court page for players, booking, payment with a receipt, "my bookings",
// the court owner's schedule and settings, court requests, push notifications.
import { L, esc, icon, sheet, toast, fmtNum, fullName, avatar, normPhone, TERMS_VERSION } from './ui.js';
import { REGIONS, regionShort } from './regions.js';
import { SURFACES, surfaceName, yandexLink, googleLink, parseCoords, hasPoint, makeMap, pin, CENTER } from './courts.js';
import { tashLocal, tashIso, tashToday, addDays, courtPrice } from './logic.js';
import { act, termsCheck, bindTerms, resizeImage } from './views.js';

const rerender = () => window.dispatchEvent(new Event('ace:rerender'));
const go = (h) => (location.hash === h ? rerender() : (location.hash = h));
const back = (href) => `<a href="${href}" class="iconbtn light" aria-label="${L('Назад', 'Orqaga')}">${icon.back}</a>`;
export const money = (n) => `${fmtNum(Math.round(n || 0))} ${L('сум', 'so‘m')}`;
const hm = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
const timeOf = (iso) => hm(tashLocal(iso).min);
const endOf = (iso) => { const t = tashLocal(new Date(Date.parse(iso) - 60e3).toISOString()); return hm(t.min + 1); };
const DOW = [['Пн', 'Du'], ['Вт', 'Se'], ['Ср', 'Ch'], ['Чт', 'Pa'], ['Пт', 'Ju'], ['Сб', 'Sh'], ['Вс', 'Ya']];
const MONTHS = [['янв', 'yan'], ['фев', 'fev'], ['мар', 'mar'], ['апр', 'apr'], ['мая', 'may'], ['июн', 'iyn'], ['июл', 'iyl'], ['авг', 'avg'], ['сен', 'sen'], ['окт', 'okt'], ['ноя', 'noy'], ['дек', 'dek']];
const dayLabel = (date) => {
  const d = new Date(`${date}T00:00:00Z`); const dw = DOW[(d.getUTCDay() + 6) % 7];
  const today = tashToday();
  const word = date === today ? L('Сегодня', 'Bugun') : date === addDays(today, 1) ? L('Завтра', 'Ertaga') : L(dw[0], dw[1]);
  return { word, num: d.getUTCDate(), month: L(MONTHS[d.getUTCMonth()][0], MONTHS[d.getUTCMonth()][1]) };
};
const dayText = (date) => { const x = dayLabel(date); return `${x.word}, ${x.num} ${x.month}`; };
const slotText = (b) => `${dayText(tashLocal(b.start).date)} · ${timeOf(b.start)}–${endOf(b.end)}`;
const durText = (min) => (min % 60 ? `${Math.floor(min / 60)},5 ${L('ч', 'soat')}` : `${min / 60} ${L('ч', 'soat')}`);
const stars = (sum, count) => (count ? `<span class="stars">★</span> <b>${(sum / count).toFixed(1).replace('.', ',')}</b> <span class="muted">(${count})</span>` : `<span class="muted">${L('нет оценок', 'baho yo‘q')}</span>`);

export const AMENITIES = [
  ['shower', 'Душ', 'Dush'], ['locker', 'Раздевалка', 'Kiyinish xonasi'], ['toilet', 'Туалет', 'Hojatxona'], ['parking', 'Парковка', 'Avtoturargoh'],
  ['water', 'Питьевая вода', 'Ichimlik suvi'], ['rackets', 'Прокат ракеток', 'Raketka ijarasi'], ['balls', 'Мячи', 'Koptoklar'],
  ['cafe', 'Кафе', 'Kafe'], ['wifi', 'Wi-Fi', 'Wi-Fi'], ['stands', 'Трибуны', 'Tribunalar'], ['coach', 'Тренер на корте', 'Kortda murabbiy'], ['ac', 'Кондиционер', 'Konditsioner'],
];
const amenityName = (k) => { const a = AMENITIES.find((x) => x[0] === k); return a ? L(a[1], a[2]) : k; };

// status → [label, tag class]
export function statusOf(b) {
  if (b.status === 'cash') return [L('Наличными · не оплачено', 'Naqd · to‘lanmagan'), 'warn'];
  if (b.status === 'await_pay') return [L('Ждёт оплату', 'To‘lov kutilmoqda'), 'warn'];
  if (b.status === 'paid') return [L('Чек на проверке', 'Chek tekshirilmoqda'), 'soft'];
  if (b.status === 'confirmed') return [b.pay === 'cash' ? L('Оплачено на месте', 'Joyida to‘langan') : L('Подтверждена · оплачено', 'Tasdiqlangan · to‘langan'), 'ok'];
  if (b.status === 'blocked') return [L('Занято (вне приложения)', 'Band (ilovadan tashqari)'), 'soft'];
  if (b.status === 'cancelled') return [b.cancelledBy === 'court' ? L('Отменена кортом', 'Kort bekor qildi') : L('Отменена', 'Bekor qilingan'), 'bad'];
  if (b.status === 'declined') return [L('Корт отклонил', 'Kort rad etdi'), 'bad'];
  if (b.status === 'expired') return [L('Не оплачена вовремя', 'Vaqtida to‘lanmadi'), 'bad'];
  return [b.status, 'soft'];
}
const statusTag = (b) => { const [t, c] = statusOf(b); return `<span class="tag ${c}" style="flex-shrink:0;align-self:flex-start;max-width:48%;text-align:right">${t}</span>`; };
const isActive = (b) => ['cash', 'await_pay', 'paid', 'confirmed', 'blocked'].includes(b.status);

// ---------- push notifications ----------
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const standalone = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
const keyBytes = (b64) => { const s = atob(b64.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (b64.length % 4)) % 4)); return Uint8Array.from(s, (c) => c.charCodeAt(0)); };
export async function pushState() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return isIOS() && !standalone() ? 'ios' : 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  try { const reg = await navigator.serviceWorker.getRegistration(); const sub = await reg?.pushManager.getSubscription(); return sub && Notification.permission === 'granted' ? 'on' : 'off'; } catch { return 'off'; }
}
export async function enablePush(store) {
  const st = await pushState();
  if (st === 'ios') throw new Error(L('На iPhone: нажмите «Поделиться» → «На экран Домой», откройте Ace Tennis со значка и включите уведомления там', 'iPhone’da: «Ulashish» → «Bosh ekranga», Ace Tennis’ni belgidan oching va bildirishnomalarni o‘sha yerda yoqing'));
  if (st === 'unsupported') throw new Error(L('Этот браузер не поддерживает уведомления', 'Bu brauzer bildirishnomalarni qo‘llamaydi'));
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error(L('Уведомления запрещены — разрешите их в настройках браузера', 'Bildirishnomalar taqiqlangan — brauzer sozlamalarida ruxsat bering'));
  const reg = await navigator.serviceWorker.ready;
  const key = keyBytes(await store.pushKey());
  let sub = await reg.pushManager.getSubscription();
  const same = sub?.options?.applicationServerKey && new Uint8Array(sub.options.applicationServerKey).join() === key.join();
  if (sub && !same) { try { await sub.unsubscribe(); } catch { /* ignore */ } sub = null; }
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  await store.savePushSub(sub);
}
export async function disablePush(store) {
  const reg = await navigator.serviceWorker.getRegistration(); const sub = await reg?.pushManager.getSubscription();
  if (sub) { await store.deletePushSub(sub.endpoint); await sub.unsubscribe(); }
}
// Card "turn on notifications" (shown only when they are off)
export async function pushCard(text) {
  const st = await pushState();
  if (st === 'on' || st === 'unsupported') return '';
  return `<div class="card hl"><div class="row" style="gap:10px;align-items:flex-start">${icon.bell}<div class="grow"><div class="strong">${L('Уведомления на телефон', 'Telefonga bildirishnomalar')}</div>
    <div class="muted small">${st === 'denied' ? L('Уведомления запрещены в настройках браузера — разрешите их для ace-tennis.uz', 'Brauzer sozlamalarida ace-tennis.uz uchun ruxsat bering') : text}</div></div></div>
    ${st === 'denied' ? '' : `<button class="btn ball block mt" data-push>${L('Включить уведомления', 'Bildirishnomalarni yoqish')}</button>`}</div>`;
}
export function bindPush(root, store) {
  root.querySelector('[data-push]')?.addEventListener('click', (e) => act(e.currentTarget, async () => { await enablePush(store); toast(L('Уведомления включены', 'Bildirishnomalar yoqildi')); rerender(); }));
}

// =====================================================================
// Court page for players: photos, amenities, prices, reviews, booking
// =====================================================================
const bState = { courtId: null, day: null, unit: 1, minutes: 60 };
function photoStrip(list, h = 200) {
  if (!list?.length) return '';
  return `<div class="chips scroll" style="gap:8px">${list.map((u) => `<img src="${esc(u)}" alt="" loading="lazy" data-zoom="${esc(u)}" style="height:${h}px;max-width:86vw;border-radius:16px;object-fit:cover;flex-shrink:0;cursor:zoom-in">`).join('')}</div>`;
}
function priceTable(c) {
  const days = { wd: L('Будни', 'Ish kunlari'), we: L('Выходные', 'Dam olish'), all: L('Все дни', 'Har kuni') };
  if (!c.priceRules?.length) return `<div class="muted">${c.price ? esc(c.price) : L('Цены уточняйте по телефону', 'Narxni telefon orqali aniqlang')}</div>`;
  return [...c.priceRules].sort((a, b) => (a.d > b.d ? 1 : a.d < b.d ? -1 : a.f - b.f))
    .map((r) => `<div class="kv" style="min-height:38px"><span>${days[r.d]} · ${hm(r.f)}–${hm(r.t)}</span><b>${money(r.p)}/${L('час', 'soat')}</b></div>`).join('');
}
export const courtPage = {
  async render([id], store) {
    const me = store.me();
    const c = await store.court(id);
    if (!c) return `<div class="pagehead">${back('#/courts')}<h1 class="title">${L('Корт', 'Kort')}</h1></div><div class="wrap"><div class="card">${L('Корт не найден', 'Kort topilmadi')}</div></div>`;
    if (bState.courtId !== id) Object.assign(bState, { courtId: id, day: tashToday(), unit: 1, minutes: 60 });
    const reviews = await store.courtReviews(id);
    const canBook = c.bookingOn && c.ownerId && ['player', 'coach'].includes(me.role);
    const own = c.ownerId === me.id;
    return `<div class="pagehead">${back(own ? '#/venue' : '#/courts')}<h1 class="title" style="text-transform:none">${esc(c.name)}</h1></div>
    <div class="wrap">
      ${photoStrip(c.photos?.court, 210)}
      <div class="card">
        <div class="row between" style="align-items:flex-start;gap:8px"><div class="grow"><div class="strong" style="font-size:18px">${esc(c.name)}</div>
          <div class="muted small">${esc([c.city, c.address].filter(Boolean).join(', '))}</div></div>
          ${c.verified ? `<span class="tag ok">✓ ${L('Проверенный корт', 'Tekshirilgan kort')}</span>` : ''}</div>
        <div class="mt">${stars(c.ratingSum, c.ratingCount)}</div>
        <div class="chips mt" style="gap:6px"><span class="tag soft">${c.courts} ${L('корт.', 'kort')}</span>${c.surface ? `<span class="tag soft">${surfaceName(c.surface)}</span>` : ''}
          ${c.indoor ? `<span class="tag soft">${L('крытый', 'yopiq')}</span>` : ''}${c.lights ? `<span class="tag soft">${L('освещение', 'yoritish')}</span>` : ''}
          <span class="tag soft">${hm(c.openMin)}–${hm(c.closeMin)}</span></div>
        ${c.description ? `<div class="mt">${esc(c.description)}</div>` : ''}
        <div class="row mt" style="gap:8px;flex-wrap:wrap">
          ${c.phone ? `<a class="btn ghost sm" href="tel:${esc(c.phone.replace(/[^\d+]/g, ''))}">📞 ${esc(c.phone)}</a>` : ''}
          ${hasPoint(c) ? `<a class="btn ghost sm" href="${yandexLink(c)}" target="_blank" rel="noopener">${L('Яндекс', 'Yandex')}</a><a class="btn ghost sm" href="${googleLink(c)}" target="_blank" rel="noopener">Google</a>` : ''}</div>
      </div>
      ${c.amenities?.length ? `<div class="card"><h2 class="h">${L('Удобства', 'Qulayliklar')}</h2><div class="chips">${c.amenities.map((a) => `<span class="tag soft">${amenityName(a)}</span>`).join('')}</div>
        ${c.photos?.shower?.length ? `<div class="muted small mt">${L('Душ', 'Dush')}</div>${photoStrip(c.photos.shower, 120)}` : ''}
        ${c.photos?.locker?.length ? `<div class="muted small mt">${L('Раздевалка', 'Kiyinish xonasi')}</div>${photoStrip(c.photos.locker, 120)}` : ''}</div>` : ''}
      <div class="card"><h2 class="h">${L('Цены', 'Narxlar')}</h2>${priceTable(c)}</div>
      ${canBook ? `<div class="card" id="bookbox">${await bookingWidget(c, store)}</div>` : c.bookingOn || own ? '' : `<div class="card muted">${L('Этот корт пока не принимает брони через приложение — звоните по телефону.', 'Bu kort hozircha ilova orqali bron qabul qilmaydi — telefon qiling.')}</div>`}
      <div class="card"><h2 class="h">${L('Отзывы', 'Sharhlar')}</h2>
        ${reviews.length ? reviews.map((r) => { const u = store.user(r.authorId); return `<div class="row" style="gap:10px;align-items:flex-start;margin-top:10px">${avatar(u)}<div class="grow"><div class="row between"><b>${esc(fullName(u))}</b><span class="stars">${'★'.repeat(r.stars)}</span></div>${r.text ? `<div class="small">${esc(r.text)}</div>` : ''}</div></div>`; }).join('')
          : `<div class="empty">${L('Отзывы оставляют игроки после игры по брони', 'Sharhni bron bo‘yicha o‘ynagan o‘yinchilar qoldiradi')}</div>`}</div>
    </div>`;
  },
  mount(root, [id], store) {
    root.querySelectorAll('[data-zoom]').forEach((img) => img.addEventListener('click', () => sheet(`<img src="${esc(img.dataset.zoom)}" alt="" style="width:100%;border-radius:14px"><button class="btn ghost block mt" data-close>${L('Закрыть', 'Yopish')}</button>`)));
    bindBooking(root, store, id);
  },
};

async function bookingWidget(c, store) {
  const days = Array.from({ length: 14 }, (_, i) => addDays(tashToday(), i));
  if (!days.includes(bState.day)) bState.day = days[0];
  if (bState.unit > c.courts) bState.unit = 1;
  const busy = await store.courtBusy(c.id, bState.day);
  const slots = [];
  for (let m = c.openMin; m + bState.minutes <= c.closeMin; m += 30) {
    const iso = tashIso(bState.day, m);
    const end = Date.parse(iso) + bState.minutes * 60e3;
    const price = courtPrice(c, iso, bState.minutes);
    const taken = busy.some((b) => b.unit === bState.unit && Date.parse(b.start) < end && Date.parse(b.end) > Date.parse(iso));
    const past = Date.parse(iso) < Date.now();
    slots.push({ m, iso, price, off: taken || past || price === null, taken });
  }
  const free = slots.filter((s) => !s.off).length;
  return `<h2 class="h">${L('Забронировать', 'Bron qilish')}</h2>
    <div class="chips scroll" style="gap:6px">${days.map((d) => { const x = dayLabel(d); return `<button class="chip ${d === bState.day ? 'on' : ''}" data-bday="${d}" style="height:auto;padding:6px 12px;line-height:1.15;text-align:center"><div class="small">${x.word}</div><b>${x.num}</b> <span class="small">${x.month}</span></button>`; }).join('')}</div>
    ${c.courts > 1 ? `<label class="f">${L('Корт', 'Kort')}</label><div class="chips">${Array.from({ length: c.courts }, (_, i) => `<button class="chip ${bState.unit === i + 1 ? 'on' : ''}" data-bunit="${i + 1}">${L('Корт', 'Kort')} ${i + 1}</button>`).join('')}</div>` : ''}
    <label class="f">${L('Сколько играть', 'Qancha o‘ynash')}</label>
    <div class="seg">${[60, 90, 120, 180].map((m) => `<button class="${bState.minutes === m ? 'on' : ''}" data-bmin="${m}">${durText(m)}</button>`).join('')}</div>
    <label class="f">${L('Начало', 'Boshlanishi')} · <span class="muted">${free ? L(`свободно ${free}`, `${free} ta bo‘sh`) : L('свободного времени нет', 'bo‘sh vaqt yo‘q')}</span></label>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(92px,1fr));gap:8px">${slots.map((s) => `<button class="chip ${s.off ? '' : 'ball'}" ${s.off ? 'disabled' : `data-bslot="${s.iso}" data-bprice="${s.price}"`}
      style="height:auto;padding:8px 6px;line-height:1.2;text-align:center;${s.off ? 'opacity:.38;text-decoration:' + (s.taken ? 'line-through' : 'none') : ''}"><b>${hm(s.m)}</b><div class="small">${s.taken ? L('занято', 'band') : s.price === null ? '—' : fmtNum(s.price)}</div></button>`).join('')}</div>
    <div class="muted small mt">${L('Цена — за всё выбранное время. Отмена бесплатно — не позднее чем за 12 часов до игры.', 'Narx — butun tanlangan vaqt uchun. Bekor qilish — o‘yindan kamida 12 soat oldin.')}</div>`;
}
function bindBooking(root, store, id) {
  const box = root.querySelector('#bookbox'); if (!box) return;
  const redraw = async () => {
    const c = await store.court(id);
    box.innerHTML = await bookingWidget(c, store);
    bindBooking(root, store, id);
  };
  box.querySelectorAll('[data-bday]').forEach((b) => b.addEventListener('click', () => { bState.day = b.dataset.bday; redraw(); }));
  box.querySelectorAll('[data-bunit]').forEach((b) => b.addEventListener('click', () => { bState.unit = +b.dataset.bunit; redraw(); }));
  box.querySelectorAll('[data-bmin]').forEach((b) => b.addEventListener('click', () => { bState.minutes = +b.dataset.bmin; redraw(); }));
  box.querySelectorAll('[data-bslot]').forEach((b) => b.addEventListener('click', async () => {
    const c = await store.court(id);
    confirmBookingSheet(store, c, { start: b.dataset.bslot, price: +b.dataset.bprice }, redraw);
  }));
}

function confirmBookingSheet(store, c, { start, price }, redraw) {
  const me = store.me();
  const hasCard = !!c.ownerId && c.bookingOn; // the server checks the card itself
  const end = new Date(Date.parse(start) + bState.minutes * 60e3).toISOString();
  sheet(`<h2 class="h">${L('Бронь корта', 'Kortni bron qilish')}</h2>
    <div class="card" style="margin:0"><div class="strong">${esc(c.name)}${c.courts > 1 ? ` · ${L('Корт', 'Kort')} ${bState.unit}` : ''}</div>
      <div>${dayText(bState.day)} · <b>${timeOf(start)}–${endOf(end)}</b> (${durText(bState.minutes)})</div>
      <div class="num mt" style="font-size:24px">${money(price)}</div></div>
    <label class="f">${L('Оплата', 'To‘lov')}</label>
    <div class="list">
      <label class="row card" style="gap:10px;margin:0 0 8px;cursor:pointer;align-items:flex-start"><input type="radio" name="bpay" value="card" ${hasCard ? 'checked' : 'disabled'} style="width:20px;height:20px;accent-color:var(--court)">
        <div><div class="strong">💳 ${L('Предоплата на карту корта', 'Kort kartasiga oldindan to‘lov')}</div><div class="muted small">${L('Полная сумма. Переведите в течение 30 минут и прикрепите чек — после проверки корт подтвердит бронь (зелёная).', 'To‘liq summa. 30 daqiqa ichida o‘tkazing va chekni biriktiring — kort tasdiqlaydi.')}</div></div></label>
      <label class="row card" style="gap:10px;margin:0;cursor:pointer;align-items:flex-start"><input type="radio" name="bpay" value="cash" ${hasCard ? '' : 'checked'} style="width:20px;height:20px;accent-color:var(--court)">
        <div><div class="strong">💵 ${L('Наличными на корте', 'Kortda naqd pul')}</div><div class="muted small">${L('Бронь будет «не оплачена» (жёлтая), пока вы не заплатите на месте.', 'To‘lamaguningizcha bron «to‘lanmagan» (sariq) bo‘ladi.')}</div></div></label>
    </div>
    <div class="muted small mt">🔒 ${L(`Корт получит ваше имя и номер телефона (${esc(me.phone ? '+' + String(me.phone).replace(/\D/g, '') : '—')}) — чтобы связаться по брони.`, `Kort ismingiz va telefon raqamingizni oladi — bron bo‘yicha bog‘lanish uchun.`)}</div>
    <div class="grid2 mt"><button type="button" class="btn ghost" data-close>${L('Отмена', 'Bekor')}</button><button class="btn ball" id="bGo">${L('Забронировать', 'Bron qilish')}</button></div>`, (el, close) => {
    el.querySelector('#bGo').addEventListener('click', (e) => act(e.currentTarget, async () => {
      const pay = el.querySelector('input[name=bpay]:checked')?.value || 'cash';
      try {
        const id = await store.bookCourt({ courtId: c.id, unit: bState.unit, start, minutes: bState.minutes, pay });
        close();
        if (pay === 'card') paySheet(store, id, () => go('#/bookings'));
        else { toast(L('Готово! Бронь отправлена корту', 'Tayyor! Bron kortga yuborildi')); go('#/bookings'); }
      } catch (err) { close(); toast(err.message); redraw?.(); }
    }));
  });
}

// Card number, amount, 30-minute timer, receipt upload
export async function paySheet(store, bookingId, done) {
  const info = await store.payInfo(bookingId);
  sheet(`<h2 class="h">${L('Оплата брони', 'Bron to‘lovi')}</h2>
    <div class="muted">${esc(info.court)}</div>
    <div class="card hl" style="margin:10px 0">
      <div class="muted small">${L('Переведите на карту корта', 'Kort kartasiga o‘tkazing')}</div>
      <div class="row between mt"><b style="font-size:20px;letter-spacing:.06em">${esc(info.card || '—')}</b><button class="btn ghost sm" data-copycard>${L('Копировать', 'Nusxalash')}</button></div>
      ${info.holder ? `<div class="small">${esc(info.holder)}</div>` : ''}
      <div class="num mt" style="font-size:24px">${money(info.price)}</div>
      ${info.holdUntil ? `<div class="small strong mt" id="hold" style="color:var(--bad)"></div>` : ''}
    </div>
    <div class="muted small">${L('После перевода сделайте скриншот чека в банковском приложении (Click, Payme, Uzum и др.) и прикрепите его здесь.', 'O‘tkazgandan keyin bank ilovasidagi chek skrinshotini shu yerga biriktiring.')}</div>
    <label class="btn ball block mt" style="cursor:pointer">🧾 ${L('Прикрепить чек', 'Chekni biriktirish')}<input type="file" id="rcpt" accept="image/*,application/pdf" hidden></label>
    <button type="button" class="btn ghost block mt" data-close>${L('Оплачу позже', 'Keyinroq to‘layman')}</button>`, (el, close) => {
    el.querySelector('[data-copycard]').addEventListener('click', async () => { try { await navigator.clipboard.writeText(String(info.card).replace(/\s/g, '')); toast(L('Номер карты скопирован', 'Karta raqami nusxalandi')); } catch { toast(info.card); } });
    const holdEl = el.querySelector('#hold');
    if (holdEl) {
      const tick = () => { if (!document.body.contains(holdEl)) return; const s = Math.max(0, Math.round((Date.parse(info.holdUntil) - Date.now()) / 1000));
        holdEl.textContent = s ? L(`Бронь держится ещё ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`, `Bron yana ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} saqlanadi`) : L('Время вышло — бронь снята', 'Vaqt tugadi — bron bekor qilindi');
        if (s) setTimeout(tick, 1000); };
      tick();
    }
    el.querySelector('#rcpt').addEventListener('change', async (e) => {
      const f = e.target.files[0]; if (!f) return;
      const lbl = e.target.closest('label'); lbl.style.opacity = '.6';
      try {
        const file = f.type === 'application/pdf' ? f : new File([await (await fetch(await resizeImage(f, 1600))).blob()], 'receipt.jpg', { type: 'image/jpeg' });
        await store.attachReceipt(bookingId, file);
        close(); toast(L('Чек отправлен — корт проверит оплату', 'Chek yuborildi — kort to‘lovni tekshiradi')); done?.();
      } catch (err) { toast(err.message); lbl.style.opacity = ''; }
    });
  });
}

// =====================================================================
// My bookings (player)
// =====================================================================
export const bookingsView = {
  async render(_, store) {
    const list = await store.myBookings();
    const now = Date.now();
    const upcoming = list.filter((b) => Date.parse(b.end) > now && isActive(b)).sort((a, b) => a.start.localeCompare(b.start));
    const past = list.filter((b) => !upcoming.includes(b)).slice(0, 30);
    const card = (b) => {
      const c = b.court || {};
      const startsIn = Date.parse(b.start) - now;
      const canCancel = isActive(b) && (b.status === 'await_pay' || startsIn >= 12 * 3600e3);
      const ended = Date.parse(b.end) < now;
      return `<div class="card">
        <div class="row between" style="align-items:flex-start;gap:8px"><a class="strong" href="#/court/${b.courtId}" style="color:inherit">${esc(c.name || L('Корт', 'Kort'))}${c.courts > 1 ? ` · ${L('Корт', 'Kort')} ${b.unit}` : ''}</a>${statusTag(b)}</div>
        <div class="mt">${slotText(b)}</div>
        <div class="row between mt"><b>${money(b.price)}</b><span class="muted small">${b.pay === 'card' ? L('карта', 'karta') : L('наличные', 'naqd')}</span></div>
        ${b.cancelReason ? `<div class="muted small mt">💬 ${esc(b.cancelReason)}</div>` : ''}
        <div class="row mt" style="gap:8px;flex-wrap:wrap">
          ${b.status === 'await_pay' ? `<button class="btn ball sm" data-pay="${b.id}">${L('Оплатить и прикрепить чек', 'To‘lash va chek biriktirish')}</button>` : ''}
          ${canCancel ? `<button class="btn ghost sm" data-cancel="${b.id}" data-paid="${b.status === 'paid' || (b.status === 'confirmed' && b.pay === 'card') ? 1 : ''}">${L('Отменить', 'Bekor qilish')}</button>` : ''}
          ${isActive(b) && !canCancel && !ended && c.phone ? `<a class="btn ghost sm" href="tel:${esc(c.phone.replace(/[^\d+]/g, ''))}">📞 ${L('Позвонить корту', 'Kortga qo‘ng‘iroq')}</a>` : ''}
          ${ended && ['cash', 'confirmed'].includes(b.status) && !b.noshow && !b.reviewed ? `<button class="btn ball sm" data-review="${b.id}">★ ${L('Оценить корт', 'Kortni baholash')}</button>` : ''}
          ${ended && b.reviewed ? `<span class="muted small">${L('Спасибо за оценку', 'Baho uchun rahmat')}</span>` : ''}
        </div>
        ${isActive(b) && !canCancel && !ended ? `<div class="muted small mt">${L('До игры меньше 12 часов — отменить можно только по договорённости с кортом.', 'O‘yingacha 12 soatdan kam — faqat kort bilan kelishib bekor qilinadi.')}</div>` : ''}
      </div>`;
    };
    return `<div class="pagehead">${back('#/home')}<h1 class="title">${L('Мои брони', 'Bronlarim')}</h1></div>
    <div class="wrap">
      ${await pushCard(L('Узнавайте сразу, когда корт подтвердит или отменит бронь.', 'Kort bronni tasdiqlasa yoki bekor qilsa, darhol bilib oling.'))}
      <a class="btn ball block" href="#/courts">${L('+ Забронировать корт', '+ Kortni bron qilish')}</a>
      <h2 class="h mt">${L('Предстоящие', 'Kelgusi')}</h2>
      ${upcoming.map(card).join('') || `<div class="empty">${L('Активных броней нет', 'Faol bron yo‘q')}</div>`}
      ${past.length ? `<h2 class="h mt">${L('История', 'Tarix')}</h2>${past.map(card).join('')}` : ''}
    </div>`;
  },
  mount(root, _, store) {
    bindPush(root, store);
    root.querySelectorAll('[data-pay]').forEach((b) => b.addEventListener('click', () => paySheet(store, b.dataset.pay, rerender).catch((e) => toast(e.message))));
    root.querySelectorAll('[data-cancel]').forEach((b) => b.addEventListener('click', () => {
      const paid = !!b.dataset.paid;
      sheet(`<h2 class="h">${L('Отменить бронь?', 'Bron bekor qilinsinmi?')}</h2>
        ${paid ? `<div class="card hl" style="margin:8px 0">${L('Вы уже оплатили картой. Чтобы вернуть деньги, свяжитесь с кортом — номер будет показан после отмены.', 'Siz karta orqali to‘lagansiz. Pulni qaytarish uchun kort bilan bog‘laning.')}</div>` : ''}
        <div class="grid2 mt"><button class="btn ghost" data-close>${L('Нет', 'Yo‘q')}</button><button class="btn danger" id="cYes">${L('Отменить бронь', 'Bekor qilish')}</button></div>`, (el, close) => {
        el.querySelector('#cYes').addEventListener('click', (e) => act(e.currentTarget, async () => {
          const bk = (await store.myBookings()).find((x) => x.id === b.dataset.cancel);
          await store.cancelBooking(b.dataset.cancel);
          close();
          if (paid && bk?.court?.phone) {
            sheet(`<h2 class="h">${L('Бронь отменена', 'Bron bekor qilindi')}</h2><div>${L('Для возврата денег позвоните корту:', 'Pulni qaytarish uchun kortga qo‘ng‘iroq qiling:')}</div>
              <a class="btn ball block mt" href="tel:${esc(bk.court.phone.replace(/[^\d+]/g, ''))}">📞 ${esc(bk.court.phone)}</a><button class="btn ghost block mt" data-close>${L('Понятно', 'Tushunarli')}</button>`);
          } else toast(L('Бронь отменена', 'Bron bekor qilindi'));
          rerender();
        }));
      });
    }));
    root.querySelectorAll('[data-review]').forEach((b) => b.addEventListener('click', () => {
      let n = 5;
      sheet(`<h2 class="h">${L('Оцените корт', 'Kortni baholang')}</h2>
        <div class="starpick" id="sp">${[1, 2, 3, 4, 5].map((k) => `<button data-s="${k}" class="on" aria-label="${k}">★</button>`).join('')}</div>
        <textarea id="rvT" class="input mt" maxlength="1000" placeholder="${L('Что понравилось, что улучшить (покрытие, душ, персонал)', 'Nima yoqdi, nimani yaxshilash kerak')}"></textarea>
        <div class="grid2 mt"><button class="btn ghost" data-close>${L('Отмена', 'Bekor')}</button><button class="btn ball" id="rvGo">${L('Отправить', 'Yuborish')}</button></div>`, (el, close) => {
        el.querySelectorAll('[data-s]').forEach((s) => s.addEventListener('click', () => { n = +s.dataset.s; el.querySelectorAll('[data-s]').forEach((x) => x.classList.toggle('on', +x.dataset.s <= n)); }));
        el.querySelector('#rvGo').addEventListener('click', (e) => act(e.currentTarget, async () => { await store.reviewCourt(b.dataset.review, n, el.querySelector('#rvT').value.trim()); close(); toast(L('Спасибо!', 'Rahmat!')); rerender(); }));
      });
    }));
  },
};

// Short block on the player's home screen
export async function homeBookings(store) {
  if (!store.myBookings) return '';
  let list = [];
  try { list = await store.myBookings(); } catch { return ''; }
  const up = list.filter((b) => Date.parse(b.end) > Date.now() && isActive(b)).sort((a, b) => a.start.localeCompare(b.start)).slice(0, 2);
  if (!up.length) return '';
  return `<a class="card" href="#/bookings" style="display:block;color:inherit"><div class="row between"><h2 class="h" style="margin:0">${L('Мои брони', 'Bronlarim')}</h2><span class="muted small">${L('все', 'hammasi')} →</span></div>
    ${up.map((b) => `<div class="row between mt" style="gap:8px"><div class="grow"><div class="strong ellipsis">${esc(b.court?.name || '')}</div><div class="muted small">${slotText(b)}</div></div>${statusTag(b)}</div>`).join('')}</a>`;
}

// =====================================================================
// Court owner: schedule of the day, bookings to check, actions
// =====================================================================
const vState = { day: null };
export const venueView = {
  async render(_, store) {
    const c = await store.myCourt();
    if (!c) return `<div class="pagehead"><h1 class="title">${L('Мой корт', 'Kortim')}</h1></div><div class="wrap"><div class="card">${L('Корт ещё не привязан к аккаунту. Напишите администрации.', 'Kort hali akkauntga bog‘lanmagan. Ma’muriyatga yozing.')}<a class="btn block mt" href="#/support">${L('Написать', 'Yozish')}</a></div></div>`;
    vState.day = vState.day || tashToday();
    const [day, inbox] = await Promise.all([store.courtDay(c.id, vState.day), store.courtInbox(c.id)]);
    const check = inbox.filter((b) => b.status === 'paid');
    const fresh = inbox.filter((b) => b.status === 'cash' && Date.parse(b.createdAt) > Date.now() - 3 * 864e5).slice(0, 5);
    const setup = [!c.photos?.court?.length && L('добавьте фото корта', 'kort rasmini qo‘shing'), !c.priceRules?.length && L('укажите цены', 'narxlarni kiriting'),
      !c.cardNumber && L('карту для предоплаты (по желанию)', 'oldindan to‘lov kartasi (ixtiyoriy)'), !c.bookingOn && L('включите бронь', 'bronni yoqing')].filter(Boolean);
    const days = Array.from({ length: 21 }, (_, i) => addDays(tashToday(), i - 3));
    return `<div class="pagehead" style="justify-content:space-between"><h1 class="title" style="text-transform:none">${esc(c.name)}</h1>${c.verified ? `<span class="tag ok">✓ ${L('Проверенный', 'Tekshirilgan')}</span>` : ''}</div>
    <div class="wrap">
      ${await pushCard(L('Новые брони и чеки будут приходить на телефон сразу.', 'Yangi bronlar va cheklar telefonga darhol keladi.'))}
      ${setup.length ? `<a class="card hl" href="#/venue/edit" style="display:block;color:inherit"><div class="strong">${L('Чтобы игроки могли бронировать', 'O‘yinchilar bron qila olishi uchun')}:</div><div class="small">${setup.join(' · ')}</div><div class="strong mt">${L('Настроить корт →', 'Kortni sozlash →')}</div></a>` : ''}
      ${check.length ? `<div class="card"><h2 class="h">🧾 ${L('Проверьте оплату', 'To‘lovni tekshiring')} · ${check.length}</h2>${check.map((b) => inboxRow(b)).join('')}</div>` : ''}
      ${fresh.length ? `<div class="card"><h2 class="h">🎾 ${L('Новые брони (наличные)', 'Yangi bronlar (naqd)')}</h2>${fresh.map((b) => inboxRow(b)).join('')}</div>` : ''}
      <div class="chips scroll mt" style="gap:6px" id="vdays">${days.map((d) => { const x = dayLabel(d); return `<button class="chip ${d === vState.day ? 'on' : ''}" data-vday="${d}" style="height:auto;padding:6px 12px;line-height:1.15;text-align:center"><div class="small">${x.word}</div><b>${x.num}</b> <span class="small">${x.month}</span></button>`; }).join('')}</div>
      <div class="card" style="padding:10px">${scheduleGrid(c, day)}</div>
      <div class="muted small center">${L('Нажмите на свободное время, чтобы отметить бронь не через приложение. Нажмите на бронь — детали и действия.', 'Ilovadan tashqari bronni belgilash uchun bo‘sh vaqtni bosing. Bronni bosing — tafsilotlar.')}</div>
      <div class="chips mt" style="gap:6px;justify-content:center">${legend()}</div>
      <a class="btn ghost block mt" href="#/court/${c.id}">${L('Как видят игроки', 'O‘yinchilar qanday ko‘radi')}</a>
    </div>`;
  },
  async mount(root, _, store) {
    bindPush(root, store);
    root.querySelector('[data-vday].on')?.scrollIntoView({ inline: 'center', block: 'nearest' });
    root.querySelectorAll('[data-vday]').forEach((b) => b.addEventListener('click', () => { vState.day = b.dataset.vday; rerender(); }));
    const c = await store.myCourt();
    const day = c ? await store.courtDay(c.id, vState.day) : [];
    const inbox = c ? await store.courtInbox(c.id) : [];
    const all = [...day, ...inbox];
    root.querySelectorAll('[data-bk]').forEach((el) => el.addEventListener('click', () => { const b = all.find((x) => x.id === el.dataset.bk); if (b) ownerBookingSheet(store, c, b); }));
    root.querySelectorAll('[data-free]').forEach((el) => el.addEventListener('click', () => blockSheet(store, c, +el.dataset.unit, +el.dataset.free)));
  },
};
const COLORS = { confirmed: ['#D9F2DF', '#1E7B3A'], cash: ['#FFF3C4', '#8A6A00'], await_pay: ['#FFE3C2', '#9A4B00'], paid: ['#DDEBFF', '#1F4E9A'], blocked: ['#E4E7E5', '#4C5C54'] };
const legend = () => [['confirmed', L('оплачено', 'to‘langan')], ['cash', L('наличные', 'naqd')], ['paid', L('чек', 'chek')], ['await_pay', L('ждёт оплату', 'to‘lov kutilmoqda')], ['blocked', L('вне приложения', 'ilovadan tashqari')]]
  .map(([k, t]) => `<span class="tag" style="background:${COLORS[k][0]};color:${COLORS[k][1]}">${t}</span>`).join('');
function inboxRow(b) {
  return `<button class="row between" data-bk="${b.id}" style="all:unset;display:flex;justify-content:space-between;width:100%;gap:8px;padding:8px 0;border-top:1px solid var(--line);cursor:pointer">
    <div class="grow"><div class="strong">${esc(b.playerName || '—')} · ${L('Корт', 'Kort')} ${b.unit}</div><div class="muted small">${slotText(b)} · ${money(b.price)}</div></div>${statusTag(b)}</button>`;
}
function scheduleGrid(c, day) {
  const rows = (c.closeMin - c.openMin) / 30;
  const units = c.courts;
  const H = 30;
  const active = day.filter(isActive);
  const dayStart = Date.parse(tashIso(vState.day, 0));
  const cells = [];
  for (let u = 1; u <= units; u++) {
    const own = active.filter((b) => b.unit === u).map((b) => ({ b, s: Math.max(c.openMin, (Date.parse(b.start) - dayStart) / 60e3), e: Math.min(c.closeMin, (Date.parse(b.end) - dayStart) / 60e3) })).filter((x) => x.e > x.s);
    for (let r = 0; r < rows; r++) {
      const m = c.openMin + r * 30;
      const hit = own.find((x) => x.s <= m && x.e > m);
      if (hit && hit.s < m && m !== c.openMin) continue; // inside a block already drawn
      if (hit) {
        const span = Math.ceil((hit.e - Math.max(hit.s, m)) / 30);
        const [bg, fg] = COLORS[hit.b.status] || COLORS.blocked;
        const who = hit.b.kind === 'offline' ? (hit.b.note || L('вне приложения', 'ilovadan tashqari')) : hit.b.playerName;
        cells.push(`<button data-bk="${hit.b.id}" style="grid-column:${u + 1};grid-row:${r + 2} / span ${span};background:${bg};color:${fg};border:none;border-radius:10px;padding:4px 6px;text-align:left;font-size:12px;line-height:1.2;overflow:hidden;cursor:pointer;margin:1px">
          <b>${timeOf(hit.b.start)}–${endOf(hit.b.end)}</b><div class="ellipsis">${esc(who || '')}</div>${hit.b.noshow ? '<div>🚫</div>' : ''}</button>`);
        continue;
      }
      const past = Date.parse(tashIso(vState.day, m)) + 30 * 60e3 < Date.now();
      cells.push(`<button ${past ? 'disabled' : `data-free="${m}" data-unit="${u}"`} aria-label="${L('Свободно', 'Bo‘sh')} ${hm(m)}" style="grid-column:${u + 1};grid-row:${r + 2};border:1px dashed var(--line);background:transparent;border-radius:8px;margin:1px;cursor:${past ? 'default' : 'pointer'};opacity:${past ? '.35' : '1'}"></button>`);
    }
  }
  const times = Array.from({ length: rows }, (_, r) => `<div style="grid-column:1;grid-row:${r + 2};font-size:11px;color:var(--muted);padding-top:2px">${(c.openMin + r * 30) % 60 ? '' : hm(c.openMin + r * 30)}</div>`).join('');
  const heads = Array.from({ length: units }, (_, i) => `<div style="grid-column:${i + 2};grid-row:1;text-align:center;font-weight:800;font-size:13px">${L('Корт', 'Kort')} ${i + 1}</div>`).join('');
  return `<div style="overflow-x:auto"><div style="display:grid;grid-template-columns:44px repeat(${units},minmax(${units > 3 ? 88 : 0}px,1fr));grid-auto-rows:${H}px;min-width:${units > 3 ? 44 + units * 90 : 0}px">${heads}${times}${cells.join('')}</div></div>
    ${active.length ? '' : `<div class="muted small center mt">${L('На этот день броней нет', 'Bu kunga bron yo‘q')}</div>`}`;
}
async function ownerBookingSheet(store, c, b) {
  const receipt = b.receipt ? await store.receiptUrl(b.receipt).catch(() => '') : '';
  const started = Date.parse(b.start) <= Date.now();
  const app = b.kind === 'app';
  const phone = b.playerPhone ? '+' + String(b.playerPhone).replace(/\D/g, '') : '';
  sheet(`<h2 class="h">${app ? esc(b.playerName || L('Игрок', 'O‘yinchi')) : L('Бронь вне приложения', 'Ilovadan tashqari bron')}</h2>
    <div class="row between">${statusTag(b)}<b>${money(b.price)}</b></div>
    <div class="mt">${slotText(b)} · ${L('Корт', 'Kort')} ${b.unit}</div>
    ${app ? `<div class="muted small">${b.pay === 'card' ? L('Предоплата картой', 'Karta orqali oldindan') : L('Наличными на месте', 'Joyida naqd')}${b.playerNoshows ? ` · <b style="color:var(--bad)">${L('неявок', 'kelmagan')}: ${b.playerNoshows}</b>` : ''}</div>` : ''}
    ${b.note ? `<div class="mt">💬 ${esc(b.note)}</div>` : ''}
    ${b.cancelReason ? `<div class="muted small mt">💬 ${esc(b.cancelReason)}</div>` : ''}
    ${phone ? `<div class="grid2 mt"><a class="btn ghost" href="tel:${phone}">📞 ${phone}</a><a class="btn ghost" href="https://t.me/${phone}" target="_blank" rel="noopener">Telegram</a></div>` : ''}
    ${b.status === 'await_pay' ? `<div class="muted small mt">${L('Игрок ещё не прислал чек. Если не оплатит за 30 минут — бронь снимется сама.', 'O‘yinchi hali chek yubormadi. 30 daqiqada to‘lamasa — bron o‘zi bekor bo‘ladi.')}</div>` : ''}
    ${receipt ? `<div class="mt"><div class="muted small">${L('Чек', 'Chek')}</div>${/\.pdf($|\?)/.test(b.receipt) ? `<a class="btn ghost block" href="${esc(receipt)}" target="_blank" rel="noopener">${L('Открыть чек (PDF)', 'Chekni ochish (PDF)')}</a>` : `<a href="${esc(receipt)}" target="_blank" rel="noopener"><img src="${esc(receipt)}" alt="" style="width:100%;max-height:360px;object-fit:contain;border-radius:12px;border:1px solid var(--line)"></a>`}</div>` : ''}
    <div class="list mt">
      ${['paid', 'await_pay'].includes(b.status) ? `<button class="btn ball block" data-act="paid">✓ ${L('Оплата получена', 'To‘lov olindi')}</button>` : ''}
      ${b.status === 'cash' && started ? `<button class="btn ball block" data-act="paid">✓ ${L('Оплачено на месте', 'Joyida to‘landi')}</button>` : ''}
      ${app && ['cash', 'await_pay', 'paid', 'confirmed'].includes(b.status) && !started ? `<button class="btn ghost block mt" data-act="decline">${L('Отклонить бронь', 'Bronni rad etish')}</button>` : ''}
      ${app && started && ['cash', 'confirmed'].includes(b.status) ? `<button class="btn ghost block mt" data-act="noshow">${b.noshow ? L('Снять отметку «не пришёл»', '«Kelmadi» belgisini olib tashlash') : '🚫 ' + L('Не пришёл', 'Kelmadi')}</button>` : ''}
      ${b.status === 'blocked' ? `<button class="btn ghost block mt" data-act="unblock">${L('Освободить время', 'Vaqtni bo‘shatish')}</button>` : ''}
    </div>
    <button class="btn ghost block mt" data-close>${L('Закрыть', 'Yopish')}</button>`, (el, close) => {
    el.querySelectorAll('[data-act]').forEach((x) => x.addEventListener('click', (e) => act(e.currentTarget, async () => {
      const a = x.dataset.act;
      if (a === 'decline') {
        const reason = prompt(L('Причина (игрок увидит её)', 'Sabab (o‘yinchi ko‘radi)'), L('Корт занят', 'Kort band')) ?? null;
        if (reason === null) return;
        await store.courtAction(b.id, 'decline', reason);
      } else if (a === 'unblock') await store.cancelBooking(b.id, '');
      else await store.courtAction(b.id, a);
      close(); toast(L('Готово', 'Tayyor')); rerender();
    })));
  });
}
function blockSheet(store, c, unit, min) {
  const opts = []; for (let m = 30; min + m <= c.closeMin && m <= 360; m += 30) opts.push(m);
  sheet(`<h2 class="h">${L('Занять время', 'Vaqtni band qilish')}</h2>
    <div class="muted">${L('Для броней по телефону или «вживую» — чтобы игроки в приложении видели, что время занято.', 'Telefon yoki jonli bronlar uchun — o‘yinchilar vaqt band ekanini ko‘rishi uchun.')}</div>
    <div class="mt"><b>${dayText(vState.day)} · ${hm(min)}</b> · ${L('Корт', 'Kort')} ${unit}</div>
    <label class="f" for="blkM">${L('Длительность', 'Davomiyligi')}</label>
    <select id="blkM" class="input">${opts.map((m) => `<option value="${m}" ${m === 60 ? 'selected' : ''}>${durText(m)} (${hm(min)}–${hm(min + m)})</option>`).join('')}</select>
    <label class="f" for="blkN">${L('Кто играет (видите только вы)', 'Kim o‘ynaydi (faqat siz ko‘rasiz)')}</label>
    <input id="blkN" class="input" maxlength="200" placeholder="${L('Имя, телефон', 'Ism, telefon')}">
    <div class="grid2 mt"><button class="btn ghost" data-close>${L('Отмена', 'Bekor')}</button><button class="btn ball" id="blkGo">${L('Занять', 'Band qilish')}</button></div>`, (el, close) => {
    el.querySelector('#blkGo').addEventListener('click', (e) => act(e.currentTarget, async () => {
      await store.courtBlock({ courtId: c.id, unit, start: tashIso(vState.day, min), minutes: +el.querySelector('#blkM').value, note: el.querySelector('#blkN').value.trim() });
      close(); toast(L('Время отмечено как занятое', 'Vaqt band deb belgilandi')); rerender();
    }));
  });
}

// =====================================================================
// Court owner: settings of the court
// =====================================================================
export const venueEdit = {
  async render(_, store) {
    const c = await store.myCourt();
    if (!c) return `<div class="pagehead"><h1 class="title">${L('Мой корт', 'Kortim')}</h1></div><div class="wrap"><div class="card">${L('Корт не найден', 'Kort topilmadi')}</div></div>`;
    const times = []; for (let m = 0; m <= 1440; m += 30) times.push(m);
    const tsel = (id, v, from = 0, to = 1440) => `<select id="${id}" class="input">${times.filter((m) => m >= from && m <= to).map((m) => `<option value="${m}" ${m === v ? 'selected' : ''}>${hm(m === 1440 ? 1440 : m).replace('24:00', '24:00')}</option>`).join('')}</select>`;
    const chk = (id, on, label) => `<label class="row small strong" style="gap:8px;cursor:pointer;margin-top:10px"><input type="checkbox" id="${id}" ${on ? 'checked' : ''} style="width:20px;height:20px;accent-color:var(--court)">${label}</label>`;
    return `<div class="pagehead">${back('#/venue')}<h1 class="title">${L('Мой корт', 'Kortim')}</h1></div>
    <div class="wrap"><form id="vf">
      <div class="card"><h2 class="h">${L('Основное', 'Asosiy')}</h2>
        <label class="f" for="vn">${L('Название', 'Nomi')}*</label><input id="vn" class="input" required maxlength="120" value="${esc(c.name)}">
        <div class="grid2"><div><label class="f" for="vc">${L('Город / район', 'Shahar / tuman')}</label><input id="vc" class="input" maxlength="80" value="${esc(c.city)}"></div>
          <div><label class="f" for="vph">${L('Телефон корта', 'Kort telefoni')}*</label><input id="vph" class="input" type="tel" value="${esc(c.phone)}"></div></div>
        <label class="f" for="va">${L('Адрес, ориентир', 'Manzil, mo‘ljal')}</label><input id="va" class="input" maxlength="200" value="${esc(c.address)}">
        <label class="f" for="vd">${L('Описание', 'Tavsif')}</label><textarea id="vd" class="input" maxlength="1000" placeholder="${L('Покрытие, правила, как найти вход', 'Qoplama, qoidalar, kirish joyi')}">${esc(c.description)}</textarea>
        <div class="grid2"><div><label class="f" for="vk">${L('Сколько кортов', 'Nechta kort')}</label><input id="vk" class="input" type="number" min="1" max="60" value="${c.courts}"></div>
          <div><label class="f" for="vs">${L('Покрытие', 'Qoplama')}</label><select id="vs" class="input"><option value="">—</option>${SURFACES.map(([k, ru, uz]) => `<option value="${k}" ${k === c.surface ? 'selected' : ''}>${L(ru, uz)}</option>`).join('')}</select></div></div>
        ${chk('vin', c.indoor, L('Крытый корт', 'Yopiq kort'))}${chk('vli', c.lights, L('Есть освещение (вечером)', 'Yoritish bor (kechqurun)'))}
      </div>
      <div class="card"><h2 class="h">${L('Место на карте', 'Xaritadagi joy')}</h2>
        <div class="muted small">${L('Нажмите на карту или передвиньте метку. Можно вставить ссылку из Яндекс или Google Карт.', 'Xaritani bosing yoki belgini suring. Yandex yoki Google havolasini qo‘yish mumkin.')}</div>
        <div id="vmap" style="height:240px;border-radius:14px;overflow:hidden;border:1px solid var(--line);z-index:0;margin-top:8px"></div>
        <input id="vxy" class="input mt" placeholder="${L('координаты или ссылка на карту', 'koordinata yoki xarita havolasi')}" value="${hasPoint(c) ? `${c.lat}, ${c.lng}` : ''}">
        <button type="button" class="btn ghost block mt" data-gps>📍 ${L('Я сейчас на корте — поставить точку здесь', 'Hozir kortdaman — nuqtani shu yerga qo‘yish')}</button>
      </div>
      <div class="card"><h2 class="h">${L('Удобства', 'Qulayliklar')}</h2>
        <div class="chips">${AMENITIES.map(([k, ru, uz]) => `<button type="button" class="chip ${c.amenities.includes(k) ? 'on' : ''}" data-am="${k}">${L(ru, uz)}</button>`).join('')}</div></div>
      <div class="card"><h2 class="h">${L('Фото', 'Rasmlar')}</h2>
        ${[['court', L('Корт', 'Kort') + '*', 8], ['shower', L('Душ', 'Dush'), 4], ['locker', L('Раздевалка', 'Kiyinish xonasi'), 4]].map(([k, t, max]) => `
          <div class="muted small mt">${t} · ${L('до', 'gacha')} ${max}</div>
          <div class="row" style="gap:8px;flex-wrap:wrap;margin-top:6px" data-ph="${k}" data-max="${max}"></div>`).join('')}
      </div>
      <div class="card"><h2 class="h">${L('Часы работы', 'Ish vaqti')}</h2>
        <div class="grid2"><div><label class="f" for="vo">${L('Открытие', 'Ochilish')}</label>${tsel('vo', c.openMin, 0, 1410)}</div><div><label class="f" for="vz">${L('Закрытие', 'Yopilish')}</label>${tsel('vz', c.closeMin, 30, 1440)}</div></div></div>
      <div class="card"><h2 class="h">${L('Цены за час', 'Soatlik narxlar')}</h2>
        <div class="muted small">${L('Например: будни 07:00–17:00 — 80 000, будни 17:00–23:00 — 120 000, выходные — 150 000. Правило «будни»/«выходные» важнее, чем «все дни».', 'Masalan: ish kunlari 07:00–17:00 — 80 000, 17:00–23:00 — 120 000, dam olish — 150 000.')}</div>
        <div id="rules"></div>
        <div class="grid2 mt"><button type="button" class="btn ghost" data-addrule>${L('+ Добавить цену', '+ Narx qo‘shish')}</button><button type="button" class="btn ghost" data-tplrule>${L('Шаблон', 'Andoza')}</button></div>
      </div>
      <div class="card"><h2 class="h">${L('Предоплата на карту', 'Kartaga oldindan to‘lov')}</h2>
        <div class="muted small">${L('Игрок переводит полную сумму и прикрепляет чек. Номер карты видит только игрок, который бронирует. Оставьте пустым — тогда только наличные.', 'O‘yinchi to‘liq summani o‘tkazadi va chekni biriktiradi. Bo‘sh qoldiring — faqat naqd.')}</div>
        <label class="f" for="vcn">${L('Номер карты (Uzcard / Humo)', 'Karta raqami (Uzcard / Humo)')}</label><input id="vcn" class="input" inputmode="numeric" maxlength="23" placeholder="8600 0000 0000 0000" value="${esc(c.cardNumber || '')}">
        <label class="f" for="vch">${L('Имя владельца карты', 'Karta egasining ismi')}</label><input id="vch" class="input" maxlength="80" value="${esc(c.cardHolder || '')}">
      </div>
      <div class="card"><h2 class="h">${L('Бронь через приложение', 'Ilova orqali bron')}</h2>
        ${chk('von', c.bookingOn, L('Принимать брони от игроков', 'O‘yinchilardan bron qabul qilish'))}
        <div class="muted small mt">${L('Для включения нужны: телефон, хотя бы одно фото корта и цены.', 'Yoqish uchun: telefon, kamida bitta kort rasmi va narxlar kerak.')}</div></div>
      <button class="btn ball block" id="vSave">${L('Сохранить', 'Saqlash')}</button>
      <div style="height:16px"></div>
    </form></div>`;
  },
  async mount(root, _, store) {
    const c = await store.myCourt(); if (!c) return;
    const st = { photos: { court: [...(c.photos.court || [])], shower: [...(c.photos.shower || [])], locker: [...(c.photos.locker || [])] }, amenities: new Set(c.amenities), rules: (c.priceRules || []).map((r) => ({ ...r })), point: hasPoint(c) ? { lat: +c.lat, lng: +c.lng } : null };
    const $ = (s) => root.querySelector(s);
    // amenities
    root.querySelectorAll('[data-am]').forEach((b) => b.addEventListener('click', () => { const k = b.dataset.am; st.amenities.has(k) ? st.amenities.delete(k) : st.amenities.add(k); b.classList.toggle('on'); }));
    // photos
    const drawPhotos = () => root.querySelectorAll('[data-ph]').forEach((box) => {
      const k = box.dataset.ph; const max = +box.dataset.max;
      box.innerHTML = st.photos[k].map((u, i) => `<div style="position:relative"><img src="${esc(u)}" alt="" style="width:84px;height:84px;object-fit:cover;border-radius:12px"><button type="button" data-rm="${k}:${i}" aria-label="${L('Удалить', 'O‘chirish')}" style="position:absolute;top:-6px;right:-6px;width:26px;height:26px;border-radius:13px;border:none;background:var(--bad);color:#fff;font-weight:900;cursor:pointer">×</button></div>`).join('')
        + (st.photos[k].length < max ? `<label style="width:84px;height:84px;border-radius:12px;border:1.5px dashed var(--line);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:28px;color:var(--muted)">+<input type="file" accept="image/*" multiple hidden data-up="${k}"></label>` : '');
      box.querySelectorAll('[data-rm]').forEach((x) => x.addEventListener('click', () => { const [kk, i] = x.dataset.rm.split(':'); st.photos[kk].splice(+i, 1); drawPhotos(); }));
      box.querySelector('[data-up]')?.addEventListener('change', async (e) => {
        const files = [...e.target.files].slice(0, max - st.photos[k].length);
        toast(L('Загружаем фото…', 'Rasm yuklanmoqda…'));
        for (const f of files) {
          try { const data = await resizeImage(f, 1600); const file = new File([await (await fetch(data)).blob()], 'p.jpg', { type: 'image/jpeg' }); st.photos[k].push(await store.uploadCourtPhoto(c.id, file)); }
          catch (err) { toast(err.message); }
        }
        drawPhotos();
      });
    });
    drawPhotos();
    // price rules
    const times = []; for (let m = 0; m <= 1440; m += 30) times.push(m);
    const drawRules = () => {
      $('#rules').innerHTML = st.rules.map((r, i) => `<div class="card" style="margin:8px 0 0;padding:10px;background:var(--soft)">
        <div class="grid2"><select class="input" data-r="${i}" data-f="d">${[['wd', L('Будни (пн–пт)', 'Ish kunlari')], ['we', L('Выходные (сб–вс)', 'Dam olish')], ['all', L('Все дни', 'Har kuni')]].map(([v, t]) => `<option value="${v}" ${r.d === v ? 'selected' : ''}>${t}</option>`).join('')}</select>
          <input class="input" data-r="${i}" data-f="p" type="number" inputmode="numeric" min="0" step="1000" value="${r.p}" placeholder="${L('цена за час', 'soatlik narx')}"></div>
        <div class="grid2 mt" style="align-items:center"><select class="input" data-r="${i}" data-f="f">${times.slice(0, -1).map((m) => `<option value="${m}" ${m === r.f ? 'selected' : ''}>${L('с', 'dan')} ${hm(m)}</option>`).join('')}</select>
          <select class="input" data-r="${i}" data-f="t">${times.slice(1).map((m) => `<option value="${m}" ${m === r.t ? 'selected' : ''}>${L('до', 'gacha')} ${hm(m)}</option>`).join('')}</select></div>
        <button type="button" class="btn ghost sm mt" data-delrule="${i}">${L('Удалить', 'O‘chirish')}</button></div>`).join('') || `<div class="empty">${L('Цены не указаны', 'Narx kiritilmagan')}</div>`;
      root.querySelectorAll('[data-r]').forEach((el) => el.addEventListener('change', () => { const r = st.rules[+el.dataset.r]; r[el.dataset.f] = el.dataset.f === 'd' ? el.value : +el.value; }));
      root.querySelectorAll('[data-delrule]').forEach((b) => b.addEventListener('click', () => { st.rules.splice(+b.dataset.delrule, 1); drawRules(); }));
    };
    drawRules();
    $('[data-addrule]').addEventListener('click', () => { st.rules.push({ d: 'all', f: +$('#vo').value, t: +$('#vz').value, p: 100000 }); drawRules(); });
    $('[data-tplrule]').addEventListener('click', () => { const o = +$('#vo').value, z = +$('#vz').value; const mid = Math.min(Math.max(o + 30, 1020), z - 30);
      st.rules = [{ d: 'wd', f: o, t: mid, p: 80000 }, { d: 'wd', f: mid, t: z, p: 120000 }, { d: 'we', f: o, t: z, p: 150000 }]; drawRules(); toast(L('Поставьте свои цены', 'O‘z narxlaringizni kiriting')); });
    // map
    const xy = $('#vxy'); let marker = null; let mm = null;
    const place = (p, move = false) => {
      st.point = p; xy.value = `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`;
      if (!mm) return;
      if (marker) marker.setLatLng([p.lat, p.lng]); else marker = mm.Lf.marker([p.lat, p.lng], { icon: pin(mm.Lf, true), draggable: true }).addTo(mm.map).on('dragend', () => { const ll = marker.getLatLng(); place({ lat: ll.lat, lng: ll.lng }); });
      if (move) mm.map.setView([p.lat, p.lng], 16);
    };
    makeMap($('#vmap'), st.point ? [st.point.lat, st.point.lng] : (CENTER[c.region] || [41.3, 69.3]), st.point ? 16 : 12).then((m) => {
      mm = m; setTimeout(() => m.map.invalidateSize(), 250);
      if (st.point) place(st.point);
      m.map.on('click', (e) => place({ lat: e.latlng.lat, lng: e.latlng.lng }));
    }).catch(() => { $('#vmap').innerHTML = `<div class="muted center" style="padding:30px">${L('Карта не загрузилась — вставьте координаты ниже', 'Xarita yuklanmadi — pastga koordinata qo‘ying')}</div>`; });
    xy.addEventListener('change', () => { const p = parseCoords(xy.value); if (p) place(p, true); else if (xy.value.trim()) toast(L('Не понял координаты', 'Koordinata tushunarsiz')); });
    $('[data-gps]').addEventListener('click', (e) => {
      if (!navigator.geolocation) { toast(L('Телефон не даёт определить место', 'Telefon joylashuvni aniqlay olmaydi')); return; }
      const btn = e.currentTarget; btn.disabled = true;
      navigator.geolocation.getCurrentPosition((p) => { btn.disabled = false; place({ lat: p.coords.latitude, lng: p.coords.longitude }, true); toast(L('Точка поставлена', 'Nuqta qo‘yildi')); },
        () => { btn.disabled = false; toast(L('Разрешите доступ к геолокации', 'Joylashuvga ruxsat bering')); }, { enableHighAccuracy: true, timeout: 15000 });
    });
    // save
    $('#vf').addEventListener('submit', (e) => {
      e.preventDefault();
      const v = (id) => $('#' + id).value.trim();
      const card = v('vcn').replace(/\D/g, '');
      if (card && card.length !== 16) { toast(L('Номер карты — 16 цифр', 'Karta raqami — 16 raqam')); return; }
      act($('#vSave'), async () => {
        await store.saveMyCourt({ ...c, name: v('vn'), city: v('vc'), phone: v('vph'), address: v('va'), description: v('vd'), courts: +v('vk') || 1, surface: v('vs'),
          indoor: $('#vin').checked, lights: $('#vli').checked, lat: st.point?.lat ?? null, lng: st.point?.lng ?? null, amenities: [...st.amenities], photos: st.photos,
          openMin: +v('vo'), closeMin: +v('vz'), priceRules: st.rules.map((r) => ({ d: r.d, f: +r.f, t: +r.t, p: Math.round(+r.p || 0) })),
          cardNumber: card.replace(/(\d{4})(?=\d)/g, '$1 '), cardHolder: v('vch'), bookingOn: $('#von').checked });
        toast(L('Сохранено', 'Saqlandi')); go('#/venue');
      });
    });
  },
};

// Court owner's own page: language, notifications, support, logout
export const venueMe = {
  async render(_, store) {
    const me = store.me(); const st = await pushState();
    return `<div class="pagehead"><h1 class="title">${L('Профиль', 'Profil')}</h1></div>
    <div class="wrap"><div class="card"><div class="row" style="gap:12px">${avatar(me, 'lg')}<div><div class="strong">${esc(fullName(me))}</div><div class="muted small">${L('Владелец корта', 'Kort egasi')}${me.phone ? ' · +' + String(me.phone).replace(/\D/g, '') : ''}</div></div></div></div>
      <div class="card"><h2 class="h">${L('Настройки', 'Sozlamalar')}</h2>
        <div class="kv"><span>${L('Уведомления', 'Bildirishnomalar')}</span>${st === 'on' ? `<button class="btn ghost sm" data-pushoff>${L('Выключить', 'O‘chirish')}</button>` : `<button class="btn ball sm" data-push>${L('Включить', 'Yoqish')}</button>`}</div>
        <a class="btn ghost block mt" href="#/edit">${L('Мои данные', 'Ma’lumotlarim')}</a>
        <a class="btn ghost block mt" href="#/support">${L('Написать администрации', 'Ma’muriyatga yozish')}</a>
        <button class="btn ghost block mt" data-logout>${L('Выйти', 'Chiqish')}</button></div></div>`;
  },
  mount(root, _, store) {
    bindPush(root, store);
    root.querySelector('[data-pushoff]')?.addEventListener('click', (e) => act(e.currentTarget, async () => { await disablePush(store); rerender(); }));
    root.querySelector('[data-logout]')?.addEventListener('click', async () => { await store.signOut(); go('#/login'); });
  },
};

// =====================================================================
// Court request (login screen, no account needed) and the admin's list
// =====================================================================
export function courtRequestSheet(store) {
  sheet(`<h2 class="h">${L('Регистрация корта', 'Kortni ro‘yxatdan o‘tkazish')}</h2>
    <div class="muted">${L('Корт получит отметку «Проверенный», расписание и брони от игроков. Администратор позвонит вам.', 'Kort «Tekshirilgan» belgisi, jadval va o‘yinchilardan bronlarni oladi. Administrator qo‘ng‘iroq qiladi.')}</div>
    <form id="qrf">
      <label class="f" for="qv">${L('Название корта / клуба', 'Kort / klub nomi')}*</label><input id="qv" class="input" required maxlength="120">
      <div class="grid2"><div><label class="f" for="qrg">${L('Область', 'Viloyat')}*</label><select id="qrg" class="input" required><option value="">—</option>${REGIONS.map((r) => `<option value="${r.code}">${esc(L(r.ru, r.uz))}</option>`).join('')}</select></div>
        <div><label class="f" for="qc">${L('Город / район', 'Shahar / tuman')}</label><input id="qc" class="input" maxlength="80"></div></div>
      <label class="f" for="qa">${L('Адрес, ориентир', 'Manzil, mo‘ljal')}</label><input id="qa" class="input" maxlength="200">
      <label class="f">${L('Ваш корт на карте', 'Kortingiz xaritada')}*</label>
      <div class="muted small">${L('Если ваш корт уже есть на карте — нажмите на его метку. Если нет — нажмите на место корта, и мы поставим новую метку.', 'Kortingiz xaritada bo‘lsa — belgisini bosing. Bo‘lmasa — kort joyini bosing, yangi belgi qo‘yamiz.')}</div>
      <div id="qmap" style="height:260px;border-radius:14px;overflow:hidden;border:1px solid var(--line);margin-top:8px;background:#e8ece4"><div class="muted center" style="padding:40px 16px">${L('Сначала выберите область', 'Avval viloyatni tanlang')}</div></div>
      <select id="qpick" class="input mt" disabled><option value="">${L('…или выберите корт из списка', '…yoki ro‘yxatdan tanlang')}</option></select>
      <button type="button" class="btn ghost sm block mt" id="qgps">${L('Я сейчас на корте — поставить точку здесь', 'Hozir kortdaman — nuqtani shu yerga qo‘yish')}</button>
      <div id="qsel" class="small strong mt" style="min-height:20px"></div>
      <label class="f" for="qk">${L('Сколько кортов', 'Nechta kort')}</label><input id="qk" class="input" type="number" min="1" max="60" value="1">
      <label class="f" for="qn">${L('Ваше имя (владелец или управляющий)', 'Ismingiz (egasi yoki boshqaruvchi)')}*</label><input id="qn" class="input" required maxlength="80">
      <label class="f" for="qph">${L('Номер телефона', 'Telefon raqami')}*</label><input id="qph" class="input" type="tel" inputmode="tel" value="+998 " required>
      <label class="f" for="qab">${L('Комментарий', 'Izoh')}</label><textarea id="qab" class="input" maxlength="1000"></textarea>
      <label class="f">${L('Документ', 'Hujjat')}*</label>
      <div class="muted small">${L('Договор аренды, свидетельство или фото корта с вывеской — 1–3 фото. Видит только администратор.', 'Ijara shartnomasi, guvohnoma yoki vivyeskali kort rasmi — 1–3 ta. Faqat administrator ko‘radi.')}</div>
      <label class="btn ghost block" style="cursor:pointer;margin-top:8px">${icon.plus} <span id="qdL">${L('Добавить фото', 'Rasm qo‘shish')}</span><input type="file" id="qdoc" accept="image/*" multiple hidden></label>
      <div id="qdP" class="row" style="gap:8px;flex-wrap:wrap;margin-top:8px"></div>
      ${termsCheck('qterms')}
      <div class="grid2 mt"><button type="button" class="btn ghost" data-close>${L('Отмена', 'Bekor')}</button><button class="btn ball" id="qSend">${L('Отправить', 'Yuborish')}</button></div>
    </form>`, (el, close) => {
    bindTerms(el);
    const docs = [];
    // map: pick an existing court of the region or put a new point
    const loc = { courtId: '', point: null }; let mm = null, newMarker = null, list = [], markers = [];
    const qsel = el.querySelector('#qsel'), qpick = el.querySelector('#qpick');
    const showSel = () => {
      const c = list.find((x) => x.id === loc.courtId);
      qsel.innerHTML = c ? `✓ ${L('Выбран корт', 'Tanlangan kort')}: ${esc(c.name)}${c.city ? ' — ' + esc(c.city) : ''}`
        : loc.point ? `✓ ${L('Новая метка', 'Yangi belgi')}: ${loc.point.lat.toFixed(5)}, ${loc.point.lng.toFixed(5)}` : '';
      qpick.value = loc.courtId;
      markers.forEach(([id, m]) => m.setIcon(pin(mm.Lf, id === loc.courtId)));
    };
    const pickCourt = (id) => {
      loc.courtId = id; loc.point = null;
      if (newMarker) { newMarker.remove(); newMarker = null; }
      const c = list.find((x) => x.id === id);
      if (c && mm && hasPoint(c)) mm.map.setView([c.lat, c.lng], 16);
      if (c && !el.querySelector('#qv').value.trim()) el.querySelector('#qv').value = c.name;
      showSel();
    };
    const putPoint = (p, move = false) => {
      loc.point = p; loc.courtId = '';
      if (mm) {
        if (newMarker) newMarker.setLatLng([p.lat, p.lng]);
        else newMarker = mm.Lf.marker([p.lat, p.lng], { icon: pin(mm.Lf, true), draggable: true }).addTo(mm.map).on('dragend', () => { const ll = newMarker.getLatLng(); loc.point = { lat: ll.lat, lng: ll.lng }; showSel(); });
        if (move) mm.map.setView([p.lat, p.lng], 16);
      }
      showSel();
    };
    el.querySelector('#qrg').addEventListener('change', async (e) => {
      const rg = e.target.value; loc.courtId = ''; loc.point = null; newMarker = null; markers = []; showSel();
      list = rg ? await store.courts(rg).catch(() => []) : [];
      qpick.disabled = !list.length;
      qpick.innerHTML = `<option value="">${list.length ? L('…или выберите корт из списка', '…yoki ro‘yxatdan tanlang') : L('В этой области кортов пока нет — поставьте метку', 'Bu viloyatda hali kort yo‘q — belgi qo‘ying')}</option>`
        + list.map((c) => `<option value="${c.id}">${esc(c.name)}${c.city ? ' — ' + esc(c.city) : ''}${c.ownerId ? ' · ' + L('уже есть владелец', 'egasi bor') : ''}</option>`).join('');
      const box = el.querySelector('#qmap');
      if (mm) { mm.map.remove(); mm = null; }
      box.innerHTML = '';
      if (!rg) { box.innerHTML = `<div class="muted center" style="padding:40px 16px">${L('Сначала выберите область', 'Avval viloyatni tanlang')}</div>`; return; }
      try {
        mm = await makeMap(box, CENTER[rg] || [41.3, 69.3], 12);
        setTimeout(() => mm.map.invalidateSize(), 250);
        list.filter(hasPoint).forEach((c) => {
          const m = mm.Lf.marker([c.lat, c.lng], { icon: pin(mm.Lf, false) }).addTo(mm.map).bindTooltip(esc(c.name)).on('click', () => pickCourt(c.id));
          markers.push([c.id, m]);
        });
        mm.map.on('click', (ev) => putPoint({ lat: ev.latlng.lat, lng: ev.latlng.lng }));
      } catch { box.innerHTML = `<div class="muted center" style="padding:40px 16px">${L('Карта не загрузилась — выберите корт из списка или нажмите «Я сейчас на корте»', 'Xarita yuklanmadi — ro‘yxatdan tanlang yoki «Hozir kortdaman»ni bosing')}</div>`; }
    });
    qpick.addEventListener('change', () => { if (qpick.value) pickCourt(qpick.value); else { loc.courtId = ''; showSel(); } });
    el.querySelector('#qgps').addEventListener('click', (e) => {
      if (!navigator.geolocation) { toast(L('Телефон не даёт определить место', 'Telefon joylashuvni aniqlay olmaydi')); return; }
      const btn = e.currentTarget; btn.disabled = true;
      navigator.geolocation.getCurrentPosition((p) => { btn.disabled = false; putPoint({ lat: p.coords.latitude, lng: p.coords.longitude }, true); toast(L('Точка поставлена', 'Nuqta qo‘yildi')); },
        () => { btn.disabled = false; toast(L('Разрешите доступ к геолокации', 'Joylashuvga ruxsat bering')); }, { enableHighAccuracy: true, timeout: 15000 });
    });
    el.querySelector('#qdoc').addEventListener('change', async (e) => {
      for (const f of [...e.target.files].slice(0, 3 - docs.length)) {
        const url = await resizeImage(f, 1600);
        docs.push(new File([await (await fetch(url)).blob()], 'doc.jpg', { type: 'image/jpeg' }));
        el.querySelector('#qdP').insertAdjacentHTML('beforeend', `<img src="${url}" alt="" style="width:72px;height:72px;object-fit:cover;border-radius:10px;border:1px solid var(--line)">`);
      }
      e.target.value = '';
      el.querySelector('#qdL').textContent = L(`Добавлено: ${docs.length}`, `Qo‘shildi: ${docs.length}`);
    });
    el.querySelector('#qrf').addEventListener('submit', (e) => {
      e.preventDefault();
      const v = (id) => el.querySelector('#' + id).value.trim();
      if (!el.querySelector('#qterms').checked) { toast(L('Примите пользовательское соглашение', 'Foydalanuvchi kelishuvini qabul qiling')); return; }
      if (!v('qrg')) { toast(L('Выберите область', 'Viloyatni tanlang')); return; }
      const phone = normPhone(v('qph'));
      if (!phone) { toast(L('Введите номер в формате +998 90 123 45 67', 'Raqamni +998 90 123 45 67 shaklida kiriting')); return; }
      if (!loc.courtId && !loc.point) { toast(L('Отметьте корт на карте: нажмите на его метку или на место корта', 'Kortni xaritada belgilang')); el.querySelector('#qmap').scrollIntoView({ block: 'center' }); return; }
      if (!docs.length) { toast(L('Добавьте фото документа', 'Hujjat rasmini qo‘shing')); return; }
      act(el.querySelector('#qSend'), async () => {
        await store.courtRequest({ ownerName: v('qn'), phone, venueName: v('qv'), region: v('qrg'), city: v('qc'), address: v('qa'), courtsCount: +v('qk') || 1, about: v('qab'), termsVer: TERMS_VERSION, docs,
          claimCourt: loc.courtId || null, lat: loc.point?.lat ?? null, lng: loc.point?.lng ?? null });
        close();
        sheet(`<h2 class="h">${L('Заявка отправлена', 'Ariza yuborildi')}</h2>
          <div>${L('Администратор проверит документ и позвонит вам. После одобрения нажмите «Регистрация» и в анкете укажите этот же номер телефона — кабинет корта включится автоматически.', 'Administrator qo‘ng‘iroq qiladi. Tasdiqlangach «Ro‘yxatdan o‘tish»ni bosing va anketada shu raqamni kiriting — kort kabineti avtomatik yoqiladi.')}</div>
          <button class="btn ball block mt" data-close>${L('Понятно', 'Tushunarli')}</button>`);
      });
    });
  });
}

// Admin: requests of courts (inside the "Courts" tab)
export async function adminCourtRequests(store, region = '') {
  const rs = (await store.courtRequests()).filter((r) => r.status === 'new' && (!region || r.region === region));
  if (!rs.length) return '';
  const courts = await store.courts('');
  return `<div class="card hl"><h2 class="h">${L('Заявки кортов', 'Kort arizalari')} · ${rs.length}</h2>
    ${rs.map((r) => `<div style="border-top:1px solid var(--line);padding-top:10px;margin-top:10px">
      <div class="strong">${esc(r.venueName)}</div><div class="muted small">${esc(regionShort(r.region))}${r.city ? ' · ' + esc(r.city) : ''}${r.address ? ' · ' + esc(r.address) : ''} · ${r.courtsCount} ${L('корт.', 'kort')}</div>
      <div class="small">${esc(r.ownerName)} · <a href="tel:+${esc(r.phone)}">+${esc(r.phone)}</a></div>${r.about ? `<div class="small muted">${esc(r.about)}</div>` : ''}
      ${r.docs?.length ? `<button class="btn ghost sm mt" data-qdocs="${r.id}">${L('Документы', 'Hujjatlar')} (${r.docs.length})</button>` : ''}
      <label class="f">${L('Это корт из списка?', 'Ro‘yxatdagi kortmi?')}</label>
      ${r.lat != null ? `<div class="small mt">📍 ${L('Новая метка', 'Yangi belgi')}: <a href="${esc(yandexLink({ lat: r.lat, lng: r.lng }))}" target="_blank" rel="noopener">${r.lat.toFixed(5)}, ${r.lng.toFixed(5)}</a></div>` : ''}
      ${r.claimCourt ? `<div class="small mt strong">📍 ${L('Владелец выбрал корт на карте', 'Egasi xaritadan kort tanladi')}</div>` : ''}
      <select class="input" data-qcourt="${r.id}"><option value="">${L('Новый корт (создать)', 'Yangi kort (yaratish)')}</option>${courts.filter((c) => c.region === r.region).map((c) => `<option value="${c.id}" ${c.id === r.claimCourt ? 'selected' : ''}>${esc(c.name)}${c.city ? ' — ' + esc(c.city) : ''}${c.ownerId ? ' (' + L('есть владелец', 'egasi bor') + ')' : ''}</option>`).join('')}</select>
      <div class="grid2 mt"><button class="btn ghost sm" data-qno="${r.id}">${L('Отклонить', 'Rad etish')}</button><button class="btn ball sm" data-qyes="${r.id}">${L('Одобрить', 'Tasdiqlash')}</button></div></div>`).join('')}</div>`;
}
export function bindAdminCourtRequests(root, store, done) {
  root.querySelectorAll('[data-qdocs]').forEach((b) => b.addEventListener('click', async () => {
    const r = (await store.courtRequests()).find((x) => x.id === b.dataset.qdocs);
    const urls = await store.coachDocUrls(r?.docs || []);
    sheet(`<h2 class="h">${L('Документы', 'Hujjatlar')}</h2>${urls.map((u) => `<img src="${esc(u)}" alt="" style="width:100%;border-radius:12px;margin-top:8px">`).join('')}<button class="btn ghost block mt" data-close>${L('Закрыть', 'Yopish')}</button>`);
  }));
  root.querySelectorAll('[data-qyes]').forEach((b) => b.addEventListener('click', (e) => act(e.currentTarget, async () => {
    const courtId = root.querySelector(`[data-qcourt="${b.dataset.qyes}"]`)?.value || null;
    await store.resolveCourtRequest(b.dataset.qyes, true, courtId);
    toast(L('Одобрено. Владелец укажет этот номер в анкете — и получит кабинет корта.', 'Tasdiqlandi.')); done();
  })));
  root.querySelectorAll('[data-qno]').forEach((b) => b.addEventListener('click', (e) => act(e.currentTarget, async () => { await store.resolveCourtRequest(b.dataset.qno, false); toast(L('Отклонено', 'Rad etildi')); done(); })));
}
