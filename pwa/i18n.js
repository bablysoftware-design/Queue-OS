// ============================================================
// i18n.js — Language strings for WaitMate
// Supports: English (en), Urdu (ur)
// ============================================================

const STRINGS = {
  en: {
    // App
    appName:        'WaitMate',
    appTagline:     'Your Smart Queue Partner',
    langSwitch:     'اردو',

    // Login
    shopLogin:      'Business Login',
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
    applyWaitBtn:   '✓ Apply for Next Customer',

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

    // New token notification
    newTokenTitle:   'WaitMate — New Token',
    newTokenToast:   'New token',
    newTokenBody:    'A new customer joined the queue',

    // Trial expiry banner
    trialExpired:    'Your plan has expired — ',
    trialExpiredCta: 'upgrade now',
    trialExpiredEnd: ' to keep the service running.',
    trialExpiringIn: 'Plan expires in #{n} days — ',
    trialExpiringCta:'upgrade',
    contactUs:       'contact us',

    // WhatsApp share message
    waShareLine1:    'is now on WaitMate',
    waShareLine2:    'Get a token from home — come in when it\'s your turn',
    waShareLine3:    'No need to stand in line',
    waShareLine4:    'Get your token now:',
    waShareLine5:    'Save this link — you\'ll need it every time',

    // Payment requests
    pendingCount:    'pending',
    noteLabel:       'Note',
    listenVoice:     'Listen to voice note',
    voiceLoading:    'Loading...',
    voicePlaying:    'Playing...',
    voiceError:      'Could not play voice note',
    approveBtn:      'Approve',
    rejectBtn:       'Reject',
    rejectConfirm:    'Reject this payment request?',
    requestRejected: 'Request rejected',
    tokenIssued:     'Token #{n} issued',
    viewScreenshot:  'View Screenshot',

    // Payment notification
    newPaymentToast: 'New payment request! (#{n}) — view',
    newPaymentTitle: 'WaitMate — New Payment Request',
    newPaymentBody:  '#{n} request(s) awaiting approval',

    // Onboarding
    onboardSub:      'Your shop is ready — complete these 3 easy steps',
    onboardBtn:       'Got it — let\'s start 🚀',

    // QR poster
    qrScanLine:      'Scan this QR code and<br/>get your token without standing in line<br/>',
    qrTagline:       'WaitMate — Your Turn, On Your Time',

    // Misc
    oldRecordAlert:  'This is an old record — please resubmit the screenshot',
    tapToClose:      'Tap to close',
  },

  ur: {
    appName:        'سف کیو',
    appTagline:     'سمارٹ قطار انتظام',
    langSwitch:     'English',

    // New token notification
    newTokenTitle:   'WaitMate — نیا ٹوکن',
    newTokenToast:   'نیا ٹوکن',
    newTokenBody:    'نیا گاہک قطار میں شامل ہوا',

    // Trial expiry banner
    trialExpired:    'آپ کا پلان ختم ہو گیا — ',
    trialExpiredCta: 'ابھی اپگریڈ کریں',
    trialExpiredEnd: ' تاکہ سروس جاری رہے۔',
    trialExpiringIn: 'پلان #{n} دن میں ختم ہو گا — ',
    trialExpiringCta:'اپگریڈ کریں',
    contactUs:       'رابطہ کریں',

    // WhatsApp share message
    waShareLine1:    'اب WaitMate پر ہے',
    waShareLine2:    'گھر بیٹھے ٹوکن لیں — باری آنے پر آئیں',
    waShareLine3:    'لائن میں کھڑے ہونے کی ضرورت نہیں',
    waShareLine4:    'ابھی ٹوکن لیں:',
    waShareLine5:    'اس لنک کو محفوظ کریں — ہر بار کام آئے گا',

    // Payment requests
    pendingCount:    'زیر التواء',
    noteLabel:       'نوٹ',
    listenVoice:     'آواز سنیں',
    voiceLoading:    'لوڈ ہو رہا ہے...',
    voicePlaying:    'چل رہا ہے...',
    voiceError:      'آواز چلانے میں مسئلہ',
    approveBtn:      'منظور کریں',
    rejectBtn:       'رد کریں',
    rejectConfirm:    'یہ payment request رد کریں؟',
    requestRejected: 'Request رد ہو گئی',
    tokenIssued:     'ٹوکن #{n} جاری ہو گیا',
    viewScreenshot:  'Screenshot دیکھیں',

    // Payment notification
    newPaymentToast: 'نئی ادائیگی کی درخواست! (#{n}) — دیکھیں',
    newPaymentTitle: 'WaitMate — نئی ادائیگی درخواست',
    newPaymentBody:  '#{n} درخواست منظوری کی منتظر ہے',

    // Onboarding
    onboardSub:      'آپ کی دکان تیار ہے — یہ 3 آسان قدم مکمل کریں',
    onboardBtn:       'سمجھ گیا — شروع کریں 🚀',

    // QR poster
    qrScanLine:      '📱 اس QR کو اسکین کریں اور<br/>لائن میں لگے بغیر اپنا ٹوکن لیں<br/>',
    qrTagline:       'WaitMate — آپ کی باری، آپ کے وقت پر',

    // Misc
    oldRecordAlert:  'یہ پرانا ریکارڈ ہے — Screenshot دوبارہ جمع کروائیں',
    tapToClose:      'ٹیپ کریں بند کرنے کے لیے',

    shopLogin:      'کاروبار لاگ ان',
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
    applyWaitBtn:   '✓ اگلے گاہک کے لیے سیٹ کریں',

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
function t(key, n) {
  const lang = localStorage.getItem('sq_lang') || 'en';
  const str  = STRINGS[lang]?.[key] || STRINGS.en[key] || key;
  return n !== undefined ? str.replace('#{n}', n) : str;
}

/** Get current language code */
function getLang() {
  return localStorage.getItem('sq_lang') || 'en';
}

/** Toggle language and reload */
function toggleLang() {
  const current = getLang();
  const next    = current === 'en' ? 'ur' : 'en';
  localStorage.setItem('sq_lang', next);
  window.location.reload();
}

/** Apply dir attribute to document */
function applyDir() {
  const lang = getLang();
  document.documentElement.lang = lang;
  document.documentElement.dir  = lang === 'ur' ? 'rtl' : 'ltr';
}

// Expose globally
window.t          = t;
window.getLang    = getLang;
window.toggleLang = toggleLang;
window.applyDir   = applyDir;
