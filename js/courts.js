// Courts: list and map of the region, nearest courts, court choice in challenges and matches, admin editor.
import { L, esc, icon, sheet, toast } from './ui.js';
import { REGIONS, regionShort, regionOf } from './regions.js';

export const SURFACES = [['hard', 'Хард', 'Hard'], ['clay', 'Грунт', 'Grunt'], ['grass', 'Трава', 'O‘t'], ['carpet', 'Ковёр', 'Gilam'], ['mixed', 'Хард и грунт', 'Hard va grunt']];
export const surfaceName = (v) => { const s = SURFACES.find((x) => x[0] === v); return s ? L(s[1], s[2]) : ''; };
const plural = (n, one, few, many) => { const a = n % 10, b = n % 100; return a === 1 && b !== 11 ? one : a >= 2 && a <= 4 && (b < 12 || b > 14) ? few : many; };
const courtsCount = (n) => `${n} ${L(plural(n, 'корт', 'корта', 'кортов'), 'kort')}`;

// Links to navigation apps
export const yandexLink = (c) => `https://yandex.uz/maps/?pt=${c.lng},${c.lat}&z=17&l=map`;
export const googleLink = (c) => `https://www.google.com/maps/search/?api=1&query=${c.lat},${c.lng}`;
export const hasPoint = (c) => c && Number.isFinite(+c.lat) && Number.isFinite(+c.lng) && c.lat !== null && c.lng !== null;

// "📍 Дўстлик · Наманган" — opens the place in Yandex Maps
export function courtLine(c, cls = 'muted small') {
  if (!c) return '';
  const label = `${esc(c.name)}${c.city ? ' · ' + esc(c.city) : ''}`;
  return `<div class="${cls}" style="margin-top:4px">📍 ${hasPoint(c) ? `<a href="${yandexLink(c)}" target="_blank" rel="noopener" style="color:inherit">${label}</a>` : label}</div>`;
}

// <select> of courts grouped by city
export function courtSelect(id, courts, selected = '') {
  const byCity = {};
  courts.filter((c) => c.active !== false).forEach((c) => { (byCity[c.city || '—'] = byCity[c.city || '—'] || []).push(c); });
  const cities = Object.keys(byCity).sort((a, b) => a.localeCompare(b));
  return `<select id="${id}" class="input"><option value="">${L('Корт не выбран', 'Kort tanlanmagan')}</option>${cities.map((city) => `<optgroup label="${esc(city)}">${byCity[city].map((c) => `<option value="${c.id}" ${c.id === selected ? 'selected' : ''}>${esc(c.name)}${c.address ? ' — ' + esc(c.address) : ''}</option>`).join('')}</optgroup>`).join('')}</select>`;
}

// Distance in meters
export function distance(a, b) {
  const R = 6371e3, p = Math.PI / 180;
  const dLat = (b.lat - a.lat) * p, dLng = (b.lng - a.lng) * p;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * p) * Math.cos(b.lat * p) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
const fmtDist = (m) => (m < 1000 ? `${Math.round(m / 10) * 10} ${L('м', 'm')}` : `${(m / 1000).toFixed(m < 10e3 ? 1 : 0).replace('.', ',')} ${L('км', 'km')}`);

// "41.3111, 69.2797", Google link (…@41.31,69.27… or ?q=41.31,69.27) or Yandex link (ll=69.27,41.31 — longitude first)
export function parseCoords(text) {
  const s = String(text || '');
  const yx = s.match(/(?:ll|pt)=(-?\d+\.\d+)(?:%2C|,)(-?\d+\.\d+)/);
  if (yx) return { lat: +yx[2], lng: +yx[1] };
  const m = s.match(/(-?\d{1,2}\.\d{3,})\s*(?:,|%2C|\s)\s*(-?\d{1,3}\.\d{3,})/);
  if (!m) return null;
  let lat = +m[1], lng = +m[2];
  if (lat > 50 && lng < 50) [lat, lng] = [lng, lat]; // Uzbekistan: latitude 37–46, longitude 56–73
  return { lat, lng };
}

// ---------- map (Leaflet + OpenStreetMap), loaded only when a map is opened ----------
let leafletP = null;
function leaflet() {
  if (!leafletP) {
    const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(css);
    leafletP = import('https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet-src.esm.js').catch((e) => { leafletP = null; throw e; });
  }
  return leafletP;
}
export const pin = (Lf, on = false) => Lf.divIcon({ className: '', iconSize: [26, 26], iconAnchor: [13, 26],
  html: `<div style="width:26px;height:26px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${on ? '#D8F244' : '#0E3B2C'};border:3px solid ${on ? '#0E3B2C' : '#D8F244'};box-shadow:0 2px 6px rgba(0,0,0,.35)"></div>` });
export const CENTER = { namangan: [41.0, 71.67], andijan: [40.78, 72.34], fergana: [40.39, 71.78], tashkent_city: [41.31, 69.28], tashkent: [41.2, 69.6],
  samarkand: [39.65, 66.97], bukhara: [39.77, 64.42], jizzakh: [40.12, 67.84], kashkadarya: [38.86, 65.79], navoi: [40.1, 65.38],
  surkhandarya: [37.22, 67.28], syrdarya: [40.49, 68.78], khorezm: [41.55, 60.63], karakalpakstan: [42.46, 59.61] };
export async function makeMap(el, center, zoom = 12) {
  const mod = await leaflet(); const Lf = mod.default || mod;
  const map = Lf.map(el, { zoomControl: true, attributionControl: true }).setView(center, zoom);
  Lf.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
  return { map, Lf };
}

// ---------- courts screen (players: own region; admin: any region + editing) ----------
const cState = { region: '', near: null };
export async function courtsBody(store, { admin = false, region = '' } = {}) {
  const me = store.me();
  const rg = region || cState.region || regionOf(me) || 'namangan';
  cState.region = rg;
  let list = (await store.courts(rg)).filter((c) => admin || c.active);
  if (cState.near) list = list.map((c) => ({ ...c, dist: hasPoint(c) ? distance(cState.near, c) : Infinity })).sort((a, b) => a.dist - b.dist);
  const card = (c) => `<div class="card" data-court="${c.id}" style="${c.active ? '' : 'opacity:.55'}">
    ${!admin && c.photos?.court?.length ? `<a href="#/court/${c.id}"><img src="${esc(c.photos.court[0])}" alt="" loading="lazy" style="width:100%;height:150px;object-fit:cover;border-radius:14px;margin-bottom:10px"></a>` : ''}
    <div class="row between" style="align-items:flex-start;gap:8px"><div class="grow"><a class="strong" href="#/court/${c.id}" style="color:inherit">${esc(c.name)}</a>${c.verified ? ` <span class="tag ok" style="vertical-align:middle">✓ ${L('проверенный', 'tekshirilgan')}</span>` : ''}
      <div class="muted small">${esc([c.city, c.address].filter(Boolean).join(', '))}</div></div>
      ${c.dist !== undefined && c.dist !== Infinity ? `<span class="tag ok">${fmtDist(c.dist)}</span>` : ''}</div>
    <div class="chips mt" style="gap:6px">
      <span class="tag soft">${courtsCount(c.courts)}</span>${c.surface ? `<span class="tag soft">${surfaceName(c.surface)}</span>` : ''}
      ${c.indoor ? `<span class="tag soft">${L('крытый', 'yopiq')}</span>` : ''}${c.lights ? `<span class="tag soft">${L('освещение', 'yoritish')}</span>` : ''}
      ${c.checked ? '' : `<span class="tag warn">${L('данные уточняются', 'aniqlanmoqda')}</span>`}${c.active ? '' : `<span class="tag bad">${L('скрыт', 'yashirin')}</span>`}</div>
    ${c.ratingCount ? `<div class="small mt"><span class="stars">★</span> <b>${(c.ratingSum / c.ratingCount).toFixed(1).replace('.', ',')}</b> <span class="muted">(${c.ratingCount})</span></div>` : ''}
    ${c.price ? `<div class="small mt">${esc(c.price)}</div>` : ''}${c.note ? `<div class="muted small mt">${esc(c.note)}</div>` : ''}
    ${!admin && c.bookingOn && c.ownerId ? `<a class="btn ball block mt" href="#/court/${c.id}">${L('Забронировать', 'Bron qilish')}</a>` : ''}
    <div class="row mt" style="gap:8px;flex-wrap:wrap">
      ${hasPoint(c) ? `<button type="button" class="btn ghost sm" data-show="${c.id}">${L('На карте', 'Xaritada')}</button>
        <a class="btn ghost sm" href="${yandexLink(c)}" target="_blank" rel="noopener">${L('Яндекс', 'Yandex')}</a><a class="btn ghost sm" href="${googleLink(c)}" target="_blank" rel="noopener">Google</a>` : ''}
      ${c.phone ? `<a class="btn ghost sm" href="tel:${esc(c.phone.replace(/[^\d+]/g, ''))}">📞 ${esc(c.phone)}</a>` : ''}
      ${admin ? `<button type="button" class="btn sm" data-editcourt="${c.id}">${L('Изменить', 'Tahrirlash')}</button>` : ''}</div></div>`;
  return `${admin ? `<select class="input" id="cRegion" aria-label="${L('Область', 'Viloyat')}">${REGIONS.map((r) => `<option value="${r.code}" ${r.code === rg ? 'selected' : ''}>${esc(regionShort(r.code))}</option>`).join('')}</select>
      <button type="button" class="btn ball block mt" data-newcourt>${L('+ Добавить корт', '+ Kort qo‘shish')}</button>` : `<div class="muted">${esc(regionShort(rg))} · ${courtsCount(list.reduce((s, c) => s + c.courts, 0))} ${L('в', 'da')} ${list.length} ${L('местах', 'joyda')}</div>`}
    <div id="cmap" class="card" style="height:280px;padding:0;overflow:hidden;margin-top:12px;z-index:0"></div>
    <button type="button" class="btn ${cState.near ? 'ghost' : ''} block" data-near>${cState.near ? L('Показать все по алфавиту', 'Hammasini alifbo bo‘yicha') : '📍 ' + L('Ближайшие ко мне', 'Menga eng yaqin')}</button>
    ${list.map(card).join('') || `<div class="empty">${L('В этой области корты пока не добавлены', 'Bu viloyatda hali kort qo‘shilmagan')}</div>`}
    ${admin ? '' : `<div class="muted small center">${L('Нет вашего корта? Напишите администрации — добавим.', 'Kortingiz yo‘qmi? Ma’muriyatga yozing — qo‘shamiz.')}</div>`}`;
}

export function bindCourts(root, store, rerender, { admin = false } = {}) {
  const rg = cState.region;
  let mapRef = null; const markers = {};
  store.courts(rg).then(async (all) => {
    const list = all.filter((c) => (admin || c.active) && hasPoint(c));
    const el = root.querySelector('#cmap'); if (!el) return;
    try {
      const { map, Lf } = await makeMap(el, CENTER[rg] || [41.3, 69.3], 12);
      mapRef = map;
      list.forEach((c) => {
        markers[c.id] = Lf.marker([c.lat, c.lng], { icon: pin(Lf), title: c.name }).addTo(map)
          .bindPopup(`<b>${esc(c.name)}</b><br>${esc(courtsCount(c.courts))}<br><a href="${yandexLink(c)}" target="_blank" rel="noopener">${L('Яндекс Карты', 'Yandex xarita')}</a> · <a href="${googleLink(c)}" target="_blank" rel="noopener">Google</a>`);
      });
      if (cState.near) Lf.circleMarker([cState.near.lat, cState.near.lng], { radius: 8, color: '#fff', weight: 3, fillColor: '#2F80ED', fillOpacity: 1 }).addTo(map);
      const pts = list.map((c) => [c.lat, c.lng]).concat(cState.near ? [[cState.near.lat, cState.near.lng]] : []);
      if (pts.length > 1) map.fitBounds(pts, { padding: [30, 30], maxZoom: 15 }); else if (pts.length) map.setView(pts[0], 14);
    } catch { el.innerHTML = `<div class="muted center" style="padding:40px 16px">${L('Карта не загрузилась — проверьте интернет', 'Xarita yuklanmadi — internetni tekshiring')}</div>`; }
  });
  root.querySelectorAll('[data-show]').forEach((b) => b.addEventListener('click', () => {
    const m = markers[b.dataset.show]; if (!mapRef || !m) return;
    root.querySelector('#cmap').scrollIntoView({ behavior: 'smooth', block: 'center' });
    mapRef.setView(m.getLatLng(), 16); m.openPopup();
  }));
  root.querySelector('[data-near]')?.addEventListener('click', (e) => {
    if (cState.near) { cState.near = null; rerender(); return; }
    if (!navigator.geolocation) { toast(L('Телефон не даёт определить место', 'Telefon joylashuvni aniqlay olmaydi')); return; }
    e.currentTarget.disabled = true;
    navigator.geolocation.getCurrentPosition((p) => { cState.near = { lat: p.coords.latitude, lng: p.coords.longitude }; rerender(); },
      () => { e.currentTarget.disabled = false; toast(L('Разрешите доступ к геолокации в настройках браузера', 'Brauzer sozlamalarida joylashuvga ruxsat bering')); },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
  });
  if (admin) {
    root.querySelector('#cRegion')?.addEventListener('change', (e) => { cState.region = e.target.value; cState.near = null; rerender(); });
    root.querySelector('[data-newcourt]')?.addEventListener('click', () => courtSheet(store, { region: rg }, rerender));
    root.querySelectorAll('[data-editcourt]').forEach((b) => b.addEventListener('click', async () => {
      const c = (await store.courts(rg)).find((x) => x.id === b.dataset.editcourt); if (c) courtSheet(store, c, rerender);
    }));
  }
}

// Players' screen #/courts
export const courtsView = {
  async render(_, store) {
    return `<div class="pagehead"><a href="#/home" class="iconbtn light" aria-label="${L('Назад', 'Orqaga')}">${icon.back}</a><h1 class="title">${L('Корты', 'Kortlar')}</h1></div>
      <div class="wrap">${await courtsBody(store, { region: regionOf(store.me()) })}</div>`;
  },
  mount(root, _, store) { bindCourts(root, store, () => window.dispatchEvent(new Event('ace:rerender'))); },
};
// Admin tab "Корты" (any region)
export const adminCourts = {
  body: (store) => courtsBody(store, { admin: true }),
  bind: (root, store, rerender) => bindCourts(root, store, rerender, { admin: true }),
};

// ---------- admin editor: name, place on the map (tap), details ----------
function courtSheet(store, c, done) {
  const v = { courts: 1, surface: '', checked: true, active: true, ...c };
  const chk = (id, on, label) => `<label class="row small strong" style="gap:8px;cursor:pointer;margin-top:10px"><input type="checkbox" id="${id}" ${on ? 'checked' : ''} style="width:20px;height:20px;accent-color:var(--court)">${label}</label>`;
  sheet(`<h2 class="h">${c.id ? L('Изменить корт', 'Kortni tahrirlash') : L('Новый корт', 'Yangi kort')}</h2>
    <form id="cf">
      <label class="f" for="cn">${L('Название', 'Nomi')}*</label><input id="cn" class="input" required maxlength="120" value="${esc(v.name || '')}">
      <div class="grid2"><div><label class="f" for="crg2">${L('Область', 'Viloyat')}</label><select id="crg2" class="input">${REGIONS.map((r) => `<option value="${r.code}" ${r.code === v.region ? 'selected' : ''}>${esc(regionShort(r.code))}</option>`).join('')}</select></div>
        <div><label class="f" for="cc">${L('Город / район', 'Shahar / tuman')}</label><input id="cc" class="input" maxlength="80" value="${esc(v.city || '')}"></div></div>
      <label class="f" for="ca">${L('Адрес, ориентир', 'Manzil, mo‘ljal')}</label><input id="ca" class="input" maxlength="200" value="${esc(v.address || '')}">
      <label class="f">${L('Место на карте — нажмите на карту', 'Xaritadagi joy — xaritani bosing')}</label>
      <div id="cpick" style="height:240px;border-radius:14px;overflow:hidden;border:1px solid var(--line);z-index:0"></div>
      <input id="cxy" class="input mt" placeholder="${L('или вставьте координаты / ссылку Google или Яндекс', 'yoki koordinata / Google yoki Yandex havolasini qo‘ying')}" value="${hasPoint(v) ? `${v.lat}, ${v.lng}` : ''}">
      <div class="grid2"><div><label class="f" for="ck">${L('Кортов', 'Kortlar soni')}</label><input id="ck" class="input" type="number" min="1" max="60" value="${v.courts}"></div>
        <div><label class="f" for="cs">${L('Покрытие', 'Qoplama')}</label><select id="cs" class="input"><option value="">—</option>${SURFACES.map(([k, ru, uz]) => `<option value="${k}" ${k === v.surface ? 'selected' : ''}>${L(ru, uz)}</option>`).join('')}</select></div></div>
      ${chk('cin', v.indoor, L('Крытый корт', 'Yopiq kort'))}${chk('cli', v.lights, L('Есть освещение (вечером)', 'Yoritish bor (kechqurun)'))}
      <div class="grid2"><div><label class="f" for="cph2">${L('Телефон', 'Telefon')}</label><input id="cph2" class="input" type="tel" value="${esc(v.phone || '')}"></div>
        <div><label class="f" for="cpr">${L('Цена', 'Narx')}</label><input id="cpr" class="input" maxlength="80" placeholder="100 000 сум/час" value="${esc(v.price || '')}"></div></div>
      <label class="f" for="cno">${L('Примечание', 'Izoh')}</label><input id="cno" class="input" maxlength="200" value="${esc(v.note || '')}">
      ${chk('cok', v.checked, L('Данные проверены', 'Ma’lumot tekshirilgan'))}${chk('cac', v.active, L('Показывать игрокам', 'O‘yinchilarga ko‘rsatish'))}
      ${v.ownerId ? chk('cve', v.verified, L('«Проверенный корт» (у корта есть аккаунт)', '«Tekshirilgan kort» (kortning akkaunti bor)')) : ''}
      <div class="grid2 mt"><button type="button" class="btn ghost" data-close>${L('Отмена', 'Bekor')}</button><button class="btn ball" id="cSave">${L('Сохранить', 'Saqlash')}</button></div>
      ${c.id && store.adminDeleteCourt ? `<button type="button" class="btn danger block mt" id="cDel">${L('Удалить корт', 'Kortni o‘chirish')}</button>` : ''}
    </form>`, async (el, close) => {
    el.querySelector('#cDel')?.addEventListener('click', async (e) => {
      const b = e.currentTarget;
      if (b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = L('Точно удалить? Брони и отзывы тоже удалятся — нажмите ещё раз', 'Aniqmi? Yana bosing'); return; }
      b.disabled = true;
      try { await store.adminDeleteCourt(c.id, false); close(); toast(L('Корт удалён', 'Kort o‘chirildi')); done(); } catch (err) { toast(err.message); b.disabled = false; }
    });
    let point = hasPoint(v) ? { lat: +v.lat, lng: +v.lng } : null;
    let marker = null; let mm = null;
    const xy = el.querySelector('#cxy');
    try {
      const { map, Lf } = await makeMap(el.querySelector('#cpick'), point ? [point.lat, point.lng] : (CENTER[v.region] || [41.3, 69.3]), point ? 16 : 12);
      mm = { map, Lf };
      setTimeout(() => map.invalidateSize(), 250);
      const place = (p, move = false) => {
        point = p; xy.value = `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`;
        if (marker) marker.setLatLng([p.lat, p.lng]); else marker = Lf.marker([p.lat, p.lng], { icon: pin(Lf, true), draggable: true }).addTo(map)
          .on('dragend', () => { const ll = marker.getLatLng(); place({ lat: ll.lat, lng: ll.lng }); });
        if (move) map.setView([p.lat, p.lng], 16);
      };
      if (point) place(point);
      map.on('click', (e) => place({ lat: e.latlng.lat, lng: e.latlng.lng }));
      xy.addEventListener('change', () => { const p = parseCoords(xy.value); if (p) place(p, true); else toast(L('Не понял координаты', 'Koordinata tushunarsiz')); });
    } catch { el.querySelector('#cpick').innerHTML = `<div class="muted center" style="padding:30px">${L('Карта не загрузилась — вставьте координаты ниже', 'Xarita yuklanmadi — pastga koordinata qo‘ying')}</div>`; }
    el.querySelector('#crg2').addEventListener('change', (e) => { if (!point && mm) mm.map.setView(CENTER[e.target.value] || [41.3, 69.3], 12); });
    el.querySelector('#cf').addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!point && xy.value.trim()) point = parseCoords(xy.value);
      if (!point) { toast(L('Поставьте точку на карте', 'Xaritada nuqta qo‘ying')); return; }
      const g = (id) => el.querySelector('#' + id);
      const btn = g('cSave'); btn.disabled = true;
      try {
        await store.saveCourt({ id: c.id, region: g('crg2').value, city: g('cc').value.trim(), name: g('cn').value.trim(), address: g('ca').value.trim(),
          lat: point.lat, lng: point.lng, courts: Math.max(1, Math.min(60, +g('ck').value || 1)), surface: g('cs').value, indoor: g('cin').checked, lights: g('cli').checked,
          phone: g('cph2').value.trim(), price: g('cpr').value.trim(), note: g('cno').value.trim(), checked: g('cok').checked, active: g('cac').checked,
          ...(g('cve') ? { verified: g('cve').checked } : {}) });
        cState.region = g('crg2').value;
        close(); toast(L('Корт сохранён', 'Kort saqlandi')); done();
      } catch (err) { toast(err.message); } finally { btn.disabled = false; }
    });
  });
}

// ---------- coach equipment ----------
export const EQUIPMENT = [
  ['balls', 'Корзина мячей', 'Koptoklar savati'],
  ['rackets', 'Ракетки для учеников', 'O‘quvchilar uchun raketkalar'],
  ['kids', 'Детские ракетки и мячи', 'Bolalar raketka va koptoklari'],
  ['machine', 'Теннисная пушка', 'Tennis to‘p otar mashinasi'],
  ['cones', 'Фишки, лесенка, мишени', 'Fishkalar, narvon, nishonlar'],
  ['court', 'Корт включён в цену', 'Kort narxga kiritilgan'],
  ['video', 'Видеоанализ техники', 'Texnika videotahlili'],
  ['fitness', 'ОФП и разминка', 'UJT va badan qizdirish'],
];
export const equipmentName = (k) => { const e = EQUIPMENT.find((x) => x[0] === k); return e ? L(e[1], e[2]) : ''; };
