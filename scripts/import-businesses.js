#!/usr/bin/env node
/**
 * Queue OS — Business Importer
 * ─────────────────────────────────────────────────────────────
 * Reusable CSV / Excel (.xlsx) importer for seeding businesses
 * into the Supabase database as unclaimed listings.
 *
 * Usage:
 *   node scripts/import-businesses.js --file data/rawalpindi.xlsx --city Rawalpindi
 *   node scripts/import-businesses.js --file data/lahore.csv --city Lahore --country Pakistan
 *   node scripts/import-businesses.js --file data/dubai.xlsx --city Dubai --country UAE --dry-run
 *
 * Required environment variables (same as worker):
 *   SUPABASE_URL=https://xxx.supabase.co
 *   SUPABASE_SERVICE_KEY=eyJ...    (service role key — not anon key)
 *
 * Or create a .env file in the project root:
 *   SUPABASE_URL=...
 *   SUPABASE_SERVICE_KEY=...
 *
 * Expected columns (order-independent, case-insensitive):
 *   name / business name / shop name      (REQUIRED)
 *   category / type / business type       (REQUIRED)
 *   area / neighborhood / locality        (optional)
 *   address                               (optional)
 *   phone / whatsapp / contact / mobile   (optional)
 *   description                           (optional)
 *   opening hours / hours                 (optional)
 * ─────────────────────────────────────────────────────────────
 */

const fs   = require('fs');
const path = require('path');

// ── Argument parsing ────────────────────────────────────────────
const args = process.argv.slice(2);
function getArg(flag) {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : null;
}
const DRY_RUN  = args.includes('--dry-run');
const FILE     = getArg('--file');
const CITY     = getArg('--city')    || 'Unknown';
const COUNTRY  = getArg('--country') || 'Pakistan';

if (!FILE) {
  console.error('Usage: node scripts/import-businesses.js --file <path> --city <city> [--country <country>] [--dry-run]');
  process.exit(1);
}

// ── Load .env if present ────────────────────────────────────────
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const [k, ...v] = line.split('=');
    if (k && v.length) process.env[k.trim()] = v.join('=').trim();
  });
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables.');
  console.error('   Set them in .env or export them before running.');
  process.exit(1);
}

// ── Category normalisation map ──────────────────────────────────
const CATEGORY_MAP = {
  hospital: ['hospital','cardiac','surgical','military rehab','trauma','burn','childrens','cancer','oncology','neurology','orthopedic'],
  clinic:   ['clinic','medical center','health center','mother & child','maternity','obs','gyne'],
  lab:      ['lab','laboratory','diagnostic','pathology','radiology','imaging','scan','ultrasound','x-ray','xray'],
  dental:   ['dental','dentist','teeth','orthodontic','oral'],
  pharmacy: ['pharmacy','chemist','drug store','medicine'],
  skin:     ['skin','derma','aesthetic','laser','plastic','beauty','cosmet'],
  physio:   ['physio','rehabilitation','rehab','therapist'],
  eye:      ['eye','optic','ophtha','vision'],
  ent:      ['ent','ear','nose','throat'],
  salon:    ['salon','barber','hair','grooming','spa'],
  restaurant:['restaurant','cafe','food','eatery','diner','kitchen','bakery'],
  workshop: ['workshop','mechanic','repair','garage','service center'],
};

function normaliseCategory(raw) {
  if (!raw) return 'clinic';
  const r = raw.toLowerCase();
  for (const [canon, keywords] of Object.entries(CATEGORY_MAP)) {
    if (keywords.some(kw => r.includes(kw))) return canon;
  }
  return 'other';
}

// ── Slug generation ─────────────────────────────────────────────
function generateSlug(name, city) {
  const base = (name + '-' + city)
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
  const rand = Math.random().toString(36).slice(2, 6);
  return `${base}-${rand}`;
}

// ── Phone normalisation ─────────────────────────────────────────
function normalisePhone(raw) {
  if (!raw) return null;
  const s = String(raw).replace(/[\s\-().]/g, '');
  // Extract first number-like sequence
  const match = s.match(/\+?[\d]{7,15}/);
  if (match) return match[0].slice(0, 20);
  return null;
}

function generatePlaceholder() {
  return `unclaimed-${Math.random().toString(36).slice(2, 10)}`;
}

// ── Column header normalisation ─────────────────────────────────
function findCol(headers, ...candidates) {
  const lower = headers.map(h => (h || '').toLowerCase().trim());
  for (const c of candidates) {
    const i = lower.findIndex(h => h.includes(c));
    if (i >= 0) return i;
  }
  return -1;
}

// ── Row → record ─────────────────────────────────────────────────
function rowToRecord(row, headers, city, country) {
  const get = (...keys) => {
    const i = findCol(headers, ...keys);
    return i >= 0 ? String(row[i] || '').trim() : '';
  };

  const name     = get('name','business','shop');
  const category = get('category','type','kind','service');
  const area     = get('area','neighbourhood','neighborhood','locality','sector','zone');
  const address  = get('address','location','addr');
  const phone    = get('phone','whatsapp','contact','mobile','tel','number');
  const desc     = get('description','about','detail');
  const hours    = get('hours','timing','opening');

  return { name, category, area, address, phone, desc, hours };
}

// ── Supabase REST helper ────────────────────────────────────────
async function supabaseRequest(method, path, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      'apikey':        SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type':  'application/json',
      'Prefer':        'return=representation,resolution=ignore-duplicates',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  try { return { ok: res.ok, status: res.status, data: JSON.parse(text) }; }
  catch { return { ok: res.ok, status: res.status, data: text }; }
}

// ── Parse Excel ─────────────────────────────────────────────────
function parseExcel(filePath) {
  // Dynamically require xlsx — installed separately
  let XLSX;
  try { XLSX = require('xlsx'); }
  catch {
    console.error('❌ xlsx not installed. Run: npm install xlsx');
    process.exit(1);
  }
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  if (!raw.length) return { headers: [], rows: [] };
  return { headers: raw[0], rows: raw.slice(1) };
}

// ── Parse CSV ───────────────────────────────────────────────────
function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n').filter(l => l.trim());
  if (!lines.length) return { headers: [], rows: [] };
  const parse = line => {
    const result = [];
    let cur = '', inQ = false;
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; }
      else if (ch === ',' && !inQ) { result.push(cur.trim()); cur = ''; }
      else cur += ch;
    }
    result.push(cur.trim());
    return result;
  };
  return { headers: parse(lines[0]), rows: lines.slice(1).map(parse) };
}

// ── Main ────────────────────────────────────────────────────────
async function main() {
  const filePath = path.resolve(FILE);
  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    process.exit(1);
  }

  const ext = path.extname(filePath).toLowerCase();
  let parsed;
  if (ext === '.xlsx' || ext === '.xls') {
    parsed = parseExcel(filePath);
  } else if (ext === '.csv') {
    parsed = parseCSV(filePath);
  } else {
    console.error(`❌ Unsupported file type: ${ext}. Use .xlsx, .xls, or .csv`);
    process.exit(1);
  }

  const { headers, rows } = parsed;
  console.log(`\n📂 File: ${path.basename(filePath)}`);
  console.log(`📍 City: ${CITY}, Country: ${COUNTRY}`);
  console.log(`📊 Rows found: ${rows.length}`);
  console.log(`🔑 Columns: ${headers.join(', ')}`);
  if (DRY_RUN) console.log('🔍 DRY RUN MODE — nothing will be written to database\n');
  else console.log('');

  // Validate name column exists
  const nameCol = findCol(headers, 'name', 'business', 'shop');
  if (nameCol < 0) {
    console.error('❌ Could not find a "name" or "business name" column. Check your file headers.');
    process.exit(1);
  }

  let inserted = 0, skipped = 0, errors = 0;
  const results = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const raw = rowToRecord(row, headers, CITY, COUNTRY);

    // Skip blank rows
    if (!raw.name) { skipped++; continue; }

    // Skip header-like rows
    if (raw.name.toLowerCase() === 'name' || raw.name.toLowerCase() === 'business name') {
      skipped++; continue;
    }

    const phone    = normalisePhone(raw.phone) || generatePlaceholder();
    const category = normaliseCategory(raw.category);
    const slug     = generateSlug(raw.name, CITY);

    const record = {
      name:         raw.name,
      slug,
      category,
      area:         raw.area   || null,
      city:         CITY,
      country:      COUNTRY,
      address:      raw.address || null,
      description:  raw.desc   || null,
      opening_hours:raw.hours  || null,
      owner_phone:  phone,
      is_active:    false,
      is_claimed:   false,
      is_open:      false,
      token_mode:   'free',
      current_token:0,
    };

    if (DRY_RUN) {
      console.log(`  [${i+1}] ✅ WOULD INSERT: ${raw.name} (${category}) — ${CITY}`);
      results.push({ status: 'would_insert', name: raw.name });
      inserted++;
      continue;
    }

    try {
      const res = await supabaseRequest('POST', 'shops', record);
      if (res.ok) {
        console.log(`  [${i+1}] ✅ Inserted: ${raw.name}`);
        results.push({ status: 'inserted', name: raw.name });
        inserted++;
      } else if (res.status === 409 || String(res.data).includes('duplicate')) {
        console.log(`  [${i+1}] ⏭  Skipped (duplicate): ${raw.name}`);
        results.push({ status: 'skipped', name: raw.name, reason: 'duplicate' });
        skipped++;
      } else {
        console.error(`  [${i+1}] ❌ Error: ${raw.name} — ${JSON.stringify(res.data).slice(0,120)}`);
        results.push({ status: 'error', name: raw.name, error: res.data });
        errors++;
      }
    } catch(e) {
      console.error(`  [${i+1}] ❌ Network error: ${raw.name} — ${e.message}`);
      results.push({ status: 'error', name: raw.name, error: e.message });
      errors++;
    }

    // Small delay to avoid rate limiting
    if (i % 10 === 9) await new Promise(r => setTimeout(r, 200));
  }

  console.log(`
─────────────────────────────────
📊 Import complete
   ✅ Inserted: ${inserted}
   ⏭  Skipped:  ${skipped}
   ❌ Errors:   ${errors}
─────────────────────────────────`);

  if (errors > 0) {
    console.log('\n⚠️  Some rows failed. Check errors above.');
    process.exit(1);
  }
}

main().catch(e => { console.error('Fatal error:', e); process.exit(1); });
