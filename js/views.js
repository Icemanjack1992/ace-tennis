import {
  L, esc, icon, logo, avatar, fullName, profileDone, fmtPhone, shortName, formBadges, fmtDate, hoursLeft, fmtNum, comma, toast, sheet, readSets, setLang, getLang,
  yearsText, appContext, installHint, bindInstallHint, normPhone, EXPERIENCE,
} from './ui.js';
import { formatStrength, LEAGUES, fairplay, formatSets, winnerFromSets, FAIRPLAY_MIN_FOR_TOURNAMENT, seasonParts } from './rating.js';

const rerender = () => window.dispatchEvent(new Event('ace:rerender'));
const go = (h) => (location.hash === h ? rerender() : (location.hash = h));
// 'Осенний сезон 26'
export const seasonLabel = (key) => { const p = seasonParts(key); return L(`${p.name.ru} сезон ${p.yy}`, `${p.name.uz} mavsum ${p.yy}`); };
const leagueName = (id) => { const l = LEAGUES.find((x) => x.id === id); return l ? L(l.ru, l.uz) : ''; };
const fpText = (u) => { const f = fairplay(u?.fpSum, u?.fpCount); return f === null ? '—' : comma(f.toFixed(1)); };
const banned = (u) => u?.bannedUntil && new Date(u.bannedUntil) > new Date();
const back = (href = '#/home', light = false) => `<a href="${href}" class="iconbtn ${light ? 'light' : ''}" aria-label="${L('Назад', 'Orqaga')}">${icon.back}</a>`;
// Namangan city + districts of Namangan region: [stored value, ru, uz]
const DISTRICTS = [
  ['г. Наманган', 'г. Наманган', 'Namangan shahri'], ['Касансайский район', 'Касансайский район', 'Kosonsoy tumani'],
  ['Мингбулакский район', 'Мингбулакский район', 'Mingbuloq tumani'], ['Наманганский район', 'Наманганский район', 'Namangan tumani'],
  ['Нарынский район', 'Нарынский район', 'Norin tumani'], ['Папский район', 'Папский район', 'Pop tumani'],
  ['Туракурганский район', 'Туракурганский район', 'To‘raqo‘rg‘on tumani'], ['Уйчинский район', 'Уйчинский район', 'Uychi tumani'],
  ['Учкурганский район', 'Учкурганский район', 'Uchqo‘rg‘on tumani'], ['Чартакский район', 'Чартакский район', 'Chortoq tumani'],
  ['Чустский район', 'Чустский район', 'Chust tumani'], ['Янгикурганский район', 'Янгикурганский район', 'Yangiqo‘rg‘on tumani'],
];
const districtName = (v) => { const d = DISTRICTS.find((x) => x[0] === v); return d ? L(d[1], d[2]) : (v || ''); };
// Birth years for 16+ (2010 … 1950)
const BIRTH_YEARS = Array.from({ length: 2010 - 1950 + 1 }, (_, i) => 2010 - i);
const TIMES = [['утро', 'Утро', 'Ertalab'], ['день', 'День', 'Kunduzi'], ['вечер', 'Вечер', 'Kechqurun'], ['выходные', 'Выходные', 'Dam olish kunlari']];
const SKILLS = [['Подача', 'Serve'], ['Форхенд', 'Forehand'], ['Бэкхенд', 'Backhand'], ['Удар с лёта', 'Volley'], ['Приём подачи', 'Qabul'], ['Физподготовка', 'Jismoniy tayyorgarlik'], ['Тактика', 'Taktika']];
const LEVELS = [['начинающий', 'Начинающий', 'Boshlovchi'], ['средний', 'Средний', 'O‘rta'], ['продвинутый', 'Продвинутый', 'Yuqori']];
const sideLabel = (m, store, side) => (side === 'A' ? m.teamA : m.teamB).map((id) => shortName(store.user(id))).join(' / ');
const scoreFor = (m, userId) => {
  const onA = m.teamA.includes(userId);
  return formatSets(m.sets.map(([a, b]) => (onA ? [a, b] : [b, a])));
};
const wonBy = (m, userId) => (m.winner || winnerFromSets(m.sets)) === (m.teamA.includes(userId) ? 'A' : 'B');
const toLocalInput = (d) => { const z = new Date(d.getTime() - d.getTimezoneOffset() * 6e4); return z.toISOString().slice(0, 16); };
async function act(btn, fn) {
  btn.disabled = true;
  try { await fn(); } catch (e) { toast(e.message); } finally { btn.disabled = false; }
}

// =====================================================================
// Login
// =====================================================================
export const login = {
  render(_, store) {
    const cfg = window.ACE_CONFIG || {};
    const tg = store.mode === 'live' && cfg.telegramBot && store.telegramNonce;
    const mail = store.mode === 'live' && cfg.emailLogin;
    const showSms = store.mode === 'demo' || cfg.smsLogin || (!tg && !mail);
    return `<div class="hero" style="min-height:48vh;display:flex;flex-direction:column;justify-content:flex-end;gap:14px">
      <div class="brand" style="font-size:30px">${logo(56)} Ace Tennis</div>
      <div class="sub" style="font-size:16px">${L('Сообщество любителей тенниса Намангана: рейтинг, соперники, тренеры, турниры', 'Namangan tennis havaskorlari jamoasi: reyting, raqiblar, murabbiylar, turnirlar')}</div>
    </div>
    <div class="wrap">
      ${mail ? `<div class="card">
        <div class="seg" id="mode"><button type="button" class="on" data-m="in">${L('Вход', 'Kirish')}</button><button type="button" data-m="up">${L('Регистрация', 'Ro‘yxatdan o‘tish')}</button></div>
        <form id="mailForm">
          <label class="f" for="em">${L('Электронная почта', 'Elektron pochta')}</label>
          <input id="em" class="input" type="email" inputmode="email" autocomplete="email" autocapitalize="off" spellcheck="false" placeholder="name@gmail.com" required>
          <label class="f" for="pw">${L('Пароль', 'Parol')}</label>
          <div style="position:relative"><input id="pw" class="input" type="password" autocomplete="current-password" minlength="6" required style="padding-right:84px">
            <button type="button" class="linkbtn" id="pwShow" style="position:absolute;right:6px;top:6px;height:36px;padding:0 10px;border:0;background:transparent;font-weight:700;color:var(--muted);cursor:pointer">${L('Показать', 'Ko‘rsatish')}</button></div>
          <div class="muted small mt" id="pwHint" hidden>${L('Минимум 6 символов. Запомните пароль — он нужен для входа с другого телефона.', 'Kamida 6 belgi. Parolni eslab qoling.')}</div>
          <button class="btn ball block mt" type="submit" id="mailBtn">${L('Войти', 'Kirish')}</button>
          <div class="center mt" id="forgot"><button type="button" class="linkbtn" data-forgot style="border:0;background:transparent;color:var(--court);font-weight:700;text-decoration:underline;cursor:pointer;padding:8px">${L('Забыли пароль?', 'Parolni unutdingizmi?')}</button></div>
        </form>
      </div>` : ''}
      ${tg ? `<div class="card">
        <a id="tgBtn" class="btn ball block" href="https://t.me/${esc(cfg.telegramBot)}?start=${store.telegramNonce()}" target="_blank" rel="noopener">${L('Войти через Telegram', 'Telegram orqali kirish')}</a>
        <div class="muted mt" id="tgHint">${L('Откроется бот Ace Tennis: нажмите «Start» и «Поделиться номером». Потом вернитесь в это приложение — вход произойдёт сам.', 'Ace Tennis boti ochiladi: «Start» va «Raqamni yuborish» tugmalarini bosing. So‘ng shu ilovaga qayting — kirish o‘zi bo‘ladi.')}</div>
      </div>` : ''}
      <div class="card dark">
        <div class="strong" style="font-size:17px">${L('Вы тренер по теннису?', 'Siz tennis murabbiyimisiz?')}</div>
        <div class="sub mt" style="margin-top:6px">${L('Оставьте заявку — администратор свяжется с вами. После одобрения вы зарегистрируетесь и сразу получите профиль тренера.', 'Ariza qoldiring — administrator siz bilan bog‘lanadi. Tasdiqlangach, ro‘yxatdan o‘tib murabbiy profilini olasiz.')}</div>
        <button class="btn ball block mt" type="button" data-coach-req>${L('Оставить заявку тренера', 'Murabbiy arizasini qoldirish')}</button>
      </div>
      ${tg || mail ? installHint(false) : ''}
      <div class="card" ${showSms ? '' : 'hidden'}>
        <form id="phoneForm">
          <label class="f" for="phone">${L('Номер телефона', 'Telefon raqami')}</label>
          <input id="phone" class="input" type="tel" inputmode="tel" autocomplete="tel" placeholder="+998 90 123 45 67" value="+998" required>
          <button class="btn ball block mt" type="submit">${L('Получить код', 'Kod olish')}</button>
        </form>
        <form id="codeForm" hidden>
          <label class="f" for="code">${L('Код из SMS', 'SMS kod')}</label>
          <input id="code" class="input" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="••••" required>
          <div class="muted mt" id="hint"></div>
          <button class="btn block mt" type="submit">${L('Войти', 'Kirish')}</button>
        </form>
      </div>
      ${store.mode === 'demo' ? `<div class="card">
        <h2 class="h">${L('Демо-вход', 'Demo kirish')}</h2>
        <div class="muted">${L('Посмотрите приложение глазами разных ролей', 'Ilovani turli rollar ko‘zi bilan ko‘ring')}</div>
        <div class="grid3 mt">
          <button class="btn ghost sm" data-as="player">${L('Игрок', 'O‘yinchi')}</button>
          <button class="btn ghost sm" data-as="coach">${L('Тренер', 'Murabbiy')}</button>
          <button class="btn ghost sm" data-as="admin">${L('Админ', 'Admin')}</button>
        </div></div>` : ''}
      <div class="center"><button class="chip" data-lang>${getLang() === 'ru' ? 'O‘zbekcha' : 'Русский'}</button></div>
    </div>`;
  },
  mount(root, _, store) {
    const cfg = window.ACE_CONFIG || {};
    let phone = '';
    // ---- e-mail + password ----
    const mailForm = root.querySelector('#mailForm');
    if (mailForm) {
      let mode = 'in';
      const pw = root.querySelector('#pw');
      root.querySelectorAll('#mode button').forEach((b) => b.addEventListener('click', () => {
        mode = b.dataset.m;
        root.querySelectorAll('#mode button').forEach((x) => x.classList.toggle('on', x === b));
        root.querySelector('#mailBtn').textContent = mode === 'up' ? L('Зарегистрироваться', 'Ro‘yxatdan o‘tish') : L('Войти', 'Kirish');
        root.querySelector('#pwHint').hidden = mode !== 'up';
        root.querySelector('#forgot').hidden = mode === 'up';
        pw.autocomplete = mode === 'up' ? 'new-password' : 'current-password';
      }));
      root.querySelector('#pwShow').addEventListener('click', (e) => {
        const show = pw.type === 'password'; pw.type = show ? 'text' : 'password';
        e.currentTarget.textContent = show ? L('Скрыть', 'Yashirish') : L('Показать', 'Ko‘rsatish');
      });
      mailForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = root.querySelector('#em').value.trim().toLowerCase(); const password = pw.value;
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast(L('Проверьте адрес почты', 'Pochta manzilini tekshiring')); return; }
        if (password.length < 6) { toast(L('Пароль — минимум 6 символов', 'Parol kamida 6 belgi')); return; }
        act(root.querySelector('#mailBtn'), async () => {
          const r = mode === 'up' ? await store.signUpEmail(email, password) : await store.signInEmail(email, password);
          if (r.confirm) { toast(L('Мы отправили письмо — откройте его, затем войдите', 'Xat yuborildi — uni oching, so‘ng kiring')); return; }
          go(profileDone(r.user) ? '#/home' : '#/onboarding');
        });
      });
    }
    root.querySelector('#phoneForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      phone = root.querySelector('#phone').value.replace(/[^\d+]/g, '');
      if (!/^\+998\d{9}$/.test(phone)) { toast(L('Введите номер в формате +998XXXXXXXXX', 'Raqamni +998XXXXXXXXX shaklida kiriting')); return; }
      await act(e.submitter, async () => {
        const r = await store.sendCode(phone);
        root.querySelector('#phoneForm').hidden = true;
        root.querySelector('#codeForm').hidden = false;
        root.querySelector('#hint').textContent = r.hint || L(`Код отправлен на ${phone}`, `Kod ${phone} raqamiga yuborildi`);
        root.querySelector('#code').focus();
      });
    });
    root.querySelector('#codeForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      await act(e.submitter, async () => {
        const r = await store.verifyCode(phone, root.querySelector('#code').value.trim());
        go(r.isNew ? '#/onboarding' : '#/home');
      });
    });
    const tgBtn = root.querySelector('#tgBtn');
    if (tgBtn) {
      let timer = null; const started = Date.now();
      const hint = root.querySelector('#tgHint');
      const check = async () => {
        try {
          const st = await store.telegramCheck(store.telegramNonce());
          if (st === 'ready') { clearInterval(timer); document.removeEventListener('visibilitychange', onVis); go('#/home'); return; }
          if (st === 'expired' || st === 'used' || Date.now() - started > 15 * 60e3) {
            clearInterval(timer); hint.textContent = L('Время вышло. Обновите страницу и нажмите кнопку ещё раз.', 'Vaqt tugadi. Sahifani yangilang va qayta bosing.');
          }
        } catch (e) { hint.textContent = e.message; }
      };
      // Coming back from Telegram: check at once instead of waiting for the next tick
      const onVis = () => { if (document.visibilityState === 'visible' && timer) check(); };
      const startPolling = () => {
        hint.textContent = L('Ждём подтверждения в Telegram… Поделитесь номером в боте и вернитесь сюда.', 'Telegram’da tasdiq kutilmoqda… Botda raqamni yuboring va bu yerga qayting.');
        if (!timer) {
          timer = setInterval(check, 2500);
          document.addEventListener('visibilitychange', onVis); window.addEventListener('focus', onVis); window.addEventListener('pageshow', onVis);
        }
      };
      tgBtn.addEventListener('click', (e) => {
        store.telegramClicked?.(); startPolling();
        // On phones open the Telegram app directly (no extra page in the browser)
        if (appContext().mobile) {
          e.preventDefault();
          const web = tgBtn.href;
          location.href = `tg://resolve?domain=${encodeURIComponent(cfg.telegramBot)}&start=${store.telegramNonce()}`;
          setTimeout(() => { if (document.visibilityState === 'visible') window.open(web, '_blank') || (location.href = web); }, 1500);
        }
      });
      if (store.telegramPending?.()) startPolling(); // came back after the page reloaded
    }
    root.querySelectorAll('[data-as]').forEach((b) => b.addEventListener('click', async () => {
      await store.loginAs(b.dataset.as); go(b.dataset.as === 'admin' ? '#/admin' : '#/home');
    }));
    root.querySelector('[data-lang]').addEventListener('click', () => { setLang(getLang() === 'ru' ? 'uz' : 'ru'); rerender(); });
    root.querySelector('[data-coach-req]')?.addEventListener('click', () => coachRequestSheet(store));
    root.querySelector('[data-forgot]')?.addEventListener('click', () => forgotSheet(store, root.querySelector('#em')?.value.trim().toLowerCase() || ''));
  },
};

// Forgotten password: step 1 — e-mail, step 2 — code from the letter + new password
function forgotSheet(store, email0) {
  sheet(`<h2 class="h">${L('Восстановление пароля', 'Parolni tiklash')}</h2>
    <form id="fp1">
      <div class="muted">${L('Мы отправим на почту код подтверждения.', 'Pochtaga tasdiqlash kodini yuboramiz.')}</div>
      <label class="f" for="fem">${L('Электронная почта', 'Elektron pochta')}</label>
      <input id="fem" class="input" type="email" inputmode="email" autocapitalize="off" spellcheck="false" value="${esc(email0)}" required>
      <button class="btn ball block mt" id="fpSend">${L('Получить код', 'Kod olish')}</button>
    </form>
    <form id="fp2" hidden>
      <div class="muted" id="fpHint"></div>
      <label class="f" for="fcode">${L('Код из письма', 'Xatdagi kod')}</label>
      <input id="fcode" class="input" inputmode="numeric" autocomplete="one-time-code" maxlength="10" required>
      <label class="f" for="fpw">${L('Новый пароль', 'Yangi parol')}</label>
      <input id="fpw" class="input" type="password" autocomplete="new-password" minlength="6" required>
      <button class="btn ball block mt" id="fpSave">${L('Сохранить и войти', 'Saqlash va kirish')}</button>
      <button type="button" class="btn ghost block mt" id="fpAgain">${L('Отправить код ещё раз', 'Kodni qayta yuborish')}</button>
    </form>`, (el, close) => {
    let email = '';
    const send = (btn) => act(btn, async () => {
      await store.resetPassword(email);
      el.querySelector('#fp1').hidden = true; el.querySelector('#fp2').hidden = false;
      el.querySelector('#fpHint').textContent = L(`Код отправлен на ${email}. Проверьте также папку «Спам».`, `Kod ${email} manziliga yuborildi. «Spam» papkasini ham tekshiring.`);
      el.querySelector('#fcode').focus();
    });
    el.querySelector('#fp1').addEventListener('submit', (e) => {
      e.preventDefault(); email = el.querySelector('#fem').value.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast(L('Проверьте адрес почты', 'Pochta manzilini tekshiring')); return; }
      send(el.querySelector('#fpSend'));
    });
    el.querySelector('#fpAgain').addEventListener('click', (e) => send(e.currentTarget));
    el.querySelector('#fp2').addEventListener('submit', (e) => {
      e.preventDefault();
      const code = el.querySelector('#fcode').value.replace(/\D/g, ''); const pw = el.querySelector('#fpw').value;
      if (code.length < 6) { toast(L('Введите код из письма', 'Xatdagi kodni kiriting')); return; }
      if (pw.length < 6) { toast(L('Пароль — минимум 6 символов', 'Parol kamida 6 belgi')); return; }
      act(el.querySelector('#fpSave'), async () => {
        const r = await store.confirmReset(email, code, pw);
        close(); toast(L('Пароль изменён', 'Parol o‘zgartirildi'));
        go(r.user?.role === 'admin' ? '#/admin' : profileDone(r.user) ? '#/home' : '#/onboarding');
      });
    });
  });
}

// Coach request form (no account needed)
function coachRequestSheet(store) {
  sheet(`<h2 class="h">${L('Заявка тренера', 'Murabbiy arizasi')}</h2>
    <div class="muted">${L('Администратор позвонит вам по этому номеру.', 'Administrator shu raqamga qo‘ng‘iroq qiladi.')}</div>
    <form id="crf">
      <div class="grid2"><div><label class="f" for="cfn">${L('Имя', 'Ism')}*</label><input id="cfn" class="input" required maxlength="60"></div>
        <div><label class="f" for="cln">${L('Фамилия', 'Familiya')}*</label><input id="cln" class="input" required maxlength="60"></div></div>
      <label class="f" for="cph">${L('Номер телефона', 'Telefon raqami')}*</label>
      <input id="cph" class="input" type="tel" inputmode="tel" autocomplete="tel" value="+998 " required>
      <label class="f" for="cex">${L('Опыт тренера', 'Murabbiylik tajribasi')}*</label>
      <select id="cex" class="input" required><option value="">—</option>${EXPERIENCE.map(([v, ru, uz]) => `<option value="${v}">${esc(L(ru, uz))}</option>`).join('')}</select>
      <label class="f" for="cab">${L('О себе: где тренируете, с кем работаете, цена', 'O‘zingiz haqingizda: qayerda, kim bilan, narx')}</label>
      <textarea id="cab" class="input" maxlength="1000"></textarea>
      <div class="grid2 mt"><button type="button" class="btn ghost" data-close>${L('Отмена', 'Bekor')}</button><button class="btn ball" id="crSend">${L('Отправить', 'Yuborish')}</button></div>
    </form>`, (el, close) => {
    el.querySelector('#crf').addEventListener('submit', (e) => {
      e.preventDefault();
      const v = (id) => el.querySelector('#' + id).value.trim();
      const phone = normPhone(v('cph'));
      if (!phone) { toast(L('Введите номер в формате +998 90 123 45 67', 'Raqamni +998 90 123 45 67 shaklida kiriting')); return; }
      act(el.querySelector('#crSend'), async () => {
        await store.coachRequest({ firstName: v('cfn'), lastName: v('cln'), phone, experience: +v('cex') || null, about: v('cab') });
        close();
        sheet(`<h2 class="h">${L('Заявка отправлена', 'Ariza yuborildi')}</h2>
          <div>${L('Администратор Ace Tennis позвонит вам. После одобрения нажмите «Регистрация», введите почту и пароль, а в анкете укажите этот же номер телефона — профиль тренера включится автоматически.', 'Administrator sizga qo‘ng‘iroq qiladi. Tasdiqlangach «Ro‘yxatdan o‘tish»ni bosing va anketada shu raqamni kiriting — murabbiy profili avtomatik yoqiladi.')}</div>
          <button class="btn ball block mt" data-close>${L('Понятно', 'Tushunarli')}</button>`);
      });
    });
  });
}

// =====================================================================
// Onboarding / edit profile
// =====================================================================
export const onboarding = {
  render(_, store) {
    const u = store.me(); const isCoach = u.role === 'coach'; const isNew = !profileDone(u);
    const opt = (list, val) => list.map(([v, ru, uz]) => `<option value="${esc(v)}" ${v === val ? 'selected' : ''}>${esc(L(ru, uz))}</option>`).join('');
    const c = u.coach || {};
    return `<div class="pagehead">${isNew ? '' : back('#/profile', true)}<h1 class="title">${isNew ? L('Анкета', 'Anketa') : L('Редактировать', 'Tahrirlash')}</h1></div>
    <form class="wrap" id="pf">
      ${isNew ? `<div class="card hl"><div class="strong">${L('Добро пожаловать в Ace Tennis!', 'Ace Tennis’ga xush kelibsiz!')}</div><div class="muted">${L('Заполните анкету — по ней соперники смогут найти вас по уровню и времени.', 'Anketani to‘ldiring — raqiblar sizni daraja va vaqt bo‘yicha topadi.')}</div></div>` : ''}
      <div class="card">
        <div class="row">${avatar(u, 'lg')}<div class="grow"><label class="btn ghost sm" style="cursor:pointer">${L('Загрузить фото', 'Rasm yuklash')}<input type="file" accept="image/*" id="photo" hidden></label><div class="muted small" style="margin-top:6px">${L('Фото обязательно', 'Rasm majburiy')}</div></div></div>
        <div class="grid2">
          <div><label class="f" for="fn">${L('Имя', 'Ism')}*</label><input id="fn" class="input" required value="${esc(u.firstName)}"></div>
          <div><label class="f" for="ln">${L('Фамилия', 'Familiya')}*</label><input id="ln" class="input" required value="${esc(u.lastName)}"></div>
        </div>
        <label class="f" for="ph">${L('Номер телефона', 'Telefon raqami')}</label>
        <input id="ph" class="input" type="tel" inputmode="tel" autocomplete="tel" required placeholder="+998 90 123 45 67" value="${esc(u.phone ? fmtPhone(u.phone) : '+998 ')}" aria-describedby="phHint">
        <div class="muted small" id="phHint" style="margin-top:6px">${L('Другие игроки его не видят. Вы сами решаете, кому показать номер, — при вызове на матч.', 'Boshqalar uni ko‘rmaydi. Raqamni kimga ko‘rsatishni o‘yinga chaqiruvda o‘zingiz hal qilasiz.')}</div>
        <div class="grid2">
          <div><label class="f" for="g">${L('Пол', 'Jinsi')}*</label><select id="g" class="input" required><option value="">—</option>${opt([['м', 'Мужской', 'Erkak'], ['ж', 'Женский', 'Ayol']], u.gender)}</select></div>
          <div><label class="f" for="by">${L('Год рождения', 'Tug‘ilgan yil')}*</label><select id="by" class="input" required><option value="">—</option>${BIRTH_YEARS.map((y) => `<option value="${y}" ${Number(u.birthYear) === y ? 'selected' : ''}>${y}</option>`).join('')}</select></div>
        </div>
        <label class="f" for="d">${L('Район', 'Tuman')}*</label>
        <select id="d" class="input" required><option value="">—</option>${opt(DISTRICTS, u.district)}</select>
        <div class="grid2">
          <div><label class="f" for="y">${isCoach ? L('Опыт тренера', 'Murabbiylik tajribasi') : L('Сколько играете', 'Qancha o‘ynaysiz')}*</label><select id="y" class="input" required><option value="">—</option>${opt(EXPERIENCE.map(([v, ru, uz]) => [String(v), ru, uz]), String(u.years ?? ''))}</select></div>
          <div><label class="f" for="h">${L('Ведущая рука', 'Asosiy qo‘l')}</label><select id="h" class="input"><option value="">—</option>${opt([['правша', 'Правша', 'O‘naqay'], ['левша', 'Левша', 'Chapaqay']], u.hand)}</select></div>
        </div>
        ${isCoach ? '' : `<label class="f" for="lv">${L('Уровень (самооценка)', 'Daraja (o‘z bahosi)')}*</label><select id="lv" class="input" required><option value="">—</option>${opt(LEVELS, u.selfLevel)}</select>`}
        <label class="f">${L('Удобное время', 'Qulay vaqt')}*</label>
        <div class="chips" id="times">${TIMES.map(([v, ru, uz]) => `<button type="button" class="chip ${u.availability?.includes(v) ? 'on' : ''}" data-v="${v}" aria-pressed="${u.availability?.includes(v) ? 'true' : 'false'}">${L(ru, uz)}</button>`).join('')}</div>
      </div>
      ${isCoach ? `<div class="card"><h2 class="h">${L('Для тренера', 'Murabbiy uchun')}</h2>
        <label class="f" for="pr">${L('Цена занятия, сум/час', 'Narx, so‘m/soat')}*</label><input id="pr" class="input" type="number" inputmode="numeric" min="0" required value="${esc(c.price ?? '')}">
        <label class="f" for="sp">${L('Специализация (через запятую)', 'Mutaxassislik (vergul bilan)')}*</label><input id="sp" class="input" required value="${esc((c.specialization || []).join(', '))}">
        <label class="f" for="ww">${L('С кем работаете', 'Kim bilan ishlaysiz')}*</label><select id="ww" class="input" required><option value="">—</option>${opt([['дети', 'Дети', 'Bolalar'], ['взрослые', 'Взрослые', 'Kattalar'], ['дети и взрослые', 'Дети и взрослые', 'Bolalar va kattalar']], c.worksWith)}</select>
      </div>` : ''}
      <button class="btn ball block" type="submit">${isNew ? L('Начать играть', 'O‘ynashni boshlash') : L('Сохранить', 'Saqlash')}</button>
    </form>`;
  },
  mount(root, _, store) {
    let photo = store.me().photo;
    root.querySelectorAll('#times .chip').forEach((c) => c.addEventListener('click', () => { c.classList.toggle('on'); c.setAttribute('aria-pressed', c.classList.contains('on')); }));
    root.querySelector('#photo').addEventListener('change', async (e) => {
      const f = e.target.files[0]; if (!f) return;
      photo = await resizeImage(f, 480);
      if (store.uploadPhoto) { const blob = await (await fetch(photo)).blob(); photo = await store.uploadPhoto(new File([blob], 'p.jpg', { type: 'image/jpeg' })); }
      root.querySelector('.av').outerHTML = `<span class="av lg"><img src="${esc(photo)}" alt=""></span>`;
    });
    root.querySelector('#pf').addEventListener('submit', async (e) => {
      e.preventDefault();
      const v = (id) => root.querySelector('#' + id)?.value.trim();
      const availability = [...root.querySelectorAll('#times .chip.on')].map((c) => c.dataset.v);
      if (!availability.length) { toast(L('Выберите удобное время', 'Qulay vaqtni tanlang')); return; }
      if (!photo) { toast(L('Добавьте фото', 'Rasm qo‘shing')); return; }
      const phone = normPhone(v('ph'));
      if (!phone) { toast(L('Введите номер в формате +998 90 123 45 67', 'Raqamni +998 90 123 45 67 shaklida kiriting')); root.querySelector('#ph').focus(); return; }
      const me = store.me();
      const patch = { firstName: v('fn'), lastName: v('ln'), gender: v('g'), birthYear: +v('by'), district: v('d'), years: +v('y'), hand: v('h'), availability, photo };
      if (phone !== normPhone(me.phone)) patch.phone = phone;
      if (me.role !== 'coach') patch.selfLevel = v('lv');
      else patch.coach = { ...(me.coach || {}), price: +v('pr'), specialization: v('sp').split(',').map((s) => s.trim()).filter(Boolean), worksWith: v('ww'), experience: +v('y') };
      const wasNew = !profileDone(me);
      await act(e.submitter, async () => { await store.saveProfile(patch); toast(L('Сохранено', 'Saqlandi')); go(wasNew ? '#/home' : '#/profile'); });
    });
  },
};

function resizeImage(file, max) {
  return new Promise((res, rej) => {
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
      res(c.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = rej; img.src = url;
  });
}

// =====================================================================
// Confirmation gate
// =====================================================================
export const confirmScreen = {
  async render(_, store) {
    const p = await store.pending();
    if (!p.count) { setTimeout(() => go('#/home'), 0); return ''; }
    const me = store.me();
    const mCards = p.matches.map((m) => {
      const won = wonBy(m, me.id);
      return `<div class="card hl">
        <div class="row between"><span class="tag warn">${m.tournamentId ? L('Турнирный матч', 'Turnir o‘yini') : L('Матч', 'O‘yin')}</span><span class="muted strong">${L('осталось', 'qoldi')} ${hoursLeft(m.deadline)} ${L('ч', 'soat')}</span></div>
        <div class="row between mt"><div><div class="strong">${esc(sideLabel(m, store, m.teamA.includes(me.id) ? 'B' : 'A'))}</div>
          <div class="muted">${m.type === 'double' ? L('Парный', 'Juftlik') : L('Одиночный', 'Yakka')} · ${fmtDate(m.playedAt, true)}</div></div>
          <div class="num" style="font-size:22px">${scoreFor(m, me.id)}</div></div>
        <div class="muted mt">${L('Записал(а)', 'Kiritdi')}: ${esc(fullName(store.user(m.createdBy)))} · ${won ? L('ваша победа', 'sizning g‘alabangiz') : L('ваше поражение', 'sizning mag‘lubiyatingiz')}</div>
        <div class="grid2 mt"><button class="btn" data-ok="match:${m.id}">${L('Подтвердить', 'Tasdiqlash')}</button><button class="btn ghost" data-no="match:${m.id}">${L('Оспорить', 'E’tiroz')}</button></div>
      </div>`;
    }).join('');
    const tCards = p.trainings.map((t) => `<div class="card hl">
        <div class="row between"><span class="tag warn">${L('Тренировка', 'Mashg‘ulot')}</span><span class="muted strong">${L('осталось', 'qoldi')} ${hoursLeft(t.deadline)} ${L('ч', 'soat')}</span></div>
        <div class="strong mt">${esc(fullName(store.user(t.playerId)))}</div>
        <div class="muted">${fmtDate(t.playedAt, true)} · ${comma(t.hours)} ${L('ч', 'soat')} · ${esc(t.skills.join(', '))}</div>
        ${t.note ? `<div class="mt">${esc(t.note)}</div>` : ''}
        <div class="grid2 mt"><button class="btn" data-ok="training:${t.id}">${L('Подтвердить', 'Tasdiqlash')}</button><button class="btn ghost" data-no="training:${t.id}">${L('Оспорить', 'E’tiroz')}</button></div>
      </div>`).join('');
    return `<div class="pagehead"><h1 class="title">${L('Сначала подтвердите', 'Avval tasdiqlang')}</h1></div>
      <div class="wrap">
        <div class="muted">${L('Пока записи ждут вашего ответа, остальные разделы закрыты. Это уважение к сопернику: на ответ 48 часов.', 'Yozuvlar javobingizni kutayotgan paytda boshqa bo‘limlar yopiq. Bu raqibga hurmat: javob uchun 48 soat.')}</div>
        ${mCards}${tCards}
      </div>`;
  },
  mount(root, _, store) {
    root.querySelectorAll('[data-ok]').forEach((b) => b.addEventListener('click', () => act(b, async () => {
      const [kind, id] = b.dataset.ok.split(':');
      await store.confirm(kind, id);
      toast(L('Подтверждено', 'Tasdiqlandi'));
      if (kind === 'match') await fairplaySheet(store, id);
      rerender();
    })));
    root.querySelectorAll('[data-no]').forEach((b) => b.addEventListener('click', () => {
      const [kind, id] = b.dataset.no.split(':');
      sheet(`<h2 class="h">${L('Почему вы не согласны?', 'Nega rozi emassiz?')}</h2>
        <textarea class="input" id="why" placeholder="${L('Например: счёт был 6:4 4:6 10:7', 'Masalan: hisob 6:4 4:6 10:7 edi')}"></textarea>
        <div class="muted mt">${L('Спор рассмотрит администратор.', 'Nizoni administrator ko‘rib chiqadi.')}</div>
        <div class="grid2 mt"><button class="btn ghost" data-close>${L('Отмена', 'Bekor')}</button><button class="btn danger" id="send">${L('Оспорить', 'E’tiroz')}</button></div>`,
      (el, close) => el.querySelector('#send').addEventListener('click', async () => {
        const why = el.querySelector('#why').value.trim();
        if (!why) { toast(L('Опишите причину', 'Sababini yozing')); return; }
        await store.dispute(kind, id, why); close(); toast(L('Отправлено администратору', 'Administratorga yuborildi')); rerender();
      }));
    }));
  },
};

function fairplaySheet(store, matchId) {
  return new Promise((resolve) => {
    (async () => {
      const hist = await store.history(store.me().id);
      const m = hist.matches.find((x) => x.id === matchId);
      if (!m) return resolve();
      const opps = (m.teamA.includes(store.me().id) ? m.teamB : m.teamA);
      let stars = 5;
      const close = sheet(`<h2 class="h">Fair Play</h2>
        <div class="muted">${L('Оцените соперника: пунктуальность и честный счёт', 'Raqibni baholang: o‘z vaqtida kelish va halol hisob')}</div>
        <div class="strong mt">${esc(opps.map((id) => fullName(store.user(id))).join(', '))}</div>
        <div class="starpick mt">${[1, 2, 3, 4, 5].map((n) => `<button data-s="${n}" class="${n <= 5 ? 'on' : ''}" aria-label="${n}">★</button>`).join('')}</div>
        <div class="grid2 mt"><button class="btn ghost" data-close>${L('Позже', 'Keyinroq')}</button><button class="btn ball" id="rate">${L('Оценить', 'Baholash')}</button></div>`,
      (el, cl) => {
        el.querySelectorAll('[data-s]').forEach((b) => b.addEventListener('click', () => {
          stars = +b.dataset.s; el.querySelectorAll('[data-s]').forEach((x) => x.classList.toggle('on', +x.dataset.s <= stars));
        }));
        el.querySelector('#rate').addEventListener('click', async () => {
          for (const id of opps) await store.rateFairplay('match', matchId, id, stars);
          cl(); toast(L('Спасибо за оценку', 'Baho uchun rahmat')); resolve();
        });
        el.parentElement.addEventListener('click', (e) => { if (e.target === el.parentElement || e.target.closest('[data-close]')) resolve(); });
      });
      void close;
    })();
  });
}

// =====================================================================
// Home
// =====================================================================
export const home = {
  async render(_, store) {
    const me = store.me();
    if (me.role === 'admin') { setTimeout(() => go('#/admin'), 0); return ''; }
    const [rank, out, chs, sugg, tours, phones] = await Promise.all([
      store.ranking({ league: me.league, period: 'quarter' }), store.outgoing(), store.challenges(), store.suggestOpponent(), store.tournaments(),
      store.contacts ? store.contacts().catch(() => ({})) : {},
    ]);
    // Opponent's number (only if he chose to share it) or a "share mine" button
    const call = (c) => phones[c.id]
      ? `<a class="btn ghost sm" href="tel:+${esc(String(phones[c.id]).replace(/\D/g, ''))}" style="width:100%;margin-top:8px">📞 ${esc(fmtPhone(String(phones[c.id]).replace(/\D/g, '')))}</a>` : '';
    const iShared = (c) => (c.fromId === me.id ? c.shareFrom : c.shareTo);
    const place = rank.find((u) => u.id === me.id)?.place;
    const incoming = chs.filter((c) => c.toId === me.id && c.status === 'sent');
    const upcoming = chs.filter((c) => c.status === 'accepted' && new Date(c.at) > new Date(Date.now() - 3 * 3600e3));
    const myTour = tours.find((t) => t.status === 'running' && t.entries.some((e) => e.userId === me.id));
    // Open registration in my league → a banner on the home screen
    const openTours = tours.filter((t) => t.status === 'registration' && t.league === me.league && !t.entries.some((e) => e.userId === me.id));
    const isCoach = me.role === 'coach';
    const sent = chs.filter((c) => c.fromId === me.id && (c.status === 'sent' || (c.status === 'declined' && new Date(c.at) > new Date(Date.now() - 3 * 864e5))));
    const outCards = [
      ...sent.map((c) => `<div class="row between"><div class="grow"><div class="strong ellipsis">${c.format === 'question' ? L('Вопрос', 'Savol') : L('Вызов', 'Chaqiruv')} · ${esc(shortName(store.user(c.toId)))}</div><div class="muted">${c.format === 'question' ? '' : fmtDate(c.at, true) + ' · '}${c.status === 'declined' ? L('отказ(ала)ся', 'rad etdi') : c.format === 'question' ? L('отправлен', 'yuborildi') : L('ждёт ответа', 'javob kutilmoqda')}</div></div>${c.status === 'declined' ? `<span class="tag bad">${L('Отказ', 'Rad')}</span>` : `<span class="tag soft">${L('Отправлен', 'Yuborildi')}</span>`}</div>`),
      ...out.matches.map((m) => m.status === 'pending'
        ? `<div class="row between"><div class="grow"><div class="strong ellipsis">${esc(sideLabel(m, store, m.teamA.includes(me.id) ? 'B' : 'A'))} · ${scoreFor(m, me.id)}</div><div class="muted">${L('ждёт подтверждения соперника', 'raqib tasdig‘ini kutmoqda')} · ${hoursLeft(m.deadline)} ${L('ч', 'soat')}</div></div><button class="btn ghost sm" data-cancel="match:${m.id}">${L('Отменить', 'Bekor')}</button></div>`
        : `<div class="row between"><div class="grow"><div class="strong ellipsis">${esc(sideLabel(m, store, m.teamA.includes(me.id) ? 'B' : 'A'))}</div><div class="muted">${L('не подтвердил(а) за 48 ч — запись отменена', '48 soatda tasdiqlamadi — yozuv bekor qilindi')}</div></div><button class="btn danger sm" data-complain="${m.id}">${L('Жалоба', 'Shikoyat')}</button></div>`),
      ...out.trainings.map((t) => `<div class="row between"><div class="grow"><div class="strong">${L('Тренировка', 'Mashg‘ulot')} · ${esc(shortName(store.user(t.coachId)))}</div><div class="muted">${L('ждёт тренера', 'murabbiyni kutmoqda')} · ${hoursLeft(t.deadline)} ${L('ч', 'soat')}</div></div><button class="btn ghost sm" data-cancel="training:${t.id}">${L('Отменить', 'Bekor')}</button></div>`),
    ].join('');
    return `<div class="hero">
      <div class="topbar"><a class="brand" href="#/home">${logo(32)} Ace Tennis</a>
        <a class="iconbtn" href="#/news" aria-label="${L('Новости', 'Yangiliklar')}">${icon.bell}${incoming.length ? '<span class="dot"></span>' : ''}</a></div>
      <p class="sub" style="margin:22px 0 4px">${L('Привет', 'Salom')}, ${esc(me.firstName)}</p>
      <div class="row" style="align-items:flex-end;gap:14px">
        <span class="big">${formatStrength(me.rating)}</span>
        <div style="padding-bottom:4px"><div class="sub small">${L('уровень силы', 'kuch darajasi')} · ${fmtNum(me.rating)}</div>
          <div class="strong">${leagueName(me.league)}${place ? ` · ${place} ${L('место', 'o‘rin')}` : ''} · ${fmtNum(me.pointsQ)} ${L('очк.', 'ochko')}</div></div>
      </div>
      <div class="row mt" style="gap:8px"><span class="sub small">${L('Последние 5:', 'So‘nggi 5:')}</span>${formBadges(me.form, 'hero')}</div>
      ${banned(me) ? `<div class="tag bad mt">${L('Аккаунт ограничен до', 'Akkaunt cheklangan')}: ${fmtDate(me.bannedUntil)}</div>` : ''}
    </div>
    <div class="wrap">
      ${installHint()}
      ${openTours.map((t) => `<a href="#/tournament/${t.id}" class="card dark" style="text-decoration:none;display:block"><span class="tag ball">${L('Открыта регистрация', 'Ro‘yxatdan o‘tish ochiq')}</span>
        <div class="num mt" style="font-size:22px;text-transform:uppercase;color:#fff">${esc(t.name)}</div>
        <div class="sub">${L('Лига', 'Liga')} ${leagueName(t.league)} · ${fmtDate(t.startsAt)} – ${fmtDate(t.endsAt)} · ${t.entries.filter((e) => e.status === 'approved').length}/8</div>
        <div class="btn ball block mt">${L('Подать заявку', 'Ariza berish')}</div></a>`).join('')}
      ${incoming.map((c) => `<div class="card hl"><span class="tag warn">${c.format === 'question' ? L('Вопрос', 'Savol') : L('Вызов на матч', 'O‘yinga chaqiruv')}</span>
        <div class="row mt">${avatar(store.user(c.fromId))}<div class="grow"><div class="strong">${esc(fullName(store.user(c.fromId)))}</div><div class="muted">${c.format === 'question' ? '' : fmtDate(c.at, true) + ' · '}${esc(c.note || '')}</div></div></div>
        ${call(c)}
        ${c.format === 'question' ? `<div class="grid2 mt"><button class="btn sm" data-ans="${c.id}:accepted">${L('Прочитано', 'O‘qildi')}</button></div>` :
        `<label class="row mt small strong" style="gap:8px;cursor:pointer"><input type="checkbox" data-share-ans="${c.id}" checked style="width:20px;height:20px;accent-color:var(--court)">${L('Показать мой номер сопернику', 'Raqamimni raqibga ko‘rsatish')}</label>
        <div class="grid2 mt"><button class="btn sm" data-ans="${c.id}:accepted">${L('Принять', 'Qabul qilish')}</button><button class="btn ghost sm" data-ans="${c.id}:declined">${L('Отказать', 'Rad etish')}</button></div>`}</div>`).join('')}
      ${outCards ? `<div class="card"><h2 class="h">${L('Мои записи', 'Mening yozuvlarim')}</h2><div class="list">${outCards}</div></div>` : ''}
      <div class="grid2">
        <a href="#/tournaments" class="card dark" style="text-decoration:none;display:flex;flex-direction:column;gap:6px">${icon.trophy.replace('currentColor', '#D8F244')}<span class="num" style="font-size:18px;text-transform:uppercase">${L('Турниры', 'Turnirlar')}</span><span class="sub small">${myTour ? L('Вы участвуете', 'Siz ishtirokchisiz') : L('Заявки и сетки', 'Arizalar va to‘rlar')}</span></a>
        <a href="#/news" class="card" style="text-decoration:none;color:inherit;display:flex;flex-direction:column;gap:6px">${icon.news}<span class="num" style="font-size:18px;text-transform:uppercase">${L('Новости', 'Yangiliklar')}</span><span class="muted small">${L('Итоги, фото, анонсы', 'Natijalar, rasmlar')}</span></a>
      </div>
      ${sugg && !isCoach ? `<div class="card"><h2 class="h">${L('Вам подходит соперник', 'Sizga mos raqib')}</h2>
        <a href="#/profile/${sugg.id}" class="row" style="text-decoration:none;color:inherit">${avatar(sugg)}<div class="grow"><div class="strong">${esc(fullName(sugg))}</div><div class="muted">${L('УС', 'KD')} ${formatStrength(sugg.rating)} · ${leagueName(sugg.league)} · ${esc(sugg.availability.join(', '))}</div></div></a>
        <div class="row between mt">${formBadges(sugg.form)}<button class="btn ball sm" data-challenge="${sugg.id}">${L('Вызвать на матч', 'O‘yinga chaqirish')}</button></div></div>` : ''}
      <div class="card"><h2 class="h">${L('Ближайшие игры', 'Yaqin o‘yinlar')}</h2>
        ${upcoming.length ? `<div class="list">${upcoming.map((c) => { const o = store.user(c.fromId === me.id ? c.toId : c.fromId); const d = new Date(c.at); return `<div><div class="row"><div style="width:44px;text-align:center"><div class="num" style="font-size:22px;line-height:1">${d.getDate()}</div><div class="muted small strong">${fmtDate(c.at).split(' ')[1].toUpperCase()}</div></div><div class="grow"><div class="strong">${L('Матч с', 'O‘yin:')} ${esc(shortName(o))}</div><div class="muted">${fmtDate(c.at, true).split(', ')[1]} · ${c.format === 'double' ? L('парный', 'juftlik') : L('одиночный', 'yakka')}</div></div><span class="tag ok">${L('Договорились', 'Kelishildi')}</span></div>
          ${call(c) || `<div class="muted small" style="margin:4px 0 0 56px">${L('Соперник пока не открыл номер', 'Raqib hali raqamini ochmadi')}</div>`}
          ${iShared(c) ? '' : `<button class="btn ghost sm" data-share="${c.id}" style="width:100%;margin-top:8px">${L('Поделиться моим номером', 'Raqamimni ulashish')}</button>`}</div>`; }).join('')}</div>`
        : `<div class="empty">${L('Пока нет запланированных игр. Найдите соперника в поиске.', 'Rejalashtirilgan o‘yin yo‘q. Qidiruvdan raqib toping.')}</div>`}
      </div>
    </div>`;
  },
  mount(root, _, store) {
    bindInstallHint(root);
    root.querySelectorAll('[data-ans]').forEach((b) => b.addEventListener('click', () => act(b, async () => {
      const [id, st] = b.dataset.ans.split(':');
      const share = !!root.querySelector(`[data-share-ans="${id}"]`)?.checked;
      await store.answerChallenge(id, st, share); rerender();
    })));
    root.querySelectorAll('[data-share]').forEach((b) => b.addEventListener('click', () => act(b, async () => {
      await store.sharePhone(b.dataset.share); toast(L('Сопернику открыт ваш номер', 'Raqamingiz raqibga ochildi')); rerender();
    })));
    root.querySelectorAll('[data-cancel]').forEach((b) => b.addEventListener('click', () => act(b, async () => {
      const [k, id] = b.dataset.cancel.split(':'); await store.cancelOwn(k, id); toast(L('Запись отменена', 'Yozuv bekor qilindi')); rerender();
    })));
    root.querySelectorAll('[data-complain]').forEach((b) => b.addEventListener('click', async () => {
      const out = await store.outgoing(); const m = out.matches.find((x) => x.id === b.dataset.complain);
      const target = (m.teamA.includes(store.me().id) ? m.teamB : m.teamA)[0];
      complaintSheet(store, target, m.id, L('Не подтвердил матч за 48 часов', '48 soatda o‘yinni tasdiqlamadi'));
    }));
    root.querySelectorAll('[data-challenge]').forEach((b) => b.addEventListener('click', () => challengeSheet(store, b.dataset.challenge)));
  },
};

export function challengeSheet(store, toId, question = false) {
  const u = store.user(toId);
  const d = new Date(Date.now() + 24 * 3600e3); d.setHours(18, 0, 0, 0);
  sheet(`<h2 class="h">${question ? L('Вопрос тренеру', 'Murabbiyga savol') : L('Вызов на матч', 'O‘yinga chaqiruv')}</h2>
    <div class="row">${avatar(u)}<div class="strong">${esc(fullName(u))}</div></div>
    ${question ? '' : `<label class="f" for="at">${L('Дата и время', 'Sana va vaqt')}</label><input class="input" type="datetime-local" id="at" value="${toLocalInput(d)}">
    <label class="f">${L('Формат', 'Format')}</label><div class="seg" id="fmt"><button class="on" data-v="single">${L('Одиночный', 'Yakka')}</button><button data-v="double">${L('Парный', 'Juftlik')}</button></div>`}
    <label class="f" for="note">${question ? L('Ваш вопрос', 'Savolingiz') : L('Комментарий (корт, район)', 'Izoh (kort, tuman)')}</label>
    <textarea class="input" id="note"></textarea>
    <label class="row mt small strong" style="gap:8px;cursor:pointer"><input type="checkbox" id="share" checked style="width:20px;height:20px;accent-color:var(--court)">${question ? L('Показать мой номер тренеру', 'Raqamimni murabbiyga ko‘rsatish') : L('Показать мой номер сопернику', 'Raqamimni raqibga ko‘rsatish')}</label>
    <div class="grid2 mt"><button class="btn ghost" data-close>${L('Отмена', 'Bekor')}</button><button class="btn ball" id="send">${L('Отправить', 'Yuborish')}</button></div>`,
  (el, close) => {
    el.querySelectorAll('#fmt button').forEach((b) => b.addEventListener('click', () => { el.querySelectorAll('#fmt button').forEach((x) => x.classList.remove('on')); b.classList.add('on'); }));
    const send = el.querySelector('#send');
    send.addEventListener('click', () => act(send, async () => {
      if (banned(store.me())) { toast(L('Аккаунт временно ограничен', 'Akkaunt vaqtincha cheklangan')); return; }
      const note = el.querySelector('#note').value.trim();
      if (question && !note) { toast(L('Напишите вопрос', 'Savol yozing')); return; }
      await store.createChallenge({ toId, at: question ? new Date().toISOString() : new Date(el.querySelector('#at').value).toISOString(),
        format: question ? 'question' : el.querySelector('#fmt .on').dataset.v, note, share: el.querySelector('#share').checked });
      close(); toast(question ? L('Вопрос отправлен', 'Savol yuborildi') : L('Вызов отправлен — соперник увидит его на главной', 'Chaqiruv yuborildi — raqib uni bosh sahifada ko‘radi'));
      if (location.hash === '#/home') rerender();
    }));
  });
}

export function complaintSheet(store, targetId, refId, preset = '') {
  const reasons = [L('Не пришёл на матч', 'O‘yinga kelmadi'), L('Отменил в последний момент', 'Oxirgi daqiqada bekor qildi'), L('Не подтвердил матч за 48 часов', '48 soatda o‘yinni tasdiqlamadi'), L('Неверный счёт', 'Noto‘g‘ri hisob'), L('Неуважительное поведение', 'Hurmatsizlik')];
  sheet(`<h2 class="h">${L('Жалоба', 'Shikoyat')}</h2><div class="strong">${esc(fullName(store.user(targetId)))}</div>
    <div class="chips mt" id="rs">${reasons.map((r) => `<button class="chip ${r === preset ? 'on' : ''}">${esc(r)}</button>`).join('')}</div>
    <div class="muted mt">${L('2 подтверждённые жалобы за месяц — блокировка на 7 дней. Жалобы проверяет администратор.', 'Oyiga 2 ta tasdiqlangan shikoyat — 7 kunlik blok. Shikoyatlarni administrator tekshiradi.')}</div>
    <div class="grid2 mt"><button class="btn ghost" data-close>${L('Отмена', 'Bekor')}</button><button class="btn danger" id="send">${L('Отправить', 'Yuborish')}</button></div>`,
  (el, close) => {
    el.querySelectorAll('#rs .chip').forEach((c) => c.addEventListener('click', () => { el.querySelectorAll('#rs .chip').forEach((x) => x.classList.remove('on')); c.classList.add('on'); }));
    el.querySelector('#send').addEventListener('click', async () => {
      const r = el.querySelector('#rs .on')?.textContent; if (!r) { toast(L('Выберите причину', 'Sababni tanlang')); return; }
      await store.complain({ targetId, reason: r, refId }); close(); toast(L('Жалоба отправлена', 'Shikoyat yuborildi')); rerender();
    });
  });
}

// =====================================================================
// Add match / training
// =====================================================================
export const add = {
  async render(params, store) {
    const tab = params[0] === 'training' ? 'training' : 'match';
    const q = new URLSearchParams(params[1] || '');
    const me = store.me();
    const players = (await store.listUsers()).filter((u) => u.id !== me.id && u.role !== 'admin');
    const coaches = (await store.listUsers({ role: 'coach' })).filter((u) => u.id !== me.id);
    const opts = (list, sel) => `<option value="">${L('Выберите', 'Tanlang')}</option>` + list.sort((a, b) => fullName(a).localeCompare(fullName(b))).map((u) => `<option value="${u.id}" ${u.id === sel ? 'selected' : ''}>${esc(fullName(u))} · ${formatStrength(u.rating)}</option>`).join('');
    const now = toLocalInput(new Date());
    return `<div class="pagehead">${back('#/home', true)}<h1 class="title">${L('Новая запись', 'Yangi yozuv')}</h1></div>
    <div class="wrap">
      <div class="seg"><button class="${tab === 'match' ? 'on' : ''}" data-tab="match">${L('Матч', 'O‘yin')}</button><button class="${tab === 'training' ? 'on' : ''}" data-tab="training">${L('Тренировка', 'Mashg‘ulot')}</button></div>
      ${banned(me) ? `<div class="card"><span class="tag bad">${L('Аккаунт ограничен до', 'Akkaunt cheklangan')} ${fmtDate(me.bannedUntil)}</span></div>` : tab === 'match' ? `
      <form id="mf" class="wrap" style="padding:0">
        <div class="card">
          <label class="f" style="margin-top:0">${L('Формат', 'Format')}</label>
          <div class="seg" id="type"><button type="button" class="on" data-v="single">${L('Одиночный', 'Yakka')}</button><button type="button" data-v="double">${L('Парный', 'Juftlik')}</button></div>
          <div id="singleBox"><label class="f" for="opp">${L('Соперник', 'Raqib')}</label><select id="opp" class="input">${opts(players, q.get('opp'))}</select></div>
          <div id="doubleBox" hidden>
            <label class="f" for="partner">${L('Ваш партнёр', 'Sherigingiz')}</label><select id="partner" class="input">${opts(players)}</select>
            <label class="f" for="o1">${L('Соперник 1', 'Raqib 1')}</label><select id="o1" class="input">${opts(players)}</select>
            <label class="f" for="o2">${L('Соперник 2', 'Raqib 2')}</label><select id="o2" class="input">${opts(players)}</select>
          </div>
          <label class="f" for="when">${L('Дата и время', 'Sana va vaqt')}</label><input id="when" type="datetime-local" class="input" value="${now}" max="${now}">
        </div>
        <div class="card dark">
          <div class="row between"><span class="strong">${L('Счёт по сетам', 'Setlar bo‘yicha hisob')}</span>
            <div class="row" style="gap:6px"><button type="button" class="iconbtn" data-sets="-1" aria-label="${L('Убрать сет', 'Setni olib tashlash')}">−</button><button type="button" class="iconbtn" data-sets="1" aria-label="${L('Добавить сет', 'Set qo‘shish')}">+</button></div></div>
          <div id="score" class="mt"></div>
          <label class="row mt" style="gap:10px;cursor:pointer"><input type="checkbox" id="stb" style="width:22px;height:22px;accent-color:#D8F244"><span>${L('Решающий сет — супертай-брейк до 10', 'Hal qiluvchi set — supertay-breyk 10 gacha')}</span></label>
        </div>
        <div class="muted row" style="gap:8px">${icon.clock}<span>${L('Соперник должен подтвердить счёт в течение 48 часов', 'Raqib hisobni 48 soat ichida tasdiqlashi kerak')}</span></div>
        <button class="btn ball block" type="submit">${L('Отправить на подтверждение', 'Tasdiqlashga yuborish')}</button>
      </form>` : `
      <form id="tf" class="wrap" style="padding:0">
        <div class="card">
          <label class="f" style="margin-top:0" for="coach">${L('Тренер', 'Murabbiy')}</label>
          <select id="coach" class="input"><option value="">${L('Без тренера (самостоятельно)', 'Murabbiysiz (mustaqil)')}</option>${coaches.map((c) => `<option value="${c.id}" ${c.id === q.get('coach') ? 'selected' : ''}>${esc(fullName(c))}</option>`).join('')}</select>
          <div class="grid2"><div><label class="f" for="hrs">${L('Длительность, ч', 'Davomiyligi, soat')}</label><select id="hrs" class="input">${[0.5, 1, 1.5, 2, 2.5, 3].map((h) => `<option value="${h}" ${h === 1.5 ? 'selected' : ''}>${comma(h)}</option>`).join('')}</select></div>
            <div><label class="f" for="tw">${L('Когда', 'Qachon')}</label><input id="tw" type="datetime-local" class="input" value="${now}" max="${now}"></div></div>
          <label class="f">${L('Что тренировали', 'Nimani mashq qildingiz')}</label>
          <div class="chips" id="sk">${SKILLS.map(([ru, uz]) => `<button type="button" class="chip" data-v="${ru}">${L(ru, uz)}</button>`).join('')}</div>
          <label class="f" for="note">${L('Комментарий', 'Izoh')}</label><textarea id="note" class="input" placeholder="${L('Над чем работали', 'Nima ustida ishladingiz')}"></textarea>
        </div>
        <div class="muted row" style="gap:8px">${icon.clock}<span>${L('Тренер подтвердит в течение 48 часов. Без тренера — запись сразу в личную статистику.', 'Murabbiy 48 soat ichida tasdiqlaydi. Murabbiysiz — darhol shaxsiy statistikaga.')}</span></div>
        <button class="btn ball block" type="submit">${L('Сохранить тренировку', 'Mashg‘ulotni saqlash')}</button>
      </form>`}
    </div>`;
  },
  mount(root, params, store) {
    root.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => go(`#/add/${b.dataset.tab}`)));
    const mf = root.querySelector('#mf');
    if (mf) {
      let n = 3; let type = 'single';
      const me = store.me();
      const names = () => {
        if (type === 'single') return [L('Вы', 'Siz'), shortName(store.user(root.querySelector('#opp').value)) || L('Соперник', 'Raqib')];
        return [L('Вы', 'Siz') + ' / ' + (shortName(store.user(root.querySelector('#partner').value)) || '…'),
          (shortName(store.user(root.querySelector('#o1').value)) || '…') + ' / ' + (shortName(store.user(root.querySelector('#o2').value)) || '…')];
      };
      const drawScore = () => {
        const prev = readSets(root);
        const [na, nb] = names();
        const cell = (i, side) => { const v = prev[i] ? prev[i][side === 'a' ? 0 : 1] : ''; return `<input class="cell" inputmode="numeric" maxlength="2" data-set="${i}" data-side="${side}" value="${v ?? ''}" aria-label="${side === 'a' ? na : nb}, ${L('сет', 'set')} ${i + 1}">`; };
        root.querySelector('#score').innerHTML = `<div class="score" style="--n:${n}"><span class="lbl" style="text-align:left">${L('ИГРОК', 'O‘YINCHI')}</span>${Array.from({ length: n }, (_, i) => `<span class="lbl">${i + 1}</span>`).join('')}
          <span class="strong ellipsis">${esc(na)}</span>${Array.from({ length: n }, (_, i) => cell(i, 'a')).join('')}
          <span class="strong ellipsis">${esc(nb)}</span>${Array.from({ length: n }, (_, i) => cell(i, 'b')).join('')}</div>`;
        paint();
      };
      const paint = () => root.querySelectorAll('#score .cell').forEach((c) => {
        const other = root.querySelector(`[data-set="${c.dataset.set}"][data-side="${c.dataset.side === 'a' ? 'b' : 'a'}"]`);
        c.classList.toggle('win', c.value !== '' && other.value !== '' && +c.value > +other.value);
      });
      root.querySelector('#score').addEventListener('input', paint);
      root.querySelectorAll('[data-sets]').forEach((b) => b.addEventListener('click', () => { n = Math.max(1, Math.min(5, n + +b.dataset.sets)); drawScore(); }));
      root.querySelectorAll('#type button').forEach((b) => b.addEventListener('click', () => {
        type = b.dataset.v; root.querySelectorAll('#type button').forEach((x) => x.classList.toggle('on', x === b));
        root.querySelector('#singleBox').hidden = type !== 'single'; root.querySelector('#doubleBox').hidden = type !== 'double'; drawScore();
      }));
      root.querySelectorAll('select').forEach((s) => s.addEventListener('change', drawScore));
      drawScore();
      mf.addEventListener('submit', async (e) => {
        e.preventDefault();
        let teamA, teamB;
        if (type === 'single') { const o = root.querySelector('#opp').value; if (!o) { toast(L('Выберите соперника', 'Raqibni tanlang')); return; } teamA = [me.id]; teamB = [o]; }
        else {
          const p = root.querySelector('#partner').value, o1 = root.querySelector('#o1').value, o2 = root.querySelector('#o2').value;
          if (!p || !o1 || !o2 || new Set([p, o1, o2]).size < 3) { toast(L('Выберите партнёра и двух разных соперников', 'Sherik va ikki xil raqibni tanlang')); return; }
          teamA = [me.id, p]; teamB = [o1, o2];
        }
        const sets = readSets(root);
        if (!sets.length || !winnerFromSets(sets)) { toast(L('Введите счёт — должен быть победитель', 'Hisobni kiriting — g‘olib bo‘lishi kerak')); return; }
        if (sets.some(([a, b]) => a === b)) { toast(L('В сете не может быть ничьей', 'Setda durang bo‘lmaydi')); return; }
        const playedAt = new Date(root.querySelector('#when').value).toISOString();
        await act(e.submitter, async () => {
          await store.createMatch({ type, teamA, teamB, sets, decider: root.querySelector('#stb').checked ? 'supertb' : 'set', playedAt });
          toast(L('Отправлено сопернику на подтверждение', 'Raqibga tasdiqlash uchun yuborildi')); go('#/home');
        });
      });
    }
    const tf = root.querySelector('#tf');
    if (tf) {
      root.querySelectorAll('#sk .chip').forEach((c) => c.addEventListener('click', () => c.classList.toggle('on')));
      tf.addEventListener('submit', async (e) => {
        e.preventDefault();
        const skills = [...root.querySelectorAll('#sk .chip.on')].map((c) => c.dataset.v);
        if (!skills.length) { toast(L('Отметьте, что тренировали', 'Nimani mashq qilganingizni belgilang')); return; }
        await act(e.submitter, async () => {
          const coachId = root.querySelector('#coach').value || null;
          await store.createTraining({ coachId, hours: +root.querySelector('#hrs').value, skills, note: root.querySelector('#note').value.trim(), playedAt: new Date(root.querySelector('#tw').value).toISOString() });
          toast(coachId ? L('Отправлено тренеру на подтверждение', 'Murabbiyga yuborildi') : L('Тренировка сохранена', 'Mashg‘ulot saqlandi')); go('#/home');
        });
      });
    }
  },
};

// =====================================================================
// Profile
// =====================================================================
function sparkline(points) {
  if (points.length < 2) return '';
  const w = 326, h = 70, min = Math.min(...points), max = Math.max(...points), span = Math.max(1, max - min);
  const xy = points.map((v, i) => [Math.round((i / (points.length - 1)) * w), Math.round(h - 6 - ((v - min) / span) * (h - 12))]);
  const d = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ');
  return `<svg role="img" aria-label="${L('Рейтинг', 'Reyting')}: ${points[0]} → ${points[points.length - 1]}" viewBox="0 0 ${w} ${h}" style="width:100%;height:70px;display:block;margin-top:12px">
    <path d="${d} L${w} ${h} L0 ${h} Z" fill="#D8F244" fill-opacity=".35"/><path d="${d}" fill="none" stroke="#0E3B2C" stroke-width="2.5" stroke-linejoin="round"/></svg>`;
}

export const profile = {
  async render(params, store) {
    const me = store.me();
    const id = params[0] || me.id; const own = id === me.id;
    if (!params[0] && me.role === 'admin') { setTimeout(() => go('#/admin'), 0); return ''; }
    const u = store.user(id);
    if (!u) return `<div class="wrap"><div class="card">${L('Игрок не найден', 'O‘yinchi topilmadi')}</div></div>`;
    if (u.role === 'coach' && !own) { setTimeout(() => go(`#/coach/${id}`), 0); return ''; }
    const [hist, ach, rank, fpRank] = await Promise.all([store.history(id), store.achievements(id), store.ranking({ league: u.league, period: 'quarter' }), store.fairplayRanking()]);
    const place = rank.find((x) => x.id === id)?.place;
    const fpPlace = fpRank.findIndex((x) => x.id === id) + 1;
    const winPct = u.matches ? Math.round((u.wins / u.matches) * 100) : 0;
    // rating path from deltas, oldest → newest
    const ms = [...hist.matches].reverse();
    let r = u.rating - ms.reduce((s, m) => s + (m.deltas?.[id] || 0), 0);
    const path = [r, ...ms.map((m) => (r += m.deltas?.[id] || 0))];
    const isCoach = u.role === 'coach';
    const trainHours = hist.trainings.filter((t) => t.playerId === id).reduce((s, t) => s + t.hours, 0);
    return `<div class="hero">
      <div class="topbar">${own ? `<span></span>` : back('#/rating')}
        ${own ? `<a class="btn ghost sm" style="background:transparent;color:#fff;border-color:rgba(255,255,255,.25)" href="#/edit">${L('Редактировать', 'Tahrirlash')}</a>` : `<button class="btn ghost sm" style="background:transparent;color:#fff;border-color:rgba(255,255,255,.25)" data-complain>${L('Пожаловаться', 'Shikoyat')}</button>`}</div>
      <div class="row mt" style="gap:16px">${avatar(u, 'lg')}<div class="grow"><h1 class="title" style="font-size:26px;text-transform:none">${esc(fullName(u))}</h1>
        <div class="sub">${isCoach ? L('Тренер', 'Murabbiy') : L('Любитель', 'Havaskor')} · ${isCoach ? yearsText(u.coach?.experience || u.years, 'exp') : yearsText(u.years)}</div>
        <div class="sub">${esc([u.hand, districtName(u.district)].filter(Boolean).join(' · '))}</div></div></div>
      <div class="grid3 mt">
        <div class="stat"><div class="num" style="color:var(--ball)">${formatStrength(u.rating)}</div><div class="sub small">${L('уровень силы', 'kuch darajasi')}</div></div>
        <div class="stat"><div class="num">${place ? '#' + place : '—'}</div><div class="sub small">${leagueName(u.league)}</div></div>
        <div class="stat"><div class="num">${winPct}%</div><div class="sub small">${L('побед', 'g‘alaba')}</div></div>
      </div>
      <div class="stat mt row between" style="background:rgba(216,242,68,.12);border:1px solid rgba(216,242,68,.4)">
        <div class="row" style="gap:8px">${icon.shield.replace('currentColor', '#D8F244')}<div><div class="strong">Fair Play${fpPlace ? ` · ${fpPlace} ${L('место', 'o‘rin')}` : ''}</div><div class="sub small">${L('пунктуальность · честный счёт', 'o‘z vaqtida · halol hisob')} · ${u.fpCount} ${L('оценок', 'baho')}</div></div></div>
        <span class="num" style="font-size:24px;color:var(--ball)">${fpText(u)}</span></div>
      ${!own && store.me().role !== 'admin' ? `<div class="grid2 mt"><button class="btn ball" data-challenge>${L('Вызвать', 'Chaqirish')}</button><a class="btn ghost" style="background:transparent;color:#fff;border-color:rgba(255,255,255,.3)" href="#/add/match?opp=${id}">${L('Записать матч', 'O‘yin yozish')}</a></div>` : ''}
    </div>
    <div class="wrap">
      <div class="card"><div class="row between"><h2 class="h" style="margin:0">${L('Достижения', 'Yutuqlar')}</h2><span class="muted strong">${ach.length}</span></div>
        ${ach.length ? `<div class="grid3 mt">${ach.slice(0, 6).map((a) => `<div class="center"><div class="av" style="width:56px;height:56px;margin:0 auto;${a.code.includes('champion') || a.code === 'tour_win' ? 'background:var(--court);border:3px solid var(--ball)' : 'background:var(--ball);color:var(--court)'}">${a.code.includes('champion') || a.code === 'tour_win' ? '1' : a.code.startsWith('matches') ? a.code.slice(7) : a.code.includes('top10') ? '10' : a.code.includes('top3') ? '3' : icon.bolt}</div><div class="small strong" style="margin-top:6px;line-height:1.25">${esc(a.title)}</div><div class="muted small">${esc(a.detail || fmtDate(a.createdAt))}</div></div>`).join('')}</div>`
        : `<div class="empty">${L('Сыграйте матчи, чтобы получить первые достижения', 'Birinchi yutuqlar uchun o‘yin o‘ynang')}</div>`}</div>
      <div class="card"><div class="row between"><h2 class="h" style="margin:0">${L('Форма', 'Forma')}</h2><span class="muted strong">${u.matches} ${L('матч.', 'o‘yin')} · ${u.wins} ${L('В', 'G')} · ${u.matches - u.wins} ${L('П', 'M')}</span></div>
        <div class="mt">${formBadges(u.form, 'big')}</div>${sparkline(path)}
        <div class="row between muted small" style="margin-top:4px"><span>${L('старт', 'boshlanish')} · ${fmtNum(path[0])}</span><span>${L('сейчас', 'hozir')} · ${fmtNum(u.rating)}</span></div></div>
      <div class="card"><h2 class="h">${L('Последние матчи', 'So‘nggi o‘yinlar')}</h2>
        ${hist.matches.length ? `<div class="list">${hist.matches.slice(0, 10).map((m) => { const w = wonBy(m, id); const d = m.deltas?.[id] || 0; return `<div class="row"><b class="form"><b class="${w ? '' : 'l'}" style="width:32px;height:32px;border-radius:8px">${w ? L('В', 'G') : L('П', 'M')}</b></b><div class="grow"><div class="strong ellipsis">${esc(sideLabel(m, store, m.teamA.includes(id) ? 'B' : 'A'))}</div><div class="muted small">${fmtDate(m.playedAt)} · ${m.type === 'double' ? L('парный', 'juftlik') : L('одиночный', 'yakka')}${m.tournamentId ? ' · ' + L('турнир', 'turnir') : ''}</div></div><div style="text-align:right"><div class="num" style="font-size:16px">${scoreFor(m, id)}</div><div class="small strong" style="color:${d >= 0 ? 'var(--court-2)' : 'var(--bad)'}">${d >= 0 ? '+' : '−'}${Math.abs(d)}</div></div></div>`; }).join('')}</div>`
        : `<div class="empty">${L('Матчей пока нет', 'Hali o‘yin yo‘q')}</div>`}</div>
      <div class="card"><div class="row between"><h2 class="h" style="margin:0">${L('Тренировки', 'Mashg‘ulotlar')}</h2><span class="muted strong">${comma(trainHours)} ${L('ч на корте', 'soat kortda')}</span></div>
        ${hist.trainings.filter((t) => t.playerId === id).slice(0, 5).map((t) => `<div class="kv"><div><div class="strong">${t.coachId ? esc(shortName(store.user(t.coachId))) : L('Самостоятельно', 'Mustaqil')}</div><div class="muted small">${esc(t.skills.join(', '))}</div></div><div class="muted small">${fmtDate(t.playedAt)} · ${comma(t.hours)} ${L('ч', 'soat')}</div></div>`).join('') || `<div class="empty">${L('Тренировок пока нет', 'Hali mashg‘ulot yo‘q')}</div>`}</div>
      ${own ? `<div class="card"><h2 class="h">${L('Настройки', 'Sozlamalar')}</h2>
        <div class="kv"><span>${L('Язык', 'Til')}</span><div class="seg" style="width:180px"><button class="${getLang() === 'ru' ? 'on' : ''}" data-l="ru">RU</button><button class="${getLang() === 'uz' ? 'on' : ''}" data-l="uz">UZ</button></div></div>
        ${store.changePassword ? `<button class="btn ghost block mt" data-pw>${L('Сменить пароль', 'Parolni o‘zgartirish')}</button>` : ''}
        <button class="btn ghost block mt" data-logout>${L('Выйти', 'Chiqish')}</button></div>` : ''}
    </div>`;
  },
  mount(root, params, store) {
    const id = params[0] || store.me().id;
    root.querySelector('[data-challenge]')?.addEventListener('click', () => challengeSheet(store, id));
    root.querySelector('[data-pw]')?.addEventListener('click', () => sheet(`<h2 class="h">${L('Новый пароль', 'Yangi parol')}</h2>
      <form id="cpw"><input id="npw" class="input" type="password" autocomplete="new-password" minlength="6" required placeholder="${L('Минимум 6 символов', 'Kamida 6 belgi')}">
      <div class="grid2 mt"><button type="button" class="btn ghost" data-close>${L('Отмена', 'Bekor')}</button><button class="btn ball" id="cpwSave">${L('Сохранить', 'Saqlash')}</button></div></form>`, (el, close) => {
      el.querySelector('#cpw').addEventListener('submit', (e) => { e.preventDefault(); const pw = el.querySelector('#npw').value;
        if (pw.length < 6) { toast(L('Пароль — минимум 6 символов', 'Parol kamida 6 belgi')); return; }
        act(el.querySelector('#cpwSave'), async () => { await store.changePassword(pw); close(); toast(L('Пароль изменён', 'Parol o‘zgartirildi')); });
      });
    }));
    root.querySelector('[data-complain]')?.addEventListener('click', () => complaintSheet(store, id, null));
    root.querySelectorAll('[data-l]').forEach((b) => b.addEventListener('click', async () => { setLang(b.dataset.l); try { await store.saveProfile({ lang: b.dataset.l }); } catch { /* demo */ } rerender(); }));
    root.querySelector('[data-logout]')?.addEventListener('click', async () => { await store.signOut(); go('#/login'); });
  },
};

// =====================================================================
// Rating
// =====================================================================
const rState = { period: 'quarter', league: null, view: 'players' };
export const rating = {
  async render(_, store) {
    const me = store.me();
    if (rState.league === null) rState.league = me.role === 'player' && me.matches > 0 ? me.league : 'gold';
    const seg = `<div class="seg"><button class="${rState.view === 'players' ? 'on' : ''}" data-view="players">${L('Игроки', 'O‘yinchilar')}</button><button class="${rState.view === 'coaches' ? 'on' : ''}" data-view="coaches">${L('Тренеры', 'Murabbiylar')}</button><button class="${rState.view === 'fair' ? 'on' : ''}" data-view="fair">Fair Play</button></div>`;
    const head = `<div class="pagehead" style="justify-content:space-between"><h1 class="title">${L('Рейтинг', 'Reyting')}</h1><span class="muted strong">${rState.period === 'year' ? L(`${new Date().getFullYear()} год`, `${new Date().getFullYear()} yil`) : seasonLabel()}</span></div>`;
    if (rState.view === 'coaches') {
      const cs = await store.coachRanking();
      return `${head}<div class="wrap">${seg}<div class="card" style="padding:0;overflow:hidden">
        <div class="rt-row head" style="grid-template-columns:30px 1fr 56px 56px"><span>№</span><span>${L('ТРЕНЕР', 'MURABBIY')}</span><span style="text-align:right">${L('УЧЕН.', 'SHOG.')}</span><span style="text-align:right">${L('ЗАНЯТ.', 'MASHG‘.')}</span></div>
        ${cs.map((c, i) => `<a href="#/coach/${c.id}" class="rt-row ${i < 3 ? 'top' : ''}" style="grid-template-columns:30px 1fr 56px 56px;text-decoration:none;color:inherit"><span class="p">${i + 1}</span><span class="row" style="gap:8px;min-width:0">${avatar(c, 'sm')}<span class="grow"><span class="strong ellipsis" style="display:block">${esc(fullName(c))}</span><span class="stars small">★ ${c.stats.avg ? comma(c.stats.avg) : '—'}</span> <span class="muted small">· ${c.stats.reviews.length} ${L('отз.', 'fikr')}</span></span></span><span style="text-align:right" class="strong">${c.stats.students}</span><span style="text-align:right" class="num">${c.stats.trainings}</span></a>`).join('')}
      </div><div class="muted">${L('Рейтинг тренеров: число учеников, занятий и средняя оценка учеников.', 'Murabbiylar reytingi: shogirdlar, mashg‘ulotlar soni va o‘rtacha baho.')}</div></div>`;
    }
    if (rState.view === 'fair') {
      const fp = await store.fairplayRanking();
      return `${head}<div class="wrap">${seg}<div class="card" style="padding:0;overflow:hidden">
        <div class="rt-row head" style="grid-template-columns:30px 1fr 56px"><span>№</span><span>${L('ИГРОК', 'O‘YINCHI')}</span><span style="text-align:right">FAIR PLAY</span></div>
        ${fp.slice(0, 30).map((u, i) => `<a href="#/profile/${u.id}" class="rt-row ${u.id === me.id ? 'top' : ''}" style="grid-template-columns:30px 1fr 56px;text-decoration:none;color:inherit"><span class="p">${i + 1}</span><span class="row" style="gap:8px;min-width:0">${avatar(u, 'sm')}<span class="strong ellipsis">${esc(fullName(u))}${u.role === 'coach' ? ` <span class="tag soft">${L('Тренер', 'Murabbiy')}</span>` : ''}</span></span><span style="text-align:right" class="num">${fpText(u)}</span></a>`).join('')}
      </div><div class="muted">${L('Оценки соперников после матчей: пунктуальность и честный счёт. Ниже 3,5 — нельзя участвовать в турнирах.', 'Raqiblar bahosi: o‘z vaqtida kelish va halol hisob. 3,5 dan past — turnirlarda qatnashib bo‘lmaydi.')}</div></div>`;
    }
    const [list, lead] = await Promise.all([store.ranking({ league: rState.league, period: rState.period }), store.leaders()]);
    const streakN = lead.streak ? lead.streak.form.match(/^В*/)[0].length : 0;
    return `${head}<div class="wrap">${seg}
      <div class="seg"><button class="${rState.period === 'quarter' ? 'on' : ''}" data-period="quarter">${L('Сезон', 'Mavsum')}</button><button class="${rState.period === 'year' ? 'on' : ''}" data-period="year">${L('Год', 'Yil')}</button></div>
      <div class="chips scroll">${LEAGUES.map((l) => `<button class="chip ${rState.league === l.id ? 'on' : ''}" data-league="${l.id}">${L(l.ru, l.uz)}</button>`).join('')}</div>
      <div class="chips scroll" style="gap:8px">
        ${lead.top1 ? `<a href="#/profile/${lead.top1.id}" class="card dark" style="width:150px;flex-shrink:0;text-decoration:none"><div class="small strong" style="color:var(--ball)">${L('ДОЛЬШЕ ВСЕХ В ТОП-1', 'ENG UZOQ TOP-1')}</div><div class="strong mt">${esc(shortName(lead.top1))}</div><div class="num" style="font-size:28px">${lead.top1.top1Days} <span style="font-size:14px;font-weight:500">${L('дн.', 'kun')}</span></div></a>` : ''}
        ${lead.streak ? `<a href="#/profile/${lead.streak.id}" class="card" style="width:150px;flex-shrink:0;text-decoration:none;color:inherit"><div class="small strong muted">${L('ЛУЧШАЯ СЕРИЯ', 'ENG YAXSHI SERIYA')}</div><div class="strong mt">${esc(shortName(lead.streak))}</div><div class="num" style="font-size:28px">${streakN} <span style="font-size:14px;font-weight:500">${L('побед', 'g‘alaba')}</span></div></a>` : ''}
        ${lead.active ? `<a href="#/profile/${lead.active.id}" class="card" style="width:150px;flex-shrink:0;text-decoration:none;color:inherit"><div class="small strong muted">${L('ИГРОК МЕСЯЦА', 'OY O‘YINCHISI')}</div><div class="strong mt">${esc(shortName(lead.active))}</div><div class="num" style="font-size:28px">${lead.activeCount} <span style="font-size:14px;font-weight:500">${L('матч.', 'o‘yin')}</span></div></a>` : ''}
      </div>
      <div class="card" style="padding:0;overflow:hidden">
        <div class="rt-row head"><span>№</span><span>${L('ИГРОК', 'O‘YINCHI')}</span><span style="text-align:right">${L('УС', 'KD')}</span><span style="text-align:right">${L('ОЧКИ', 'OCHKO')}</span></div>
        ${list.length ? list.slice(0, 50).map((u) => `<a href="#/profile/${u.id}" class="rt-row ${u.place <= 3 ? 'top' : ''}" style="text-decoration:none;color:inherit;${u.id === me.id ? 'outline:2px solid var(--ball);outline-offset:-2px' : ''}">
          <span class="p" style="${u.place === 1 ? 'color:#6B7F00' : ''}">${u.place}</span>
          <span class="row" style="gap:8px;min-width:0">${avatar(u, 'sm')}<span class="grow" style="min-width:0"><span class="strong ellipsis" style="display:block">${esc(fullName(u))}</span>
            ${u.top1Days ? `<span class="tag ball" style="text-transform:none;letter-spacing:0">${u.top1Days} ${L('дн. топ-1', 'kun top-1')}</span>` : u.top10Days ? `<span class="tag soft">${u.top10Days} ${L('дн. топ-10', 'kun top-10')}</span>` : ''}${u.role === 'coach' ? ` <span class="tag soft">${L('Тренер', 'Murabbiy')}</span>` : ''}</span></span>
          <span style="text-align:right;font-weight:600">${formatStrength(u.rating)}</span><span style="text-align:right" class="num">${fmtNum(u.points)}</span></a>`).join('')
        : `<div class="empty">${L('В этой лиге пока нет игроков', 'Bu ligada hali o‘yinchi yo‘q')}</div>`}
      </div>
      <div class="muted small">${L('Сезоны: весенний (март–май), летний (июнь–август), осенний (сентябрь–ноябрь), зимний (декабрь–февраль). Очки сезона обнуляются в его первый день, годовые — 1 января. Уровень силы не обнуляется.', 'Mavsumlar: bahorgi (mart–may), yozgi (iyun–avgust), kuzgi (sentabr–noyabr), qishki (dekabr–fevral). Mavsum ochkolari uning birinchi kunida, yillik — 1-yanvarda nollanadi. Kuch darajasi nollanmaydi.')}</div>
    </div>`;
  },
  mount(root) {
    root.querySelectorAll('[data-period]').forEach((b) => b.addEventListener('click', () => { rState.period = b.dataset.period; rerender(); }));
    root.querySelectorAll('[data-league]').forEach((b) => b.addEventListener('click', () => { rState.league = b.dataset.league; rerender(); }));
    root.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => { rState.view = b.dataset.view; rerender(); }));
  },
};

// =====================================================================
// Search
// =====================================================================
const sState = { tab: 'players', league: 'all', gender: 'all', time: 'all', district: 'all', q: '' };
export const search = {
  async render(_, store) {
    const me = store.me();
    const chip = (key, val, label) => `<button class="chip ${sState[key] === val ? 'on' : ''}" data-f="${key}" data-v="${val}">${label}</button>`;
    const tabs = `<div class="seg"><button class="${sState.tab === 'players' ? 'on' : ''}" data-tab="players">${L('Соперники', 'Raqiblar')}</button><button class="${sState.tab === 'coaches' ? 'on' : ''}" data-tab="coaches">${L('Тренеры', 'Murabbiylar')}</button></div>`;
    const qbox = `<input class="input" id="q" placeholder="${L('Поиск по имени', 'Ism bo‘yicha qidirish')}" value="${esc(sState.q)}" aria-label="${L('Поиск по имени', 'Ism bo‘yicha qidirish')}">`;
    if (sState.tab === 'coaches') {
      const cs = await store.coachRanking();
      return `<div class="pagehead"><h1 class="title">${L('Поиск', 'Qidiruv')}</h1></div><div class="wrap">${tabs}${qbox}
        ${cs.map((c) => `<a href="#/coach/${c.id}" class="card" data-name="${esc(fullName(c).toLowerCase())}" style="text-decoration:none;color:inherit"><div class="row">${avatar(c)}<div class="grow"><div class="strong">${esc(fullName(c))} ${c.coach?.verified ? `<span class="tag ok">${L('подтверждён', 'tasdiqlangan')}</span>` : ''}</div><div class="muted">${yearsText(c.coach?.experience || c.years, 'exp')}${c.coach?.specialization?.length ? ' · ' + esc(c.coach.specialization.join(', ')) : ''}</div></div></div>
          <div class="row between mt"><span><span class="stars">★</span> <b>${c.stats.avg ? comma(c.stats.avg) : '—'}</b> <span class="muted">· ${c.stats.students} ${L('учеников', 'shogird')} · ${c.stats.trainings} ${L('занятий', 'mashg‘ulot')}</span></span><span class="strong">${c.coach?.price ? fmtNum(c.coach.price) + ' ' + L('сум/ч', 'so‘m/soat') : ''}</span></div></a>`).join('') }
        <div class="empty" data-none ${cs.length ? 'hidden' : ''}>${L('Тренеры не найдены', 'Murabbiy topilmadi')}</div>
      </div>`;
    }
    const all = (await store.listUsers({ role: 'player' })).filter((u) => u.id !== me.id);
    const list = all.filter((u) => (sState.league === 'all' || u.league === sState.league) && (sState.gender === 'all' || u.gender === sState.gender)
      && (sState.time === 'all' || u.availability.includes(sState.time)) && (sState.district === 'all' || u.district === sState.district))
      .sort((a, b) => Math.abs(a.rating - me.rating) - Math.abs(b.rating - me.rating));
    return `<div class="pagehead"><h1 class="title">${L('Поиск', 'Qidiruv')}</h1></div><div class="wrap">${tabs}${qbox}
      <div class="chips scroll">${chip('league', 'all', L('Все лиги', 'Barcha ligalar'))}${LEAGUES.map((l) => chip('league', l.id, L(l.ru, l.uz))).join('')}</div>
      <div class="chips scroll">${chip('time', 'all', L('Любое время', 'Istalgan vaqt'))}${TIMES.map(([v, ru, uz]) => chip('time', v, L(ru, uz))).join('')}</div>
      <div class="chips scroll">${chip('gender', 'all', L('Все', 'Barchasi'))}${chip('gender', 'м', L('Мужчины', 'Erkaklar'))}${chip('gender', 'ж', L('Женщины', 'Ayollar'))}${chip('district', 'all', L('Все районы', 'Barcha tumanlar'))}${DISTRICTS.map(([v, ru, uz]) => chip('district', v, L(ru, uz))).join('')}</div>
      <div class="muted">${L('Ближе всего к вашему уровню', 'Darajangizga eng yaqin')} · <span data-count>${list.length}</span></div>
      ${list.map((u) => `<article class="card" data-name="${esc(fullName(u).toLowerCase())}"><a href="#/profile/${u.id}" class="row" style="text-decoration:none;color:inherit">${avatar(u)}<div class="grow"><div class="strong">${esc(fullName(u))}</div><div class="muted">${yearsText(u.years)} · ${esc(districtName(u.district))}${u.availability.length ? ' · ' + esc(u.availability.join(', ')) : ''}</div></div>
        <div style="text-align:right"><div class="num" style="font-size:22px;line-height:1">${formatStrength(u.rating)}</div><div class="muted small strong">${leagueName(u.league).toUpperCase()}</div></div></a>
        <div class="row between mt">${formBadges(u.form)}${me.role === 'admin' ? '' : `<button class="btn ball sm" data-challenge="${u.id}">${L('Вызвать', 'Chaqirish')}</button>`}</div></article>`).join('') }
      <div class="empty" data-none ${list.length ? 'hidden' : ''}>${L('Никого не нашли — попробуйте снять фильтры', 'Hech kim topilmadi — filtrlarni olib tashlang')}</div>
    </div>`;
  },
  mount(root, _, store) {
    root.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { sState.tab = b.dataset.tab; rerender(); }));
    root.querySelectorAll('[data-f]').forEach((b) => b.addEventListener('click', () => { sState[b.dataset.f] = b.dataset.v; rerender(); }));
    root.querySelectorAll('[data-challenge]').forEach((b) => b.addEventListener('click', () => challengeSheet(store, b.dataset.challenge)));
    // Name search filters the cards in place: no reload, the keyboard stays open
    const q = root.querySelector('#q');
    const filter = () => {
      sState.q = q.value; const needle = q.value.trim().toLowerCase(); let n = 0;
      root.querySelectorAll('[data-name]').forEach((c) => { const ok = !needle || c.dataset.name.includes(needle); c.hidden = !ok; if (ok) n++; });
      const cnt = root.querySelector('[data-count]'); if (cnt) cnt.textContent = n;
      const none = root.querySelector('[data-none]'); if (none) none.hidden = n > 0;
    };
    q.addEventListener('input', filter);
    if (sState.q) filter();
  },
};

// =====================================================================
// Coach
// =====================================================================
export const coach = {
  async render(params, store) {
    const c = store.user(params[0]); const me = store.me();
    if (!c) return `<div class="wrap"><div class="card">${L('Тренер не найден', 'Murabbiy topilmadi')}</div></div>`;
    const [st, canRev] = await Promise.all([store.coachStats(c.id), store.canReview(c.id)]);
    const own = c.id === me.id; const cc = c.coach || {};
    const myRev = st.reviews.find((r) => r.authorId === me.id);
    return `<div class="hero">
      <div class="topbar">${back('#/search')}<span class="tag ball">${icon.check.replace('width="24" height="24"', 'width="14" height="14"')} ${L('Тренер подтверждён', 'Murabbiy tasdiqlangan')}</span></div>
      <div class="row mt" style="gap:16px">${avatar(c, 'lg')}<div><h1 class="title" style="font-size:26px;text-transform:none">${esc(fullName(c))}</h1>
        <div class="sub">${yearsText(cc.experience || c.years, 'exp')}</div>
        <div class="row" style="gap:6px;margin-top:4px"><span class="stars">${'★'.repeat(Math.round(st.avg || 0))}</span><b>${st.avg ? comma(st.avg) : '—'}</b><span class="sub small">· ${st.reviews.length} ${L('отзывов', 'fikr')}</span></div></div></div>
      <div class="grid3 mt">
        <div class="stat"><div class="num" style="color:var(--ball)">${st.students}</div><div class="sub small">${L('учеников', 'shogird')}</div></div>
        <div class="stat"><div class="num">${st.trainings}</div><div class="sub small">${L('занятий', 'mashg‘ulot')}</div></div>
        <div class="stat"><div class="num">${comma(st.hours)} ${L('ч', 's')}</div><div class="sub small">${L('на корте', 'kortda')}</div></div>
      </div>
      <div class="stat mt row between" style="background:rgba(216,242,68,.12);border:1px solid rgba(216,242,68,.4)"><div class="row" style="gap:8px">${icon.shield.replace('currentColor', '#D8F244')}<span class="strong">Fair Play</span></div><span class="num" style="font-size:24px;color:var(--ball)">${fpText(c)}</span></div>
    </div>
    <div class="wrap">
      <div class="card"><div class="row between"><div><div class="muted small strong">${L('СТОИМОСТЬ', 'NARX')}</div><div class="num" style="font-size:22px">${cc.price ? fmtNum(cc.price) + ' ' + L('сум / час', 'so‘m / soat') : L('по договорённости', 'kelishuv asosida')}</div></div><span class="muted strong">${esc(cc.worksWith || '')}</span></div>
        <div class="chips mt">${(cc.specialization || []).map((s) => `<span class="tag ok" style="text-transform:none;letter-spacing:0;font-size:13px">${esc(s)}</span>`).join('')}</div></div>
      ${own || me.role === 'admin' ? '' : `<div class="grid2"><button class="btn ghost" data-ask>${L('Задать вопрос', 'Savol berish')}</button><a class="btn ball" href="#/add/training?coach=${c.id}">${L('Записать тренировку', 'Mashg‘ulot yozish')}</a></div>`}
      ${canRev && !own ? `<div class="card"><h2 class="h">${myRev ? L('Ваш отзыв', 'Sizning fikringiz') : L('Оставить отзыв', 'Fikr qoldirish')}</h2>
        <div class="starpick" id="sp">${[1, 2, 3, 4, 5].map((n) => `<button data-s="${n}" class="${n <= (myRev?.stars || 5) ? 'on' : ''}" aria-label="${n}">★</button>`).join('')}</div>
        <textarea class="input mt" id="rt" placeholder="${L('Что понравилось, что улучшить', 'Nima yoqdi, nimani yaxshilash kerak')}">${esc(myRev?.text || '')}</textarea>
        <button class="btn block mt" id="sendRev">${L('Отправить отзыв', 'Fikrni yuborish')}</button></div>` : ''}
      <div class="card"><div class="row between"><h2 class="h" style="margin:0">${L('Отзывы учеников', 'Shogirdlar fikri')}</h2><span class="muted small">${L('только после тренировки', 'faqat mashg‘ulotdan keyin')}</span></div>
        ${st.reviews.length ? `<div class="list mt">${st.reviews.map((r) => `<div><div class="row between"><span class="strong">${esc(shortName(store.user(r.authorId)))}</span><span class="strong" style="color:#4C5C00">${comma(r.stars)}</span></div><p style="margin:4px 0 0;line-height:1.45">${esc(r.text)}</p></div>`).join('')}</div>` : `<div class="empty">${L('Пока нет отзывов', 'Hali fikr yo‘q')}</div>`}</div>
    </div>`;
  },
  mount(root, params, store) {
    root.querySelector('[data-ask]')?.addEventListener('click', () => challengeSheet(store, params[0], true));
    let stars = +(root.querySelector('#sp .on:last-of-type')?.dataset.s || 5);
    root.querySelectorAll('#sp [data-s]').forEach((b) => b.addEventListener('click', () => { stars = +b.dataset.s; root.querySelectorAll('#sp [data-s]').forEach((x) => x.classList.toggle('on', +x.dataset.s <= stars)); }));
    root.querySelector('#sendRev')?.addEventListener('click', (e) => act(e.target, async () => {
      await store.addReview(params[0], stars, root.querySelector('#rt').value.trim()); toast(L('Спасибо за отзыв', 'Fikr uchun rahmat')); rerender();
    }));
  },
};

// =====================================================================
// Tournaments
// =====================================================================
const tStatus = (s) => ({ registration: [L('Регистрация', 'Ro‘yxatdan o‘tish'), 'warn'], running: [L('Идёт', 'Davom etmoqda'), 'ball'], finished: [L('Завершён', 'Yakunlangan'), 'ok'] }[s]);
export const tournaments = {
  async render(_, store) {
    const ts = await store.tournaments(); const me = store.me();
    return `<div class="pagehead">${back('#/home', true)}<h1 class="title">${L('Турниры', 'Turnirlar')}</h1></div>
    <div class="wrap"><div class="muted">${L('8 игроков одной лиги, 3 матча у каждого, около 10 дней. Время матчей назначаете сами.', 'Bir ligadan 8 o‘yinchi, har biriga 3 o‘yin, taxminan 10 kun. Vaqtni o‘zingiz belgilaysiz.')}</div>
      ${ts.map((t) => { const [s, c] = tStatus(t.status); const mine = t.entries.find((e) => e.userId === me.id);
        return `<a href="#/tournament/${t.id}" class="card" style="text-decoration:none;color:inherit"><div class="row between"><span class="tag ${c}">${s}</span><span class="muted strong">${L('Лига', 'Liga')} ${leagueName(t.league)}</span></div>
        <div class="num mt" style="font-size:22px;text-transform:uppercase">${esc(t.name)}</div>
        <div class="muted">${fmtDate(t.startsAt)} – ${fmtDate(t.endsAt)} · ${t.entries.filter((e) => e.status === 'approved').length}/8${t.sponsor ? ' · ' + esc(t.sponsor) : ''}</div>
        ${mine ? `<div class="tag ok mt">${mine.status === 'approved' ? L('Вы участвуете', 'Siz ishtirokchisiz') : mine.status === 'pending' ? L('Заявка на рассмотрении', 'Ariza ko‘rib chiqilmoqda') : L('Заявка отклонена', 'Ariza rad etildi')}</div>` : ''}</a>`; }).join('') || `<div class="empty">${L('Турниров пока нет', 'Hali turnir yo‘q')}</div>`}
    </div>`;
  },
};

export const tournament = {
  async render(params, store) {
    const t = await store.tournament(params[0]); const me = store.me();
    if (!t) return `<div class="wrap"><div class="card">${L('Турнир не найден', 'Turnir topilmadi')}</div></div>`;
    const [s, c] = tStatus(t.status);
    const nm = (id) => (id ? esc(shortName(store.user(id))) : '…');
    const b = t.bracket;
    const slot = (x, path, label) => {
      const mine = x.a === me.id || x.b === me.id;
      const canEnter = mine && x.a && x.b && !x.matchId && t.status === 'running';
      return `<div class="bracket-slot ${mine ? 'me' : ''}"><div class="${x.winner && x.winner === x.a ? 'w' : ''}">${nm(x.a)}</div><div class="${x.winner && x.winner === x.b ? 'w' : ''}">${nm(x.b)}</div>
        <div class="muted small">${x.winner ? L('сыгран', 'o‘ynaldi') : x.matchId ? L('ждёт подтверждения', 'tasdiq kutilmoqda') : label}</div>
        ${canEnter ? `<button class="btn ball sm block" style="margin-top:6px" data-enter="${path}">${L('Ввести счёт', 'Hisobni kiritish')}</button>` : ''}</div>`;
    };
    const fp = fairplay(me.fpSum, me.fpCount);
    const entry = t.entries.find((e) => e.userId === me.id);
    const canApply = t.status === 'registration' && !entry && me.role !== 'admin' && me.league === t.league && !(fp !== null && fp < FAIRPLAY_MIN_FOR_TOURNAMENT);
    return `<div class="hero">
      <div class="topbar">${back('#/tournaments')}<span class="tag ${c}">${s}</span></div>
      <div class="sub small strong mt" style="letter-spacing:.05em">${L('ЛИГА', 'LIGA')} ${leagueName(t.league).toUpperCase()} · 8 ${L('ИГРОКОВ', 'O‘YINCHI')}</div>
      <h1 class="title" style="font-size:30px;margin-top:4px">${esc(t.name)}</h1>
      <div class="row mt" style="gap:16px"><span><span class="sub">${L('Сроки', 'Muddat')}</span> <b>${fmtDate(t.startsAt)} – ${fmtDate(t.endsAt)}</b></span>${t.sponsor ? `<span><span class="sub">${L('Спонсор', 'Homiy')}</span> <b>${esc(t.sponsor)}</b></span>` : ''}</div>
    </div>
    <div class="wrap">
      ${canApply ? `<button class="btn ball block" data-apply>${L('Подать заявку', 'Ariza berish')}</button>` : ''}
      ${t.status === 'registration' && !entry && me.league !== t.league && me.role !== 'admin' ? `<div class="muted">${L('Этот турнир для лиги', 'Bu turnir ligasi')} ${leagueName(t.league)}.</div>` : ''}
      ${entry ? `<div class="card"><span class="tag ok">${entry.status === 'approved' ? L('Вы участвуете', 'Siz ishtirokchisiz') : entry.status === 'pending' ? L('Заявка на рассмотрении у администратора', 'Ariza administratorda') : L('Заявка отклонена', 'Ariza rad etildi')}</span></div>` : ''}
      ${b ? `<div class="card"><h2 class="h">${L('Сетка', 'To‘r')}</h2>
        <div class="muted small strong">${L('ЧЕТВЕРТЬФИНАЛ', 'CHORAK FINAL')}</div><div class="grid2 mt">${b.qf.map((x, i) => slot(x, `qf.${i}`, L('не сыгран', 'o‘ynalmagan'))).join('')}</div>
        <div class="muted small strong mt">${L('ПОЛУФИНАЛ', 'YARIM FINAL')}</div><div class="grid2 mt">${b.sf.map((x, i) => slot(x, `sf.${i}`, L('ждёт соперников', 'raqiblar kutilmoqda'))).join('')}</div>
        <div class="muted small strong mt">${L('ФИНАЛ', 'FINAL')}</div><div class="mt">${slot(b.final, 'final', L('ждёт финалистов', 'finalchilar kutilmoqda'))}</div>
        <div class="muted small strong mt">${L('ЗА 5–8 МЕСТА', '5–8 O‘RINLAR UCHUN')}</div><div class="grid2 mt">${b.cons.map((x, i) => slot(x, `cons.${i}`, L('ждёт игроков', 'o‘yinchilar kutilmoqda'))).join('')}</div>
      </div>` : `<div class="card"><h2 class="h">${L('Участники', 'Ishtirokchilar')}</h2>${t.entries.filter((e) => e.status !== 'rejected').map((e) => `<div class="kv"><span class="row" style="gap:8px">${avatar(store.user(e.userId), 'sm')}${esc(fullName(store.user(e.userId)))}</span><span class="tag ${e.status === 'approved' ? 'ok' : 'warn'}">${e.status === 'approved' ? L('утверждён', 'tasdiqlangan') : L('заявка', 'ariza')}</span></div>`).join('') || `<div class="empty">${L('Пока нет заявок', 'Hali ariza yo‘q')}</div>`}</div>`}
      <div class="muted small">${L('Турнирные матчи дают двойные очки. Победитель +100, финалист +60 очков и достижения в профиль.', 'Turnir o‘yinlari ikki baravar ochko beradi. G‘olib +100, finalchi +60 ochko va yutuqlar.')}</div>
    </div>`;
  },
  mount(root, params, store) {
    root.querySelector('[data-apply]')?.addEventListener('click', (e) => act(e.target, async () => { await store.applyTournament(params[0]); toast(L('Заявка отправлена', 'Ariza yuborildi')); rerender(); }));
    root.querySelectorAll('[data-enter]').forEach((btn) => btn.addEventListener('click', () => {
      const p = btn.dataset.enter; const path = p === 'final' ? 'final' : [p.split('.')[0], +p.split('.')[1]];
      sheet(`<h2 class="h">${L('Счёт матча', 'O‘yin hisobi')}</h2><div class="muted">${L('Ваши геймы слева', 'Sizning geymlaringiz chapda')}</div>
        <div class="card dark mt"><div class="score" style="--n:3"><span class="lbl" style="text-align:left"></span><span class="lbl">1</span><span class="lbl">2</span><span class="lbl">3</span>
        <span class="strong">${L('Вы', 'Siz')}</span>${[0, 1, 2].map((i) => `<input class="cell" inputmode="numeric" maxlength="2" data-set="${i}" data-side="a" aria-label="${L('Вы', 'Siz')} ${i + 1}">`).join('')}
        <span class="strong">${L('Соперник', 'Raqib')}</span>${[0, 1, 2].map((i) => `<input class="cell" inputmode="numeric" maxlength="2" data-set="${i}" data-side="b" aria-label="${L('Соперник', 'Raqib')} ${i + 1}">`).join('')}</div></div>
        <div class="grid2 mt"><button class="btn ghost" data-close>${L('Отмена', 'Bekor')}</button><button class="btn ball" id="ok">${L('Отправить', 'Yuborish')}</button></div>`,
      (el, close) => el.querySelector('#ok').addEventListener('click', async () => {
        const sets = readSets(el);
        if (!sets.length || !winnerFromSets(sets)) { toast(L('Введите счёт с победителем', 'G‘olibli hisobni kiriting')); return; }
        try { await store.createTournamentMatch(params[0], path, sets); close(); toast(L('Отправлено сопернику на подтверждение', 'Raqibga yuborildi')); rerender(); } catch (e) { toast(e.message); }
      }));
    }));
  },
};

// =====================================================================
// News
// =====================================================================
const nState = { section: 'all' };
export const news = {
  async render(_, store) {
    const ns = (await store.news()).filter((n) => nState.section === 'all' || n.section === nState.section);
    const sec = (s) => ({ tournaments: L('Турниры', 'Turnirlar'), season: L('Итоги сезона', 'Mavsum yakunlari'), community: L('Сообщество', 'Jamoa') }[s]);
    return `<div class="pagehead">${back('#/home', true)}<h1 class="title">${L('Новости', 'Yangiliklar')}</h1></div>
    <div class="wrap"><div class="chips scroll">${['all', 'tournaments', 'season', 'community'].map((s) => `<button class="chip ${nState.section === s ? 'on' : ''}" data-s="${s}">${s === 'all' ? L('Все', 'Barchasi') : sec(s)}</button>`).join('')}</div>
      ${ns.map((n, i) => `<a href="#/news/${n.id}" class="card" style="padding:0;overflow:hidden;text-decoration:none;color:inherit">
        ${i === 0 ? `<div class="photo-ph">${n.photos[0] ? `<img src="${esc(n.photos[0])}" alt="">` : `${logo(56)}`}</div>` : ''}
        <div style="padding:14px 16px"><span class="tag soft">${sec(n.section)}</span><div class="num mt" style="font-size:${i === 0 ? 22 : 17}px;line-height:1.2">${esc(n.title)}</div>
        <div class="muted mt">${fmtDate(n.createdAt)} · ${n.comments.length} ${L('комм.', 'izoh')}</div></div></a>`).join('') || `<div class="empty">${L('Новостей пока нет', 'Hali yangilik yo‘q')}</div>`}
    </div>`;
  },
  mount(root) { root.querySelectorAll('[data-s]').forEach((b) => b.addEventListener('click', () => { nState.section = b.dataset.s; rerender(); })); },
};

export const newsItem = {
  async render(params, store) {
    const n = await store.newsItem(params[0]); const me = store.me();
    if (!n) return `<div class="wrap"><div class="card">${L('Новость не найдена', 'Yangilik topilmadi')}</div></div>`;
    return `<div class="pagehead">${back('#/news', true)}<h1 class="title" style="font-size:20px">${L('Новости', 'Yangiliklar')}</h1></div>
    <div class="wrap"><article class="card" style="padding:0;overflow:hidden">
      ${n.photos.length ? n.photos.map((p) => `<div class="photo-ph"><img src="${esc(p)}" alt=""></div>`).join('') : ''}
      <div style="padding:16px"><div class="muted">${fmtDate(n.createdAt)}</div><h2 class="num" style="font-size:24px;margin:6px 0 10px;line-height:1.15">${esc(n.title)}</h2>
      <div style="line-height:1.55;white-space:pre-line">${esc(n.body)}</div></div></article>
      <div class="card"><h2 class="h">${L('Комментарии', 'Izohlar')}</h2>
        ${n.comments.map((c) => `<div class="row" style="align-items:flex-start;padding:8px 0">${avatar(store.user(c.userId), 'sm')}<div class="grow"><div class="strong small">${esc(shortName(store.user(c.userId)))} <span class="muted">· ${fmtDate(c.createdAt)}</span></div><div>${esc(c.text)}</div></div>${me.role === 'admin' || c.userId === me.id ? `<button class="chip" data-del="${c.id}" aria-label="${L('Удалить', 'O‘chirish')}">×</button>` : ''}</div>`).join('') || `<div class="muted">${L('Будьте первым', 'Birinchi bo‘ling')}</div>`}
        <form id="cf" class="row mt"><input class="input grow" id="ct" placeholder="${L('Ваш комментарий', 'Izohingiz')}" maxlength="1000"><button class="btn sm">${L('Отпр.', 'Yub.')}</button></form></div>
    </div>`;
  },
  mount(root, params, store) {
    root.querySelector('#cf').addEventListener('submit', async (e) => {
      e.preventDefault(); const t = root.querySelector('#ct').value.trim(); if (!t) return;
      if (banned(store.me())) { toast(L('Аккаунт временно ограничен', 'Akkaunt vaqtincha cheklangan')); return; }
      await store.addComment(params[0], t); rerender();
    });
    root.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => { await store.hideComment(params[0], b.dataset.del); rerender(); }));
  },
};

// =====================================================================
// Admin
// =====================================================================
export const admin = {
  async render(params, store) {
    const tab = params[0] || 'overview';
    const tabs = [['overview', L('Обзор', 'Umumiy')], ['complaints', L('Жалобы', 'Shikoyatlar')], ['tournaments', L('Турниры', 'Turnirlar')], ['coaches', L('Заявки тренеров', 'Murabbiy arizalari')], ['news', L('Новости', 'Yangiliklar')], ['users', L('Люди', 'Odamlar')]];
    const head = `<div class="hero"><div class="topbar"><span class="brand">${logo(30)} ${L('Админ', 'Admin')}</span><button class="iconbtn" data-logout aria-label="${L('Выйти', 'Chiqish')}">${icon.close}</button></div></div>
      <div class="wrap" style="padding-bottom:0"><div class="chips scroll">${tabs.map(([k, l]) => `<a class="chip ${(tab === k || (k === 'users' && tab === 'coachlist')) ? 'on' : ''}" style="display:inline-flex;align-items:center;text-decoration:none;${(tab === k || (k === 'users' && tab === 'coachlist')) ? '' : 'color:inherit'}" href="#/admin/${k}">${l}</a>`).join('')}</div></div>`;
    let body = '';
    if (tab === 'overview') {
      const [s, cs, ds, crs] = await Promise.all([store.stats(), store.complaints(), store.disputes(), store.coachRequests ? store.coachRequests() : []]);
      const newReq = crs.filter((r) => r.status === 'new').length;
      body = `<div class="grid2">${[[s.users, L('игроков', 'o‘yinchi')], [s.coaches, L('тренеров', 'murabbiy')], [s.matchesWeek, L('матчей за неделю', 'haftalik o‘yin')], [s.trainingsWeek, L('тренировок за неделю', 'haftalik mashg‘ulot')], [s.activePlayers, L('активных за 30 дней', '30 kunda faol')], [cs.filter((c) => c.status === 'open').length + ds.length, L('ждут решения', 'qaror kutmoqda')], [newReq, L('заявок тренеров', 'murabbiy arizasi')]].map(([n, l], i) => `<a class="card" href="${['#/admin/users', '#/admin/coachlist', '', '', '', '#/admin/complaints', '#/admin/coaches'][i] || '#/admin'}" style="text-decoration:none;color:inherit"><div class="num" style="font-size:30px">${n}</div><div class="muted">${l}${[0, 1, 5, 6].includes(i) ? ' →' : ''}</div></a>`).join('')}</div>`;
    }
    if (tab === 'complaints') {
      const cs = await store.complaints(); const ds = await store.disputes();
      body = `<div class="card"><h2 class="h">${L('Оспоренные счета', 'E’tiroz bildirilgan hisoblar')}</h2>${ds.map((m) => `<div style="padding:10px 0;border-top:1px solid #E8EDE3"><div class="strong">${esc(sideLabel(m, store, 'A'))} — ${esc(sideLabel(m, store, 'B'))}</div><div class="muted">${formatSets(m.sets)} · ${fmtDate(m.playedAt)}</div><div class="mt">«${esc(m.disputeReason || '')}»</div><div class="grid2 mt"><button class="btn sm" data-disp="${m.id}:1">${L('Засчитать счёт', 'Hisobni qabul qilish')}</button><button class="btn ghost sm" data-disp="${m.id}:0">${L('Отменить матч', 'O‘yinni bekor qilish')}</button></div></div>`).join('') || `<div class="muted">${L('Нет споров', 'Nizo yo‘q')}</div>`}</div>
        <div class="card"><h2 class="h">${L('Жалобы', 'Shikoyatlar')}</h2>${cs.map((c) => `<div style="padding:10px 0;border-top:1px solid #E8EDE3"><div class="row between"><span class="strong">${esc(shortName(store.user(c.authorId)))} → ${esc(shortName(store.user(c.targetId)))}</span><span class="tag ${c.status === 'open' ? 'warn' : c.status === 'accepted' ? 'bad' : 'ok'}">${c.status === 'open' ? L('новая', 'yangi') : c.status === 'accepted' ? L('принята', 'qabul') : L('отклонена', 'rad')}</span></div><div class="muted">${esc(c.reason)} · ${fmtDate(c.createdAt)}</div>${c.status === 'open' ? `<div class="grid2 mt"><button class="btn danger sm" data-cmp="${c.id}:1">${L('Принять', 'Qabul')}</button><button class="btn ghost sm" data-cmp="${c.id}:0">${L('Отклонить', 'Rad')}</button></div>` : ''}</div>`).join('') || `<div class="muted">${L('Жалоб нет', 'Shikoyat yo‘q')}</div>`}
        <div class="muted small mt">${L('Принятая жалоба = оценка Fair Play 1★. 2 за месяц — бан 7 дней, 4 — 30 дней.', 'Qabul qilingan shikoyat = Fair Play 1★. Oyiga 2 ta — 7 kun, 4 ta — 30 kun blok.')}</div></div>`;
    }
    if (tab === 'coaches') {
      const rs = await store.coachRequests();
      const st = { new: [L('новая', 'yangi'), 'warn'], approved: [L('одобрена', 'tasdiqlandi'), 'ok'], rejected: [L('отклонена', 'rad etildi'), 'bad'] };
      body = `<div class="muted">${L('Позвоните тренеру и после разговора нажмите «Одобрить». Тренер регистрируется по почте и указывает в анкете этот номер — роль тренера включится сама.', 'Murabbiyga qo‘ng‘iroq qiling va «Tasdiqlash»ni bosing. Murabbiy anketada shu raqamni kiritsa, murabbiy roli o‘zi yoqiladi.')}</div>
        ${rs.map((r) => `<div class="card"><div class="row between"><span class="strong">${esc(r.firstName)} ${esc(r.lastName)}</span><span class="tag ${st[r.status][1]}">${st[r.status][0]}</span></div>
          <div class="muted">${yearsText(r.experience, 'exp')} · ${fmtDate(r.createdAt, true)}</div>
          ${r.about ? `<div class="mt">${esc(r.about)}</div>` : ''}
          <a class="btn ghost sm" href="tel:+${esc(String(r.phone).replace(/\D/g, ''))}" style="width:100%;margin-top:10px">📞 ${esc(fmtPhone(String(r.phone).replace(/\D/g, '')))}</a>
          ${r.status === 'new' ? `<div class="grid2 mt"><button class="btn sm" data-creq="${r.id}:1">${L('Одобрить', 'Tasdiqlash')}</button><button class="btn ghost sm" data-creq="${r.id}:0">${L('Отклонить', 'Rad etish')}</button></div>` : ''}</div>`).join('') || `<div class="card"><div class="muted">${L('Заявок пока нет', 'Hozircha ariza yo‘q')}</div></div>`}`;
    }
    if (tab === 'tournaments') {
      const ts = await store.tournaments();
      body = `<form class="card" id="tnew"><h2 class="h">${L('Новый турнир', 'Yangi turnir')}</h2>
        <label class="f" for="tn">${L('Название', 'Nomi')}</label><input class="input" id="tn" required>
        <div class="grid2"><div><label class="f" for="tl">${L('Лига', 'Liga')}</label><select class="input" id="tl">${LEAGUES.map((l) => `<option value="${l.id}">${L(l.ru, l.uz)}</option>`).join('')}</select></div><div><label class="f" for="ts">${L('Спонсор', 'Homiy')}</label><input class="input" id="ts"></div></div>
        <div class="grid2"><div><label class="f" for="t1">${L('Начало', 'Boshlanish')}</label><input class="input" type="date" id="t1" required></div><div><label class="f" for="t2">${L('Конец', 'Tugash')}</label><input class="input" type="date" id="t2" required></div></div>
        <button class="btn ball block mt">${L('Создать', 'Yaratish')}</button></form>
        ${ts.map((t) => `<div class="card"><div class="row between"><span class="strong">${esc(t.name)}</span><span class="tag ${tStatus(t.status)[1]}">${tStatus(t.status)[0]}</span></div><div class="muted">${leagueName(t.league)} · ${t.entries.filter((e) => e.status === 'approved').length}/8</div>
          ${t.status === 'registration' ? `${t.entries.map((e) => `<div class="kv"><span>${esc(fullName(store.user(e.userId)))}</span>${e.status === 'pending' ? `<span class="row" style="gap:6px"><button class="btn sm" data-ent="${t.id}:${e.userId}:1">✓</button><button class="btn ghost sm" data-ent="${t.id}:${e.userId}:0">✕</button></span>` : `<span class="tag ${e.status === 'approved' ? 'ok' : 'bad'}">${e.status === 'approved' ? L('утв.', 'tasd.') : L('откл.', 'rad')}</span>`}</div>`).join('')}
          <button class="btn block mt" data-start="${t.id}">${L('Запустить турнир (сетка)', 'Turnirni boshlash')}</button>` : `<a class="btn ghost block mt" href="#/tournament/${t.id}">${L('Открыть сетку', 'To‘rni ochish')}</a>`}</div>`).join('')}`;
    }
    if (tab === 'news') {
      body = `<form class="card" id="nnew"><h2 class="h">${L('Опубликовать новость', 'Yangilik e’lon qilish')}</h2>
        <label class="f" for="nt">${L('Заголовок', 'Sarlavha')}</label><input class="input" id="nt" required>
        <label class="f" for="ns">${L('Раздел', 'Bo‘lim')}</label><select class="input" id="ns"><option value="tournaments">${L('Турниры', 'Turnirlar')}</option><option value="season">${L('Итоги сезона', 'Mavsum yakunlari')}</option><option value="community">${L('Сообщество', 'Jamoa')}</option></select>
        <label class="f" for="nb">${L('Текст', 'Matn')}</label><textarea class="input" id="nb" rows="6" required></textarea>
        <label class="f" for="np">${L('Фото (до 20)', 'Rasmlar (20 tagacha)')}</label><input type="file" id="np" accept="image/*" multiple>
        <button class="btn ball block mt">${L('Опубликовать', 'E’lon qilish')}</button></form>`;
    }
    if (tab === 'users' || tab === 'coachlist') {
      const coachesOnly = tab === 'coachlist';
      const [players, coachesAll, contacts] = await Promise.all([store.listUsers({ role: 'player' }), store.listUsers({ role: 'coach' }), store.adminContacts ? store.adminContacts().catch(() => ({})) : {}]);
      const us = (coachesOnly ? coachesAll : players).sort((a, b) => fullName(a).localeCompare(fullName(b)));
      const contact = (u) => { const c = contacts[u.id] || {}; const ph = String(c.phone || u.phone || '').replace(/\D/g, '');
        return `<div class="muted small" style="margin:2px 0 0 40px">${ph ? `<a href="tel:+${esc(ph)}">${esc(fmtPhone(ph))}</a>` : ''}${ph && c.email ? ' · ' : ''}${c.email ? esc(c.email) : ''}</div>`; };
      const list = `<div class="seg"><a class="${coachesOnly ? '' : 'on'}" href="#/admin/users" style="display:flex;align-items:center;justify-content:center;text-decoration:none;color:inherit;font-weight:800;border-radius:11px;height:42px;${coachesOnly ? '' : 'background:var(--card)'}">${L('Игроки', 'O‘yinchilar')} · ${players.length}</a><a class="${coachesOnly ? 'on' : ''}" href="#/admin/coachlist" style="display:flex;align-items:center;justify-content:center;text-decoration:none;color:inherit;font-weight:800;border-radius:11px;height:42px;${coachesOnly ? 'background:var(--card)' : ''}">${L('Тренеры', 'Murabbiylar')} · ${coachesAll.length}</a></div>
        <div class="card">${us.map((u) => `<div style="padding:8px 0;border-top:1px solid #E8EDE3"><div class="kv" style="min-height:40px"><a href="#/${u.role === 'coach' ? 'coach' : 'profile'}/${u.id}" class="row" style="gap:8px;min-width:0;text-decoration:none;color:inherit">${avatar(u, 'sm')}<span class="ellipsis">${esc(fullName(u))}${banned(u) ? ` <span class="tag bad">${L('бан до', 'blok')} ${fmtDate(u.bannedUntil)}</span>` : ''}</span></a>${banned(u) ? `<button class="btn ghost sm" data-ban="${u.id}:0">${L('Снять', 'Olib tashlash')}</button>` : `<button class="btn danger sm" data-ban="${u.id}:7">${L('Бан 7 дн.', 'Blok 7 kun')}</button>`}</div>${contact(u)}</div>`).join('') || `<div class="muted">${L('Пока никого нет', 'Hozircha hech kim yo‘q')}</div>`}</div>`;
      body = `<form class="card" id="inv"><h2 class="h">${L('Пригласить тренера', 'Murabbiyni taklif qilish')}</h2><div class="muted">${L('После личной встречи. Тренер войдёт по этому номеру и сразу получит роль тренера.', 'Shaxsiy uchrashuvdan so‘ng. Murabbiy shu raqam bilan kiradi.')}</div>
        <div class="grid2"><div><label class="f" for="if">${L('Имя', 'Ism')}</label><input class="input" id="if" required></div><div><label class="f" for="il">${L('Фамилия', 'Familiya')}</label><input class="input" id="il" required></div></div>
        <label class="f" for="ip">${L('Телефон', 'Telefon')}</label><input class="input" id="ip" type="tel" value="+998" required><button class="btn ball block mt">${L('Пригласить', 'Taklif qilish')}</button></form>
        ${list}`;
    }
    return `${head}<div class="wrap">${body}</div>`;
  },
  mount(root, params, store) {
    root.querySelector('[data-logout]')?.addEventListener('click', async () => { await store.signOut(); go('#/login'); });
    root.querySelectorAll('[data-disp]').forEach((b) => b.addEventListener('click', () => act(b, async () => { const [id, k] = b.dataset.disp.split(':'); await store.resolveDispute(id, k === '1'); rerender(); })));
    root.querySelectorAll('[data-cmp]').forEach((b) => b.addEventListener('click', () => act(b, async () => { const [id, k] = b.dataset.cmp.split(':'); await store.resolveComplaint(id, k === '1'); rerender(); })));
    root.querySelectorAll('[data-ent]').forEach((b) => b.addEventListener('click', () => act(b, async () => { const [t, u, k] = b.dataset.ent.split(':'); await store.approveEntry(t, u, k === '1'); rerender(); })));
    root.querySelectorAll('[data-start]').forEach((b) => b.addEventListener('click', () => act(b, async () => { await store.startTournament(b.dataset.start); toast(L('Сетка создана', 'To‘r yaratildi')); rerender(); })));
    root.querySelectorAll('[data-creq]').forEach((b) => b.addEventListener('click', () => act(b, async () => {
      const [id, k] = b.dataset.creq.split(':'); await store.resolveCoachRequest(id, k === '1');
      toast(k === '1' ? L('Одобрено. Тренер получит роль после регистрации с этим номером', 'Tasdiqlandi') : L('Заявка отклонена', 'Ariza rad etildi')); rerender();
    })));
    root.querySelectorAll('[data-ban]').forEach((b) => b.addEventListener('click', () => act(b, async () => { const [u, d] = b.dataset.ban.split(':'); await store.setBan(u, +d); rerender(); })));
    root.querySelector('#tnew')?.addEventListener('submit', (e) => { e.preventDefault(); act(e.submitter, async () => {
      const v = (id) => root.querySelector('#' + id).value;
      await store.createTournament({ name: v('tn'), league: v('tl'), sponsor: v('ts'), startsAt: new Date(v('t1')).toISOString(), endsAt: new Date(v('t2')).toISOString() });
      toast(L('Турнир создан, заявки открыты', 'Turnir yaratildi')); rerender();
    }); });
    root.querySelector('#nnew')?.addEventListener('submit', (e) => { e.preventDefault(); act(e.submitter, async () => {
      const files = [...root.querySelector('#np').files].slice(0, 20);
      const photos = [];
      for (const f of files) {
        const data = await resizeImage(f, 1280);
        if (store.uploadPhoto) { const blob = await (await fetch(data)).blob(); photos.push(await store.uploadPhoto(new File([blob], 'n.jpg', { type: 'image/jpeg' }))); }
        else photos.push(data);
      }
      await store.addNews({ title: root.querySelector('#nt').value, section: root.querySelector('#ns').value, body: root.querySelector('#nb').value, photos });
      toast(L('Опубликовано', 'E’lon qilindi')); go('#/news');
    }); });
    root.querySelector('#inv')?.addEventListener('submit', (e) => { e.preventDefault(); act(e.submitter, async () => {
      await store.inviteCoach({ firstName: root.querySelector('#if').value, lastName: root.querySelector('#il').value, phone: root.querySelector('#ip').value.replace(/[^\d+]/g, '') });
      toast(L('Тренер приглашён', 'Murabbiy taklif qilindi')); rerender();
    }); });
  },
};
