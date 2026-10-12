// Ace Tennis — Telegram bot (webhook). Confirms the user's phone and prepares the login.
//
// Secrets (Supabase → Edge Functions → Secrets):
//   TELEGRAM_BOT_TOKEN       — from @BotFather
//   TELEGRAM_WEBHOOK_SECRET  — any long random string you make up (letters and digits)
//   APP_URL                  — e.g. https://ace-tennis-rust.vercel.app
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase automatically.
//
// One-time setup after deploy: open in a browser
//   https://<project>.supabase.co/functions/v1/telegram-bot?setup=<TELEGRAM_WEBHOOK_SECRET>
import { createClient } from 'jsr:@supabase/supabase-js@2';

const TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') ?? '';
const SECRET = Deno.env.get('TELEGRAM_WEBHOOK_SECRET') ?? '';
const APP_URL = Deno.env.get('APP_URL') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const sb = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { persistSession: false } });

const tg = (method: string, body: unknown) =>
  fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }).then((r) => r.json());

const say = (chat_id: number, text: string, extra: Record<string, unknown> = {}) =>
  tg('sendMessage', { chat_id, text, parse_mode: 'HTML', ...extra });

const appButton = () => (APP_URL ? { reply_markup: { inline_keyboard: [[{ text: '🎾 Открыть Ace Tennis', url: APP_URL }]] } } : {});

async function handle(update: any) {
  const msg = update.message;
  if (!msg?.from || msg.chat?.type !== 'private') return;
  const chatId = msg.chat.id as number;

  // 1) /start <nonce> from the app's "Войти через Telegram" button
  if (typeof msg.text === 'string' && msg.text.startsWith('/start')) {
    const nonce = msg.text.split(' ')[1] ?? '';
    if (!/^[a-f0-9]{32}$/.test(nonce)) {
      await say(chatId, 'Ассалому алайкум! Это бот <b>Ace Tennis</b>.\nЧтобы войти, откройте приложение и нажмите «Войти через Telegram».\n\nIlovani oching va «Telegram orqali kirish» tugmasini bosing.', appButton());
      return;
    }
    const { data: existing } = await sb.from('tg_logins').select('status').eq('nonce', nonce).maybeSingle();
    if (existing && existing.status !== 'started') { await say(chatId, 'Эта ссылка уже использована. Нажмите «Войти через Telegram» в приложении ещё раз.'); return; }
    await sb.from('tg_logins').upsert({ nonce, tg_user_id: msg.from.id, chat_id: chatId, status: 'started', created_at: new Date().toISOString() });
    await say(chatId,
      'Чтобы войти в <b>Ace Tennis</b>, нажмите кнопку ниже и поделитесь своим номером телефона.\n\nKirish uchun pastdagi tugmani bosing va telefon raqamingizni yuboring.',
      { reply_markup: { keyboard: [[{ text: '📱 Поделиться номером / Raqamni yuborish', request_contact: true }]], resize_keyboard: true, one_time_keyboard: true } });
    return;
  }

  // 2) The user shared a contact
  if (msg.contact) {
    if (msg.contact.user_id !== msg.from.id) { await say(chatId, 'Пожалуйста, отправьте <b>свой</b> номер кнопкой ниже.'); return; }
    const phone = String(msg.contact.phone_number).replace(/\D/g, '');
    if (!/^998\d{9}$/.test(phone)) { await say(chatId, 'Пока Ace Tennis работает только с номерами Узбекистана (+998).', { reply_markup: { remove_keyboard: true } }); return; }

    const since = new Date(Date.now() - 15 * 60e3).toISOString();
    const { data: login } = await sb.from('tg_logins').select('*').eq('tg_user_id', msg.from.id).eq('status', 'started')
      .gte('created_at', since).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (!login) { await say(chatId, 'Откройте приложение и нажмите «Войти через Telegram», потом вернитесь сюда.', { reply_markup: { remove_keyboard: true }, ...appButton() }); return; }

    const email = `${phone}@tg.ace-tennis.uz`; // technical login address, never receives mail
    let userId: string | null = (await sb.rpc('tg_find_user', { p_phone: phone })).data ?? null;
    if (!userId) {
      const { data, error } = await sb.auth.admin.createUser({ phone, phone_confirm: true, email, email_confirm: true });
      if (error) throw error;
      userId = data.user.id;
    } else {
      const { data } = await sb.auth.admin.getUserById(userId);
      if (data.user && data.user.email !== email) await sb.auth.admin.updateUserById(userId, { email, email_confirm: true });
    }

    const { data: prof } = await sb.from('profiles').select('first_name,last_name').eq('id', userId).maybeSingle();
    await sb.from('profiles').update({
      tg_chat_id: chatId, tg_username: msg.from.username ?? null,
      ...(prof && !prof.first_name ? { first_name: msg.from.first_name ?? '', last_name: msg.from.last_name ?? '' } : {}),
    }).eq('id', userId);

    await sb.from('tg_logins').update({ status: 'ready', user_id: userId, email }).eq('nonce', login.nonce);
    await say(chatId, '✅ Готово! Вернитесь в приложение — вход выполнен.\n\nTayyor! Ilovaga qayting.', { reply_markup: { remove_keyboard: true } });
    if (APP_URL) await say(chatId, 'Ace Tennis', appButton());
    return;
  }

  await say(chatId, 'Чтобы войти, нажмите «Войти через Telegram» в приложении.', appButton());
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  if (req.method === 'GET') {
    if (!SECRET || url.searchParams.get('setup') !== SECRET) return new Response('Not found', { status: 404 });
    const hook = `${SUPABASE_URL}/functions/v1/telegram-bot`;
    const res = await tg('setWebhook', { url: hook, secret_token: SECRET, allowed_updates: ['message'], drop_pending_updates: true });
    return Response.json({ webhook: hook, telegram: res });
  }
  if (req.headers.get('x-telegram-bot-api-secret-token') !== SECRET) return new Response('Forbidden', { status: 403 });
  try { await handle(await req.json()); } catch (e) { console.error(e); }
  return new Response('ok'); // always 200, otherwise Telegram keeps retrying
});
