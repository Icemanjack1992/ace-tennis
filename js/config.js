// Ace Tennis — connection settings.
// Empty values = demo mode (test data in the browser).
// To go live: paste Project URL and the "anon public" key from Supabase → Project Settings → API.
// The anon key is designed to be public; access is protected by Row Level Security in supabase/schema.sql.
window.ACE_CONFIG = {
  supabaseUrl: 'https://tldygntpphyfigxoinvl.supabase.co',
  supabaseKey: 'sb_publishable_alZy4qvPhttPXcqLBpzEJg_FFT8nqba',
  // Telegram bot username without @ (login through the bot). Empty = no Telegram button.
  telegramBot: '',  // Telegram login switched off (was 'AceTennisUzBot')
  // Registration and login by e-mail + password
  emailLogin: true,
  // true = also show login by SMS code (needs the Eskiz SMS hook)
  smsLogin: false,
  // Contact e-mail shown in the user agreement (оферта)
  contactEmail: 'dadabaev.azizbek@gmail.com',
};
