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

    // ── Customer page ──────────────────────────────────────
    pageTitle:       'WaitMate — Get Token',
    searchPlaceholder:'Search shops or areas...',
    addBusinessCta:  'Add Your Business',
    relatedShops:    'Related Shops',
    recentlyViewed:  '⏱ Recently Viewed',
    allShops:        'All Shops',
    nearbyShops:      '🏪 Nearby Shops',
    paymentRequired: '💳 Payment Required',
    payVia:          'Pay via Easypaisa / JazzCash, then upload screenshot here:',
    uploadScreenshotLbl:'📸 Upload Payment Screenshot',
    selectImageHint: 'Select an image or tap here',
    uploadScreenshotHint:'After uploading screenshot, submit — you\'ll get a token once business approves',
    backToShopList:  '← Back to Shop List',
    notifyFamilyTitle:'Notify Family',
    notifyFamilySub: 'They can track your turn from home',
    statusClosed:    'Closed Now',
    statusBusy:      'Busy',
    statusOpen:      'Open',
    queueLabel:      'Queue:',
    peopleWord:       'people',
    waitMinSuffix:    'min wait',
    currentNum:       'Current No.',
    inQueueLbl:       'In Queue',
    waitLbl:          'Wait',
    getTokenCta:      'Get Token — Join Queue Now',
    shopClosedNowTitle:'🔒 Shop is closed right now',
    shopClosedNowSub:'Come back when it opens and get a token',
    usuallyOpensMorning:'⏰ Usually opens in the morning',
    cannotGetTokenNow:'Cannot get a token right now',
    yourShopBadge:   '⭐ Your Shop',
    liveStats:       'Live stats',
    otherCatShops:   'Other {cat} shops',
    altCatShops:      'Alternative {cat} shops',
    nearbyTag:        'Nearby',
    couldNotLoadShops:'Could not load shops.<br/>Check your internet connection.',
    couldNotLoad:     'Could not load',
    retry:            'Retry',
    openedThisLink:   '🔗 You opened this link — get a token here',
    altSuggestion:    '💡 Alternative: {name} is open',
    nextTimeTip:      '⏰ <strong>Next time:</strong> check again when the shop opens',
    quieterSuggestion:'💡 Less busy: {name} — {n} people',
    longQueueWarning: '⚠️ Long queue — there may be a wait',
    goodTimeToGo:     '✅ Good time to get a token now',
    yourToken:        'Your Token',
    approvedJoined:    '🎉 Approved! {shop} — you\'re in the queue',
    timeUpRetry:      'Time\'s up — please try again',
    retryBtn:         'Retry',
    paymentRejected:  '❌ Payment rejected — please try again',
    payRequestBtn:    'Submit Payment Request — Rs {n}',
    getTokenBtn:      'Get Token',
    phoneRequiredPay: 'Phone number is required for payment',
    requestReceived:  '✓ Request received! You\'ll get a token automatically once approved...',
    waitingApproval:  '⏳ Awaiting approval...',
    genericError:     'Error',
    checkInternet:    'Check your internet connection.',
    cancelTokenTitle: 'Cancel your token?',
    cancelTokenSub:   'You\'ll lose your place in the queue.<br>You\'ll need to get a new token.',
    keepIt:           'No, keep it',
    yesCancelIt:       'Yes, cancel it',
    couldNotCancel:    'Could not cancel',
    cancelPendingRequest:'Cancel Request',
    pendingCancelConfirm:'Cancel your pending payment request?',
    pendingRequestCancelled:'Payment request cancelled',
    peopleAheadOf5:   '5 people ahead of you. Get ready.',
    peopleAheadOf3:   'Only 3 people left. Start heading over.',
    peopleAheadOf1:   'Only 1 person left. Your turn is coming up.',
    yourTurnArrived:  'Your turn has arrived. Please come to the counter now.',
    yourTurnNotifTitle:'Your turn has arrived! 🔔',
    cameToCounterNow: 'Please come to the counter now!',
    yourTurnBadge:    '🔔 Your Turn!',
    comeToCounterNow: 'Come to the counter now!',
    priorityCalledBadge:'🚨 Come to the counter now!',
    priorityCalledSub:'You\'ve been called as priority',
    shopClosedBadge:  '🔒 Shop has closed',
    tokenCancelledMsg:'Your token was cancelled',
    completedBadge:   '✅ Completed',
    cancelledBadge:   '❌ Cancelled',
    serviceDoneMsg:   'Your service is complete',
    waitingBadgePrefix:'Waiting — No. #',
    peopleAheadSuffix:'people ahead · ~{w} min',
    updatingIn:       'updating in',
    secWord:          'sec',
    linkCopied:       '✅ Link copied!',
    saveLinkBtnLabel: 'Save this link — works next time too',
    waMsgIntro:        'I\'ve got token {n} at *{shop}*.',
    waMsgWait:        'Should be my turn in about {w} minutes.',
    waMsgGetToken:    'Get your own token here too:',
    waMsgSaveLink:    'Save this link — works next time too',
    allAreas:         'All Areas',
    allCats:          'All',
    catFallbackOther:'Other',
    awaitingApprovalShort:'⏳ Awaiting approval...',
    requestReceivedRetry:'✓ Request received! Checking every 5 seconds...',
    tokenRestored:     'Token Restored',
    installAppTitle:  '📲 Install App',
    installAppIosHint:'Safari menu → <b>Add to Home Screen</b>',
    installAppAndroidHint:'Browser menu → <b>Add to Home Screen</b>',
    installApp:       'Install App',
    shopPageTitleSuffix:'WaitMate',
    emptyCheckmark:  'Empty now ✓',
    statusClosedShort:'Closed',
    busyPeopleSuffix: 'people — Busy',
    queuePeopleSuffix:'people in queue',
    payToShop:        '— to pay {shop}',

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

    // ── Customer page ──────────────────────────────────────
    pageTitle:       'ویٹ میٹ — ٹوکن لیں',
    searchPlaceholder:'دکان یا علاقہ تلاش کریں...',
    addBusinessCta:  'اپنا کاروبار شامل کریں',
    relatedShops:    'متعلقہ دکانیں',
    recentlyViewed:  '⏱ حال ہی میں',
    allShops:        'تمام دکانیں',
    nearbyShops:      '🏪 قریبی دکانیں',
    paymentRequired: '💳 ادائیگی ضروری ہے',
    payVia:          'Easypaisa / JazzCash پر ادائیگی کریں، پھر اسکرین شاٹ یہاں اپلوڈ کریں:',
    uploadScreenshotLbl:'📸 پیمنٹ اسکرین شاٹ اپلوڈ کریں',
    selectImageHint: 'تصویر منتخب کریں یا یہاں ٹیپ کریں',
    uploadScreenshotHint:'اسکرین شاٹ لگانے کے بعد درخواست دیں — بزنس منظور کرے گی تو فوری ٹوکن ملے گا',
    backToShopList:  '← دکانوں کی فہرست پر واپس جائیں',
    notifyFamilyTitle:'گھر والوں کو بتائیں',
    notifyFamilySub: 'وہ آپ کی باری گھر بیٹھے دیکھ سکتے ہیں',
    statusClosed:    'ابھی بند',
    statusBusy:      'مصروف',
    statusOpen:      'کھلی ہے',
    queueLabel:      'قطار:',
    peopleWord:       'لوگ',
    waitMinSuffix:    'منٹ انتظار',
    currentNum:       'ابھی نمبر',
    inQueueLbl:       'قطار میں',
    waitLbl:          'انتظار',
    getTokenCta:      'ٹوکن لیں — ابھی قطار میں شامل ہوں',
    shopClosedNowTitle:'🔒 دکان ابھی بند ہے',
    shopClosedNowSub:'کھلنے پر دوبارہ آئیں اور ٹوکن لیں',
    usuallyOpensMorning:'⏰ عام طور پر صبح کھلتی ہے',
    cannotGetTokenNow:'ابھی ٹوکن نہیں لیا جا سکتا',
    yourShopBadge:   '⭐ آپ کی دکان',
    liveStats:       'لائیو اعداد و شمار',
    otherCatShops:   'دیگر {cat} دکانیں',
    altCatShops:      'متبادل {cat} دکانیں',
    nearbyTag:        'قریبی',
    couldNotLoadShops:'دکانیں لوڈ نہیں ہو سکیں۔<br/>انٹرنیٹ چیک کریں۔',
    couldNotLoad:     'لوڈ نہیں ہو سکا',
    retry:            'دوبارہ کوشش کریں',
    openedThisLink:   '🔗 آپ نے یہ لنک کھولا — یہاں ٹوکن لیں',
    altSuggestion:    '💡 متبادل: {name} کھلی ہے',
    nextTimeTip:      '⏰ <strong>اگلی بار:</strong> دکان کھلنے پر دوبارہ چیک کریں',
    quieterSuggestion:'💡 کم قطار: {name} — {n} لوگ',
    longQueueWarning: '⚠️ قطار لمبی ہے — انتظار ہو سکتا ہے',
    goodTimeToGo:     '✅ ابھی ٹوکن لینے کا اچھا وقت ہے',
    yourToken:        'آپ کا ٹوکن',
    approvedJoined:    '🎉 منظور! {shop} — آپ قطار میں ہیں',
    timeUpRetry:      'وقت ختم — براہ کرم دوبارہ کوشش کریں',
    retryBtn:         'دوبارہ کوشش کریں',
    paymentRejected:  '❌ ادائیگی رد کر دی گئی — براہ کرم دوبارہ کوشش کریں',
    payRequestBtn:    'ادائیگی کی درخواست دیں — Rs {n}',
    getTokenBtn:      'ٹوکن لیں',
    phoneRequiredPay: 'ادائیگی کے لیے فون نمبر ضروری ہے',
    requestReceived:  '✓ درخواست موصول! دکان منظور کرے گی تو خودبخود ٹوکن ملے گا...',
    waitingApproval:  '⏳ منظوری کا انتظار...',
    genericError:     'خرابی',
    checkInternet:    'انٹرنیٹ چیک کریں۔',
    cancelTokenTitle: 'ٹوکن منسوخ کریں؟',
    cancelTokenSub:   'آپ کی جگہ قطار سے ہٹ جائے گی۔<br>دوبارہ ٹوکن لینا ہوگا۔',
    keepIt:           'نہیں، رہنے دیں',
    yesCancelIt:       'ہاں، منسوخ کریں',
    couldNotCancel:    'منسوخ نہیں ہو سکا',
    cancelPendingRequest:'درخواست منسوخ کریں',
    pendingCancelConfirm:'آپ کی زیر التواء ادائیگی کی درخواست منسوخ کریں؟',
    pendingRequestCancelled:'ادائیگی کی درخواست منسوخ ہو گئی',
    peopleAheadOf5:   'آپ سے پہلے 5 لوگ ہیں۔ تیار رہیں۔',
    peopleAheadOf3:   'صرف 3 لوگ باقی ہیں۔ آنا شروع کریں۔',
    peopleAheadOf1:   'صرف ایک شخص باقی ہے۔ آپ کی باری آنے والی ہے۔',
    yourTurnArrived:  'آپ کی باری آ گئی۔ ابھی کاؤنٹر پر آئیں۔',
    yourTurnNotifTitle:'آپ کی باری آ گئی! 🔔',
    cameToCounterNow: 'ابھی کاؤنٹر پر آئیں!',
    yourTurnBadge:    '🔔 آپ کی باری آ گئی!',
    comeToCounterNow: 'ابھی کاؤنٹر پر آئیں!',
    priorityCalledBadge:'🚨 ابھی کاؤنٹر پر آئیں!',
    priorityCalledSub:'آپ کو ترجیحی بنیاد پر بلایا گیا ہے',
    shopClosedBadge:  '🔒 دکان بند ہو گئی',
    tokenCancelledMsg:'آپ کا ٹوکن منسوخ ہو گیا',
    completedBadge:   '✅ مکمل',
    cancelledBadge:   '❌ منسوخ',
    serviceDoneMsg:   'آپ کی سروس ہو گئی',
    waitingBadgePrefix:'انتظار — نمبر #',
    peopleAheadSuffix:'لوگ آگے · ~{w} منٹ',
    updatingIn:       'اپڈیٹ میں',
    secWord:          'سیکنڈ',
    linkCopied:       '✅ لنک کاپی ہو گیا!',
    saveLinkBtnLabel: 'یہ لنک محفوظ کریں — اگلی بار بھی کام آئے گا',
    waMsgIntro:        'میں نے *{shop}* میں نمبر {n} لے لیا ہے۔',
    waMsgWait:        'تقریباً {w} منٹ میں باری آئے گی۔',
    waMsgGetToken:    'آپ کا ٹوکن بھی لینا ہو تو یہاں سے لے سکتے ہیں:',
    waMsgSaveLink:    'یہ لنک محفوظ رکھیں — اگلی بار بھی کام آئے گا',
    allAreas:         'سب علاقے',
    allCats:          'سب',
    catFallbackOther:'دیگر',
    awaitingApprovalShort:'⏳ منظوری کا انتظار...',
    requestReceivedRetry:'✓ درخواست موصول! ہر 5 سیکنڈ میں چیک ہو رہا ہے...',
    tokenRestored:     'ٹوکن بحال',
    installAppTitle:  '📲 ایپ انسٹال کریں',
    installAppIosHint:'Safari menu → <b>Add to Home Screen</b> دبائیں',
    installAppAndroidHint:'Browser menu → <b>Add to Home Screen</b> دبائیں',
    installApp:       'ایپ انسٹال کریں',
    shopPageTitleSuffix:'ویٹ میٹ',
    emptyCheckmark:  'ابھی خالی ✓',
    statusClosedShort:'بند',
    busyPeopleSuffix: 'لوگ — مصروف',
    queuePeopleSuffix:'لوگ قطار میں',
    payToShop:        '— {shop} کو ادا کریں',

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
function t(key, vars) {
  const lang = localStorage.getItem('sq_lang') || 'en';
  let str  = STRINGS[lang]?.[key] || STRINGS.en[key] || key;
  if (vars === undefined) return str;
  // Backward compatible: t(key, 5) still replaces the old #{n} token
  if (typeof vars === 'number' || typeof vars === 'string') {
    return str.replace('#{n}', vars);
  }
  // New: t(key, {name: 'Ali', n: 3}) replaces {name}, {n}, etc.
  for (const k in vars) {
    str = str.split('{' + k + '}').join(vars[k]);
  }
  return str;
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
