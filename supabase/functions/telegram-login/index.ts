// Ace Tennis — the app asks "has the user confirmed in Telegram?" and gets a one-time sign-in token.
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase automatically.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const sb = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { persistSession: false } });
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const { nonce } = await req.json();
    if (typeof nonce !== 'string' || !/^[a-f0-9]{32}$/.test(nonce)) return json({ status: 'invalid' }, 400);
    const { data: row } = await sb.from('tg_logins').select('*').eq('nonce', nonce).maybeSingle();
    if (!row) return json({ status: 'waiting' });
    if (Date.now() - new Date(row.created_at).getTime() > 15 * 60e3) return json({ status: 'expired' });
    if (row.status === 'started') return json({ status: 'waiting' });
    if (row.status === 'used') return json({ status: 'used' });
    // Ready: mark used first so the token can be handed out only once
    const { data: claimed } = await sb.from('tg_logins').update({ status: 'used' }).eq('nonce', nonce).eq('status', 'ready').select('email').maybeSingle();
    if (!claimed) return json({ status: 'used' });
    const { data, error } = await sb.auth.admin.generateLink({ type: 'magiclink', email: claimed.email });
    if (error) throw error;
    return json({ status: 'ready', token_hash: data.properties.hashed_token });
  } catch (e) {
    console.error(e);
    return json({ status: 'error', message: (e as Error).message }, 500);
  }
});
