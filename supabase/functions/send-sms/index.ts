// Ace Tennis — Supabase "Send SMS" auth hook → Eskiz.uz
// Supabase generates the login code, this function delivers it through Eskiz.
//
// Secrets (Supabase → Edge Functions → Secrets):
//   SEND_SMS_HOOK_SECRET  — from Authentication → Hooks → Send SMS (starts with v1,whsec_)
//   ESKIZ_EMAIL           — Eskiz account e-mail
//   ESKIZ_PASSWORD        — Eskiz API password (my.eskiz.uz → API)
//   ESKIZ_FROM            — approved sender name, or 4546 while it is not approved
//   ESKIZ_TEMPLATE        — SMS text exactly as approved by Eskiz, with {code} where the code goes
import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0';

const API = 'https://notify.eskiz.uz/api';
let token: string | null = null;

async function login(): Promise<string> {
  const form = new FormData();
  form.append('email', Deno.env.get('ESKIZ_EMAIL') ?? '');
  form.append('password', Deno.env.get('ESKIZ_PASSWORD') ?? '');
  const res = await fetch(`${API}/auth/login`, { method: 'POST', body: form });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.data?.token) throw new Error(`Eskiz login failed (${res.status})`);
  token = json.data.token as string;
  return token;
}

async function sendSms(phone: string, text: string, retry = true): Promise<void> {
  const form = new FormData();
  form.append('mobile_phone', phone);
  form.append('message', text);
  form.append('from', Deno.env.get('ESKIZ_FROM') || '4546');
  const res = await fetch(`${API}/message/sms/send`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token ?? (await login())}` },
    body: form,
  });
  if (res.status === 401 && retry) { token = null; return sendSms(phone, text, false); }
  if (!res.ok) throw new Error(`Eskiz send failed (${res.status}): ${await res.text()}`);
}

Deno.serve(async (req) => {
  const payload = await req.text();
  try {
    const secret = (Deno.env.get('SEND_SMS_HOOK_SECRET') ?? '').replace('v1,whsec_', '');
    const { user, sms } = new Webhook(secret).verify(payload, Object.fromEntries(req.headers)) as {
      user: { phone: string }; sms: { otp: string };
    };
    const phone = user.phone.replace(/\D/g, ''); // Eskiz expects 998XXXXXXXXX
    if (!/^998\d{9}$/.test(phone)) throw new Error('Only Uzbekistan numbers (+998) are supported');
    const template = Deno.env.get('ESKIZ_TEMPLATE') || 'Ace Tennis: kod dlya vhoda {code}';
    await sendSms(phone, template.replace('{code}', sms.otp));
    return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: { http_code: 500, message: `SMS не отправлено: ${(e as Error).message}` } }),
      { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});
