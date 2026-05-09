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
