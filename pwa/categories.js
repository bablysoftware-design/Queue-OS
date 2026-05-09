// ============================================================
// categories.js — Single canonical source of truth for categories
// Loaded as a plain script (no ES module syntax required)
// Sets window.CATEGORY_MAP and window.normalizeCat
// ============================================================

window.CATEGORY_MAP = {
  barber: {
    emoji:     '✂️',
    label_en:  'Barber / Salon',
    label_ur:  'حجام / سیلون',
    plural_en: 'Barbers',
    aliases:   ['barber','salon','hair','stylist','scissor','gents','hairdress'],
  },
  clinic: {
    emoji:     '🏥',
    label_en:  'Clinic / Doctor',
    label_ur:  'کلینک / ڈاکٹر',
    plural_en: 'Clinics',
    aliases:   ['clinic','doctor','medical','physician','poly','specialist','dispensary'],
  },
  pharmacy: {
    emoji:     '💊',
    label_en:  'Pharmacy',
    label_ur:  'فارمیسی',
    plural_en: 'Pharmacies',
    aliases:   ['pharma','chemist','medicine','drug','medic'],
  },
  hospital: {
    emoji:     '🏨',
    label_en:  'Hospital',
    label_ur:  'ہسپتال',
    plural_en: 'Hospitals',
    aliases:   ['hospital'],
  },
  bank: {
    emoji:     '🏦',
    label_en:  'Bank / Finance',
    label_ur:  'بینک',
    plural_en: 'Banks',
    aliases:   ['bank','finance','microfinance','exchange','nadra','easypaisa','jazzcash'],
  },
  govt: {
    emoji:     '🏛️',
    label_en:  'Govt Office',
    label_ur:  'سرکاری دفتر',
    plural_en: 'Govt Offices',
    aliases:   ['govt','government','office','municipal','utility','passport'],
  },
  tailor: {
    emoji:     '🧵',
    label_en:  'Tailor / Workshop',
    label_ur:  'درزی',
    plural_en: 'Tailors',
    aliases:   ['tailor','boutique','stitching','workshop','alteration'],
  },
  ladies_salon: { emoji:'💇', label_en:'Ladies Salon',         label_ur:'لیڈیز سیلون',         plural_en:'Ladies Salons',   aliases:['ladies','beauty','parlour','parlor','mehndi','bridal'] },
  lab:          { emoji:'🧪', label_en:'Lab / Diagnostics',    label_ur:'لیبارٹری',              plural_en:'Labs',            aliases:['lab','test','diagnostic','pathology','blood'] },
  dentist:      { emoji:'🦷', label_en:'Dentist',              label_ur:'دندان ساز',             plural_en:'Dentists',        aliases:['dentist','dental','teeth','dant'] },
  physio:       { emoji:'🧘', label_en:'Physiotherapy',        label_ur:'فزیو تھیراپی',          plural_en:'Physios',         aliases:['physio','physical','therapy','rehab'] },
  eye_clinic:   { emoji:'👁️', label_en:'Eye Specialist',      label_ur:'آنکھوں کا ڈاکٹر',      plural_en:'Eye Clinics',     aliases:['eye','optical','vision','chasma'] },
  nadra:        { emoji:'🪪', label_en:'NADRA',               label_ur:'نادرا',                plural_en:'NADRA',           aliases:['nadra','id','cnic','b-form'] },
  passport:     { emoji:'📋', label_en:'Passport Office',     label_ur:'پاسپورٹ آفس',           plural_en:'Passport Offices', aliases:['passport','immigration','visa'] },
  post:         { emoji:'📮', label_en:'Post Office',         label_ur:'پوسٹ آفس',              plural_en:'Post Offices',    aliases:['post','mail','letter'] },
  court:        { emoji:'⚖️', label_en:'Court / Lawyer',     label_ur:'عدالت / وکیل',          plural_en:'Courts',          aliases:['court','lawyer','wakeel','legal','advocate'] },
  restaurant:   { emoji:'🍽️', label_en:'Restaurant',         label_ur:'ریسٹورینٹ',             plural_en:'Restaurants',     aliases:['restaurant','dhaba','hotel','eating','food'] },
  food:         { emoji:'🍛', label_en:'Biryani / Nihari',   label_ur:'بریانی / نہاری',        plural_en:'Food Shops',      aliases:['biryani','nihari','karahi','pulao','desi'] },
  bakery:       { emoji:'🥖', label_en:'Bakery',             label_ur:'بیکری',                 plural_en:'Bakeries',        aliases:['bakery','bread','cake','biscuit','roti'] },
  dairy:        { emoji:'🥛', label_en:'Dairy / Milk Shop',  label_ur:'ڈیری',                  plural_en:'Dairy Shops',     aliases:['dairy','milk','doodh','lassi'] },
  paan:         { emoji:'🫚', label_en:'Paan / Juice',       label_ur:'پان / جوس',             plural_en:'Paan Shops',      aliases:['paan','juice','drinks','sharbat'] },
  mechanic:     { emoji:'🔧', label_en:'Mechanic / Workshop',label_ur:'مکینک',                 plural_en:'Mechanics',       aliases:['mechanic','workshop','engine','repair','auto'] },
  carwash:      { emoji:'🚗', label_en:'Car Wash',           label_ur:'کار واش',               plural_en:'Car Washes',      aliases:['carwash','cleaning','detailing','wash'] },
  tyre:         { emoji:'🛞', label_en:'Tyre Shop',          label_ur:'ٹائر شاپ',              plural_en:'Tyre Shops',      aliases:['tyre','tire','puncture','wheel','rim'] },
  mobile:       { emoji:'📱', label_en:'Mobile Shop',        label_ur:'موبائل شاپ',            plural_en:'Mobile Shops',    aliases:['mobile','phone','repair','accessories','sim'] },
  electric:     { emoji:'💡', label_en:'Electrician',        label_ur:'الیکٹریشن',             plural_en:'Electricians',    aliases:['electric','wiring','fuse','meter','light'] },
  plumber:      { emoji:'🔩', label_en:'Plumber',            label_ur:'پلمبر',                 plural_en:'Plumbers',        aliases:['plumber','pipe','water','drain','sanitary'] },
  realestate:   { emoji:'🏘️', label_en:'Real Estate',       label_ur:'پراپرٹی ڈیلر',          plural_en:'Real Estate',     aliases:['property','real estate','plot','rent','house','dealer'] },
  courier:      { emoji:'🚚', label_en:'Courier / Delivery', label_ur:'کوریئر',               plural_en:'Couriers',        aliases:['courier','delivery','parcel'] },
  school:       { emoji:'🎓', label_en:'School / Academy',  label_ur:'اسکول',                 plural_en:'Schools',         aliases:['school','college','academy','institute','madrasa'] },
  tuition:      { emoji:'📚', label_en:'Tuition / Coaching',label_ur:'ٹیوشن',                 plural_en:'Tuitions',        aliases:['tuition','coaching','teacher','private','classes'] },
  gym:          { emoji:'💪', label_en:'Gym / Fitness',      label_ur:'جم',                   plural_en:'Gyms',            aliases:['gym','fitness','exercise','workout','sport'] },
  travel:       { emoji:'✈️', label_en:'Travel Agency',     label_ur:'ٹریول ایجنسی',          plural_en:'Travel Agencies', aliases:['travel','tour','ticket','visa','hajj','umrah'] },
  consultant:   { emoji:'🧑‍💼', label_en:'Consultant',      label_ur:'مشیر',                   plural_en:'Consultants',     aliases:['consultant','advisor','agent','broker'] },
  other: {
    emoji:     '🏪',
    label_en:  'Other',
    label_ur:  'دیگر',
    plural_en: 'Other',
    aliases:   [], // explicit fallback — no aliases map here
  },
};

/**
 * Normalize a raw category string to a canonical key.
 * Tries exact match first, then alias match, falls back to 'other'.
 * Never throws.
 */
window.normalizeCat = function normalizeCat(raw) {
  if (!raw) return 'other';
  const lower = raw.toLowerCase().trim();

  // 1. Direct canonical key match
  if (window.CATEGORY_MAP[lower]) return lower;

  // 2. Alias match — strip emoji/special chars, then check
  const stripped = lower.replace(/[^\w\s]/g, '').trim();
  for (const [key, cfg] of Object.entries(window.CATEGORY_MAP)) {
    if (key === 'other') continue; // skip other in alias search
    if (cfg.aliases.some(a => stripped.includes(a))) return key;
  }

  return 'other';
};

/**
 * Get emoji for a canonical category key.
 * Safe: returns '🏪' for unknown values.
 */
window.catEmoji = function catEmoji(key) {
  return (window.CATEGORY_MAP[key] || window.CATEGORY_MAP.other).emoji;
};

/**
 * Get display label for a canonical category key.
 * lang: 'en' | 'ur' — defaults to 'en'
 */
window.catDisplay = function catDisplay(key, lang) {
  const entry = window.CATEGORY_MAP[key] || window.CATEGORY_MAP.other;
  return lang === 'ur' ? entry.label_ur : entry.label_en;
};
