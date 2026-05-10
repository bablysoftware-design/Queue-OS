// ============================================================
// routes/search.js — Location + category autocomplete
// Falls back gracefully if tables don't exist
// ============================================================

import { createClient }  from '../utils/db.js';
import { ok }            from '../utils/response.js';

const CITIES = [
  // Major cities
  'Islamabad','Rawalpindi','Lahore','Karachi','Peshawar','Quetta','Multan','Faisalabad',
  'Sialkot','Gujranwala','Hyderabad','Abbottabad','Murree','Gilgit','Swat',
  // Punjab
  'Bahawalpur','Sargodha','Sheikhupura','Jhang','Rahim Yar Khan','Gujrat','Kasur',
  'Okara','Sahiwal','Dera Ghazi Khan','Mianwali','Hafizabad','Chakwal','Jhelum',
  'Attock','Bhakkar','Khushab','Narowal','Nankana Sahib','Pakpattan','Vehari',
  'Lodhran','Bahawalnagar','Muzaffargarh','Layyah','Chiniot','Toba Tek Singh',
  'Mandi Bahauddin','Khanewal','Wah Cantt','Taxila','Kamra','Gujar Khan',
  'Chakwal','Pind Dadan Khan','Kharian','Daska','Sambrial','Wazirabad',
  // Sindh
  'Sukkur','Larkana','Nawabshah','Mirpurkhas','Jacobabad','Shikarpur','Dadu',
  'Thatta','Badin','Tharparkar','Sanghar','Khairpur','Ghotki','Kashmore',
  'Shahdadkot','Kandhkot','Kamber','Kotri','Jamshoro','Sehwan',
  // KPK
  'Mardan','Mingora','Kohat','Bannu','Dera Ismail Khan','Nowshera','Haripur',
  'Mansehra','Chitral','Dir','Buner','Shangla','Battagram','Kohistan',
  'Charsadda','Swabi','Malakand','Karak','Lakki Marwat','Tank',
  // Balochistan
  'Turbat','Khuzdar','Chaman','Hub','Gwadar','Kharan','Panjgur','Washuk',
  'Mastung','Kalat','Sibi','Zhob','Loralai','Qila Saifullah','Pishin',
  // AJK & GB
  'Mirpur','Muzaffarabad','Rawalakot','Bagh','Kotli','Bhimber','Hattian',
  'Skardu','Hunza','Ghizer','Astore','Ghanche','Nagar',
  // Common spellings / aliases
  'DG Khan','RYK','DI Khan',
].sort();

const AREAS = [
  // ── Islamabad Sectors ──
  'F-6','F-7','F-8','F-10','F-11','G-6','G-7','G-8','G-9','G-10','G-11',
  'H-8','H-9','H-11','H-13','I-8','I-9','I-10','I-11','I-14',
  'E-7','E-11','D-12','B-17','Blue Area','Diplomatic Enclave',
  'Tarlai','Saidpur Village','Golra','Rawat','Sangjani',
  // ── Rawalpindi ──
  'Saddar Rawalpindi','Raja Bazaar','Chaklala','Satellite Town',
  'Bahria Town Rawalpindi','DHA Rawalpindi','Morgah','Adiala Road',
  'Committee Chowk','Westridge','Dhoke Kala Khan','Murree Road Rawalpindi',
  'GT Road Rawalpindi','Dhoke Mangtal','Dhoke Syedan','Pirwadhai',
  // ── Lahore ──
  'Gulberg Lahore','Model Town Lahore','DHA Lahore','Johar Town',
  'Bahria Town Lahore','Allama Iqbal Town','Samanabad','Township Lahore',
  'Wapda Town','Garden Town','Shadman','Faisal Town','Cavalry Ground',
  'Cantt Lahore','Gulshan Ravi','Iqbal Town','Tajpura','Ravi Road',
  'Ferozepur Road','Multan Road Lahore','Canal Road Lahore',
  'Shad Bagh','Baghbanpura','Ichra','Mozang','Krishan Nagar',
  'Gawalmandi','Anarkali','Bhati Gate','Shalimar','Kot Lakhpat',
  'Sundar Industrial Estate','Raiwind Road',
  // ── Karachi ──
  'North Nazimabad','Nazimabad','Orangi Town','Korangi','Landhi',
  'Malir','PECHS','Gulshan-e-Iqbal','Federal B Area','FB Area',
  'Clifton','Defence Karachi','DHA Karachi','Saddar Karachi',
  'Liaquatabad','New Karachi','Surjani Town','Baldia Town',
  'Keamari','Lyari','Manghopir','Shah Faisal Colony',
  'Bin Qasim','Gulistan-e-Jauhar','North Karachi','Azizabad',
  'Metroville','Site Area','Scheme 33','Scheme 45',
  'Gulberg Karachi','Rashid Minhas','Malir Cantt','Drigh Road',
  'Shahra-e-Faisal','University Road Karachi','Tipu Sultan Road',
  'Buffer Zone','Kemari','Martin Quarter','Soldier Bazaar',
  'Garden Karachi','Tariq Road','Bahadurabad','Nursery Karachi',
  'Jodia Bazaar','Old City Karachi','Kharadar','Lighthouse',
  // ── Faisalabad ──
  'Peoples Colony','Canal Road Faisalabad','Jhang Road',
  'Sargodha Road','Jinnah Colony','Madina Town','Gulberg Faisalabad',
  'D Ground','Millat Road','Susan Road','Satiana Road',
  // ── Multan ──
  'Cantt Multan','Saddar Multan','Shah Rukn-e-Alam','Gulgasht Colony',
  'Bosan Road','Kutchery Road','Qasim Bela','New Multan',
  // ── Peshawar ──
  'University Town Peshawar','Hayatabad','Hayatabad Phase 1',
  'Hayatabad Phase 2','Hayatabad Phase 3','Hayatabad Phase 4',
  'Cantt Peshawar','Saddar Peshawar','Ring Road Peshawar',
  'Gulbahar','Dalazak Road','Charsadda Road','Warsak Road',
  // ── Quetta ──
  'Brewery Road','Airport Road Quetta','Satellite Town Quetta',
  'Sariab Road','Jinnah Road Quetta','Zarghoon Road',
  'Spini Road','Hazar Ganji','Kuchlak Road',
  // ── Hyderabad ──
  'Qasimabad','Latifabad','Hirabad','Hyderabad Cantt',
  'Tilak Incline','Pahore','Kohsar',
  // ── Sialkot ──
  'Cantt Sialkot','Ugoki Road','Paris Road','Iqbal Stadium Area',
  // ── Gujranwala ──
  'GT Road Gujranwala','Model Town Gujranwala','Satellite Town Gujranwala',
  'Peoples Colony Gujranwala','Civil Lines Gujranwala',
  // ── Abbottabad ──
  'Cantt Abbottabad','Mirpur Road','Shimla Hill','Supply Bazaar',
  // ── Other Common Areas ──
  'Cantt','DHA','Bahria Town','Saddar','Gulberg','Model Town',
  'Johar Town','Township','Defence','Wapda Town','Garden Town',
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

  // Static fallback — combine cities and areas, deduplicate case-insensitively
  const all = [...CITIES, ...AREAS];
  const seen = new Set();
  const deduped = all.filter(x => {
    const k = x.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const filtered = q ? deduped.filter(x => x.toLowerCase().includes(q)) : deduped;
  return ok(filtered.slice(0, 20).map(v => ({ label: v, value: v })));
}

// Canonical list — must stay in sync with pwa/categories.js CATEGORY_MAP
const CATEGORIES = [
  // Health
  { label: '✂️ Barber / Salon',       value: 'barber'      },
  { label: '💇 Ladies Salon',          value: 'ladies_salon' },
  { label: '🏥 Clinic / Doctor',       value: 'clinic'      },
  { label: '🏨 Hospital',              value: 'hospital'    },
  { label: '💊 Pharmacy',              value: 'pharmacy'    },
  { label: '🧪 Lab / Diagnostics',     value: 'lab'         },
  { label: '🦷 Dentist',               value: 'dentist'     },
  { label: '🧘 Physiotherapy',         value: 'physio'      },
  { label: '👁️ Eye Specialist',        value: 'eye_clinic'  },
  // Government
  { label: '🏛️ Govt Office',          value: 'govt'        },
  { label: '🪪 NADRA',                 value: 'nadra'       },
  { label: '📋 Passport Office',        value: 'passport'    },
  { label: '🏦 Bank / Finance',         value: 'bank'        },
  { label: '📮 Post Office',            value: 'post'        },
  { label: '⚖️ Court / Lawyer',        value: 'court'       },
  // Food
  { label: '🍽️ Restaurant',           value: 'restaurant'  },
  { label: '🍛 Biryani / Nihari',      value: 'food'        },
  { label: '🥖 Bakery',                value: 'bakery'      },
  { label: '🥛 Dairy / Milk Shop',     value: 'dairy'       },
  { label: '🫚 Paan / Juice Shop',     value: 'paan'        },
  // Auto
  { label: '🔧 Mechanic / Workshop',   value: 'mechanic'    },
  { label: '🚗 Car Wash',              value: 'carwash'     },
  { label: '🛞 Tyre Shop',             value: 'tyre'        },
  // Retail
  { label: '📱 Mobile Shop',           value: 'mobile'      },
  { label: '💡 Electrician',           value: 'electric'    },
  { label: '🔩 Plumber',              value: 'plumber'     },
  { label: '🧵 Tailor',               value: 'tailor'      },
  { label: '🏘️ Real Estate',          value: 'realestate'  },
  { label: '🚚 Courier / Delivery',   value: 'courier'     },
  // Education
  { label: '🎓 School / Academy',      value: 'school'      },
  { label: '📚 Tuition / Coaching',    value: 'tuition'     },
  { label: '💪 Gym / Fitness',         value: 'gym'         },
  // Services
  { label: '✈️ Travel Agency',         value: 'travel'      },
  { label: '🧑‍💼 Consultant / Advisor', value: 'consultant'  },
  { label: '🏪 Other',                 value: 'other'       },
];

export async function searchCategories(request, env) {
  const q = (new URL(request.url).searchParams.get('q') || '').toLowerCase().trim();
  const filtered = q
    ? CATEGORIES.filter(c => c.label.toLowerCase().includes(q) || c.value.includes(q))
    : CATEGORIES;
  return ok(filtered);
}

/** POST /admin/locations — admin adds a city or area to the locations table */
export async function adminAddLocation(request, env) {
  const { requireAdmin } = await import('../utils/auth.js');
  const authErr = await requireAdmin(request, env);
  if (authErr) return authErr;
  try {
    const { city, area, country = 'Pakistan' } = await request.json();
    if (!city && !area) return (await import('../utils/response.js')).badRequest('city or area required');
    const { createClient } = await import('../utils/db.js');
    const db = createClient(env);
    const { ok, serverError } = await import('../utils/response.js');
    const row = await db.insert('locations', {
      city:    city    || null,
      area:    area    || null,
      country: country || 'Pakistan',
    });
    return ok({ added: Array.isArray(row) ? row[0] : row });
  } catch(err) {
    const { serverError } = await import('../utils/response.js');
    return serverError(err.message);
  }
}
