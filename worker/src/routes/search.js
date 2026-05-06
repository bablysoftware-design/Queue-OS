// ============================================================
// routes/search.js — Location + category autocomplete
// Falls back gracefully if tables don't exist
// ============================================================

import { createClient }  from '../utils/db.js';
import { ok }            from '../utils/response.js';

const CITIES = [
  'Islamabad','Rawalpindi','Lahore','Karachi','Peshawar',
  'Quetta','Multan','Faisalabad','Sialkot','Gujranwala',
  'Hyderabad','Abbottabad','Murree','Gilgit','Swat',
];

const AREAS = [
  'G-11','G-10','G-9','G-8','F-7','F-8','F-6','I-8','I-9',
  'Blue Area','Saddar','DHA','Bahria Town','Gulberg',
  'Model Town','Johar Town','Korang Town','kartar pura',
  'Clifton','Defence','Gulshan','North Nazimabad',
  'Hayatabad','University Town','Cantt',
];

export async function searchLocations(request, env) {
  const q = (new URL(request.url).searchParams.get('q') || '').toLowerCase().trim();

  // Try DB first, fall back to static list
  try {
    const db   = createClient(env);
    const rows = await db.select('locations',
      q ? `or=(city.ilike.*${q}*,area.ilike.*${q}*)&limit=10`
        : 'limit=20&order=city.asc'
    );
    if (rows?.length) return ok(rows.map(r => ({ label: r.city || r.area, value: r.city || r.area })));
  } catch(e) {}

  // Static fallback
  const all    = [...new Set([...CITIES, ...AREAS])];
  const filtered = q ? all.filter(x => x.toLowerCase().includes(q)) : all;
  return ok(filtered.slice(0, 15).map(v => ({ label: v, value: v })));
}

const CATEGORIES = [
  { label:'✂️ Barber / Salon', value:'barber' },
  { label:'🏥 Clinic / Doctor', value:'clinic' },
  { label:'💊 Pharmacy',        value:'pharmacy' },
  { label:'🏦 Bank',            value:'bank' },
  { label:'🏛️ Govt Office',    value:'govt' },
  { label:'🧵 Tailor',         value:'tailor' },
];

export async function searchCategories(request, env) {
  const q = (new URL(request.url).searchParams.get('q') || '').toLowerCase().trim();
  const filtered = q
    ? CATEGORIES.filter(c => c.label.toLowerCase().includes(q) || c.value.includes(q))
    : CATEGORIES;
  return ok(filtered);
}
