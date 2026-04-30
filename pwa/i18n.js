// ============================================================
// i18n.js — Language strings for Saf Queue
// Supports: English (en), Urdu (ur)
// ============================================================

const STRINGS = {
  en: {
    // App
    appName:        'Saf Queue',
    appTagline:     'Smart Queue Management',
    langSwitch:     'اردو',

    // Login
    shopLogin:      'Shopkeeper Login',
    whatsappNum:    'WhatsApp Number',
    phonePlaceholder:'923001234567',
    pin:            '4-Digit PIN',
    pinPlaceholder: '••••',
    loginBtn:       'Sign In',
    loggingIn:      'Signing in...',
    orCustomer:     '— or —',
    customerBtn:    'I\'m a Customer — Get Token',
    loginError:     'Phone and PIN are required',
    loginFailed:    'Login failed',

    // Dashboard topbar
    loading:        'Loading...',

    // Status
    open:           'Open',
    closed:         'Closed',

    // Queue tab
    queueTab:       'Queue',
    reportsTab:     'Reports',
    currentToken:   'CURRENTLY SERVING',
    nextToken:      'Next Customer',
    noShow:         'No Show',
    manualToken:    'ADD WALK-IN',
    phoneOptional:  'Phone number (optional)',
    addBtn:         'Add',
    queueIn:        'In Queue',
    servedToday:    'Served Today',
    queueList:      'QUEUE',
    queueEmpty:     'Queue is empty 🎉',
    people:         'people',

    // Reports
    servedLabel:    'Served',
    noShowLabel:    'No Shows',
    waitingLabel:   'Waiting',
    totalLabel:     'Total Today',
    refreshReport:  'Refresh Report',

    // Subscription
    expiry:         'Expires',

    // Settings
    settingsTitle:  'SETTINGS',
    openingTime:    'Opening Time',
    closingTime:    'Closing Time',
    perCustomer:    'Minutes per Customer',
    saveSettings:   'Save Settings',
    close:          'Close',
    changePin:      'Change PIN',
    currentPin:     'Current PIN',
    newPin:         'New PIN',
    changePinBtn:   'Change',
    pinChanged:     '✅ PIN changed successfully',
    pinWrong:       'Current PIN is incorrect',
    pinInvalid:     'New PIN must be 4 digits',
    pinRequired:    'Enter both PINs',

    // Bottom bar
    refresh:        'Refresh',
    shareLink:      'Share',
    settings:       'Settings',
    logout:         'Logout',

    // Toasts
    shopOpen:       '✅ Shop is now open!',
    shopClosed:     '🔴 Shop is now closed',
    linkCopied:     '✅ Link copied!',
    settingsSaved:  '✅ Settings saved',
    tokenCalled:    'Token #{n} called',
    queueEmptyMsg:  'Queue is empty!',
    noShowDone:     'No show marked → Next called',
    tokenAdded:     '✅ Token #{n} added',

    // Admin modal
    adminAccess:    'ADMIN ACCESS',
    adminSecret:    'Admin Secret',
    adminLogin:     'Login as Admin',
    wrongSecret:    'Wrong secret. Try again.',
    connError:      'Connection error',

    // Customer area
    customerHub:    'Find a Shop',
    hubTagline:     'Skip the line. Get your token now.',
    searchPlaceholder: 'Search shops or areas...',
    allCategories:  'All',
    allAreas:       'All Areas',
    shopsOpen:      'Open',
    totalShops:     'Shops',
    inQueue:        'In Queue',
    currentlyServing:'Now Serving',
    estimatedWait:  'Wait',
    joinQueue:      'Get Token',
    yourName:       'Your name *',
    namePlaceholder:'Enter your name',
    phoneOptCust:   'Phone number (optional)',
    yourToken:      'YOUR TOKEN',
    tokenGreet:     ', you\'re in line!',
    positionLabel:  'Position',
    waitLabel:      'Est. Wait',
    liveStatus:     'LIVE STATUS',
    waitingStatus:  'Waiting — Position #{n}',
    calledStatus:   '🔔 It\'s your turn!',
    comeNow:        'Come now!',
    doneStatus:     '✅ Service complete',
    closedStatus:   '🔒 Shop closed',
    cancelledStatus:'❌ Cancelled',
    cancelToken:    'Cancel my token',
    confirmCancel:  'Are you sure you want to cancel your token?',
    shareShop:      'Share this shop\'s link',
    shopClosedTitle:'Shop is Closed',
    shopClosedSub:  'Please come back when the shop opens',
    backBtn:        '← Back',
    ahead:          'ahead',
    minutes:        'min',
    nameRequired:   'Name is required',
    alreadyIn:      'You\'re already in the queue. Token: #{n}',
  },

  ur: {
    appName:        'سف کیو',
    appTagline:     'سمارٹ قطار انتظام',
    langSwitch:     'English',

    shopLogin:      'دکان لاگ ان',
    whatsappNum:    'واٹس ایپ نمبر',
    phonePlaceholder:'923001234567',
    pin:            'چار ہندسہ پن',
    pinPlaceholder: '••••',
    loginBtn:       'داخل ہوں',
    loggingIn:      'لاگ ان ہو رہا ہے...',
    orCustomer:     '— یا —',
    customerBtn:    'میں گاہک ہوں — ٹوکن لیں',
    loginError:     'نمبر اور پن ضروری ہیں',
    loginFailed:    'لاگ ان ناکام',

    loading:        'لوڈ ہو رہا ہے',

    open:           'کھلی',
    closed:         'بند',

    queueTab:       'قطار',
    reportsTab:     'رپورٹ',
    currentToken:   'ابھی چل رہا ہے',
    nextToken:      'اگلا ٹوکن',
    noShow:         'غیر حاضر',
    manualToken:    'والک ان شامل کریں',
    phoneOptional:  'فون نمبر (اختیاری)',
    addBtn:         'شامل',
    queueIn:        'قطار میں',
    servedToday:    'آج سروس کیے',
    queueList:      'قطار',
    queueEmpty:     'قطار خالی ہے 🎉',
    people:         'لوگ',

    servedLabel:    'سروس کیے',
    noShowLabel:    'غیر حاضر',
    waitingLabel:   'انتظار',
    totalLabel:     'آج کل',
    refreshReport:  'رپورٹ تازہ کریں',

    expiry:         'میعاد',

    settingsTitle:  'ترتیبات',
    openingTime:    'کھلنے کا وقت',
    closingTime:    'بند ہونے کا وقت',
    perCustomer:    'فی گاہک منٹ',
    saveSettings:   'محفوظ کریں',
    close:          'بند کریں',
    changePin:      'پن تبدیل کریں',
    currentPin:     'موجودہ پن',
    newPin:         'نیا پن',
    changePinBtn:   'تبدیل',
    pinChanged:     '✅ پن تبدیل ہو گیا',
    pinWrong:       'موجودہ پن غلط ہے',
    pinInvalid:     'نیا پن 4 ہندسوں کا ہونا چاہیے',
    pinRequired:    'دونوں پن درج کریں',

    refresh:        'تازہ',
    shareLink:      'شیئر',
    settings:       'ترتیبات',
    logout:         'باہر',

    shopOpen:       '✅ دکان کھل گئی!',
    shopClosed:     '🔴 دکان بند ہو گئی',
    linkCopied:     '✅ لنک کاپی ہو گیا',
    settingsSaved:  '✅ ترتیبات محفوظ ہو گئیں',
    tokenCalled:    'ٹوکن #{n} بلا لیا گیا',
    queueEmptyMsg:  'قطار خالی ہے!',
    noShowDone:     'غیر حاضر درج ← اگلا بلایا گیا',
    tokenAdded:     '✅ ٹوکن #{n} شامل ہو گیا',

    adminAccess:    'ایڈمن رسائی',
    adminSecret:    'ایڈمن سیکرٹ',
    adminLogin:     'ایڈمن لاگ ان',
    wrongSecret:    'غلط سیکرٹ',
    connError:      'کنکشن خرابی',

    customerHub:    'دکان تلاش کریں',
    hubTagline:     'لائن میں مت کھڑے ہوں — ابھی ٹوکن لیں',
    searchPlaceholder:'دکان یا علاقہ تلاش کریں...',
    allCategories:  'سب',
    allAreas:       'سب علاقے',
    shopsOpen:      'کھلی',
    totalShops:     'دکانیں',
    inQueue:        'قطار میں',
    currentlyServing:'ابھی نمبر',
    estimatedWait:  'انتظار',
    joinQueue:      'ٹوکن لیں',
    yourName:       'آپ کا نام *',
    namePlaceholder:'نام درج کریں',
    phoneOptCust:   'فون نمبر (اختیاری)',
    yourToken:      'آپ کا ٹوکن',
    tokenGreet:     '، آپ کی باری آئے گی!',
    positionLabel:  'نمبر',
    waitLabel:      'انتظار',
    liveStatus:     'لائیو حیثیت',
    waitingStatus:  'انتظار — نمبر #{n}',
    calledStatus:   '🔔 آپ کی باری آ گئی!',
    comeNow:        'ابھی آئیں!',
    doneStatus:     '✅ سروس مکمل',
    closedStatus:   '🔒 دکان بند ہو گئی',
    cancelledStatus:'❌ منسوخ',
    cancelToken:    'ٹوکن منسوخ کریں',
    confirmCancel:  'کیا آپ واقعی ٹوکن منسوخ کرنا چاہتے ہیں؟',
    shareShop:      'دکان کا لنک شیئر کریں',
    shopClosedTitle:'دکان بند ہے',
    shopClosedSub:  'کھلنے کے بعد دوبارہ آئیں',
    backBtn:        '← واپس',
    ahead:          'آگے',
    minutes:        'منٹ',
    nameRequired:   'نام ضروری ہے',
    alreadyIn:      'آپ پہلے سے قطار میں ہیں۔ ٹوکن: #{n}',
  }
};

/** Get a translated string, replacing #{n} with value */
export function t(key, n) {
  const lang = localStorage.getItem('sq_lang') || 'en';
  const str  = STRINGS[lang]?.[key] || STRINGS.en[key] || key;
  return n !== undefined ? str.replace('#{n}', n) : str;
}

/** Get current language code */
export function getLang() {
  return localStorage.getItem('sq_lang') || 'en';
}

/** Toggle language and reload */
export function toggleLang() {
  const current = getLang();
  const next    = current === 'en' ? 'ur' : 'en';
  localStorage.setItem('sq_lang', next);
  window.location.reload();
}

/** Apply dir attribute to document */
export function applyDir() {
  const lang = getLang();
  document.documentElement.lang = lang;
  document.documentElement.dir  = lang === 'ur' ? 'rtl' : 'ltr';
}
