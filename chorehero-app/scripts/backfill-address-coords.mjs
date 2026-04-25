/**
 * One-off: fill addresses.latitude / addresses.longitude for rows that are null.
 * Uses OpenStreetMap Nominatim (no API key; be polite: 1 request/sec).
 *
 * Usage (from chorehero-app/):
 *   npm run backfill:address-coords
 * (reads .env for EXPO_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY), or:
 *   SUPABASE_URL="https://xxx.supabase.co" SUPABASE_SERVICE_ROLE_KEY="..." node scripts/backfill-address-coords.mjs
 *
 * Optional: LIMIT=50 (default 200) to cap how many rows to process.
 */
import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadDotEnv() {
  const p = join(__dirname, '..', '.env');
  if (!existsSync(p)) return;
  const raw = readFileSync(p, 'utf8');
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq <= 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (process.env[k] === undefined) process.env[k] = v;
  }
}

loadDotEnv();
if (!process.env.SUPABASE_URL && process.env.EXPO_PUBLIC_SUPABASE_URL) {
  process.env.SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
}

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, key);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const USER_AGENT = 'ChoreHero/1.0 (https://github.com/chorehero; address backfill)';

async function nominatimQuery(q) {
  const u = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`;
  const res = await fetch(u, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  });
  if (!res.ok) return null;
  const j = await res.json();
  if (j?.[0]?.lat != null && j?.[0]?.lon != null) {
    return { latitude: parseFloat(j[0].lat), longitude: parseFloat(j[0].lon) };
  }
  return null;
}

async function main() {
  const cap = Math.min(Math.max(1, parseInt(process.env.LIMIT || '200', 10)), 2000);

  const { data: rows, error } = await supabase
    .from('addresses')
    .select('id, street, city, state, zip_code, country')
    .is('latitude', null)
    .is('longitude', null)
    .limit(5000);

  if (error) {
    console.error(error);
    process.exit(1);
  }

  const need = (rows || []).filter((r) => r.street && (r.city || r.zip_code));
  const batch = need.slice(0, cap);
  console.log('Candidates (both coords null, has street + city or zip):', need.length, '— processing', batch.length);

  let ok = 0;
  let fail = 0;

  for (const r of batch) {
    const q = [r.street, r.city, r.state, r.zip_code, r.country || 'US'].filter(Boolean).join(', ');
    const g = await nominatimQuery(q);
    if (g && Number.isFinite(g.latitude) && Number.isFinite(g.longitude)) {
      const { error: uerr } = await supabase
        .from('addresses')
        .update({ latitude: g.latitude, longitude: g.longitude, updated_at: new Date().toISOString() })
        .eq('id', r.id);
      if (uerr) {
        console.warn('Update failed', r.id, uerr.message);
        fail++;
      } else {
        ok++;
        if (ok % 20 === 0) console.log('Updated', ok, '...');
      }
    } else {
      fail++;
    }
    await sleep(1100);
  }

  console.log('Done. Geocoded:', ok, 'not found or failed:', fail);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
