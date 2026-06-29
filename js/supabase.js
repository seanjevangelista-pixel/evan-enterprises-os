import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL  = window.ENV?.SUPABASE_URL  || '';
const SUPABASE_ANON = window.ENV?.SUPABASE_ANON || '';

if (!SUPABASE_URL || !SUPABASE_ANON) {
  console.warn('[EE] Supabase credentials not set. Add them to env.js.');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);
