(function () {
  var T = {
    en: {
      nav: { support: 'Support', contact: 'Contact', privacy: 'Privacy', terms: 'Terms' },
      footer: {
        copy: '© 2026 Vibe Tower. All rights reserved.',
        contact: 'Contact', privacy: 'Privacy Policy', terms: 'Terms of Service', support: 'Support',
      },
      theme: { light: '☀︎ Light', dark: '☽ Dark', auto: '◑ Auto' },
      heroTag: 'Available on iOS & Android',
      heroH1: 'Build Your<br><em>Dream Tower</em>',
      heroSub: 'Construct floors, unlock businesses, and grow your empire one level at a time in the addictive idle city-builder.',
      dlApple: 'Download on the', appStore: 'App Store',
      dlGoogle: 'Get it on',      googlePlay: 'Google Play',
      featEyebrow: 'Features', featH2: 'Everything in one tower',
      featLead: 'From a humble lobby to a sky-high empire — Vibe Tower grows as fast as your ambition.',
      feat1Title: 'Build Floor by Floor',
      feat1Desc: 'Unlock dozens of unique floors and businesses. Each level generates its own revenue stream and personality.',
      feat2Title: 'Gems & Coins',
      feat2Desc: 'Earn and spend currency through smart upgrades. Strategically use gems to fast-track your tower\'s rise.',
      feat3Title: 'Tournaments',
      feat3Desc: 'Compete globally in limited-time events. Climb the leaderboard and earn exclusive rewards before time runs out.',
      feat4Title: 'Cities & Friends',
      feat4Desc: 'Join a city, team up with players, and contribute your tower\'s power to collective goals.',
      shotsEyebrow: 'Screenshots', shotsH2: 'See it in action',
      shotsLead: 'Screenshots coming soon — check back after launch.',
      contactEyebrow: 'Contact', contactH2: 'Get in Touch',
      contactLead: 'Questions, feedback, or just want to say hi — we reply within 24 hours.',
      contactMore: 'Full support & FAQ →',
      cEmailLabel: 'Your email', cMsgLabel: 'Message',
      cEmailPh: 'you@example.com', cMsgPh: 'Tell us what\'s on your mind…',
      formSubmit: 'Send Message', formSending: 'Sending…',
      formSuccessHome: '✓ Got it! We\'ll reply within 24 hours.',
      // contact page
      cpH1: 'Contact Us', cpDate: 'We usually respond within 24 hours.',
      cpIntro: 'Have feedback, a question, or want to report an issue? Fill out the form below and we\'ll get back to you.',
      cpH2: 'Send a Message',
      fName: 'Your name', fNamePh: 'Alex',
      fEmail: 'Email address', fSubject: 'Subject', fMsg: 'Message',
      fMsgPh: 'Describe your feedback or question in as much detail as possible…',
      selTopic: 'Select a topic…', topicFeedback: 'General feedback',
      topicBug: 'Bug report', topicFeature: 'Feature request',
      topicBusiness: 'Business & partnerships', topicOther: 'Other',
      formSuccess: '✓ Thanks! Your message has been received. We\'ll reply to your email within 24 hours.',
      directEmail: 'Direct email',
      // support page
      spH1: 'Support', spDate: 'We usually respond within 24 hours.',
      spIntro: 'Have a question about Vibe Tower? Check the FAQ below or send us a message — we\'re here to help.',
      faqH2: 'Frequently Asked Questions',
      faq1Q: 'My progress disappeared after reinstalling. Can I recover it?',
      faq1A: 'If you were logged in to your account before reinstalling, your progress is saved on the server. Simply sign in with the same account after reinstalling and your tower will be restored. Progress is not saved if you played as a guest without creating an account.',
      faq2Q: 'How do I reset my password?',
      faq2A: 'On the login screen, tap "Forgot password?" and enter your email address. You\'ll receive a reset link within a few minutes. Check your spam folder if it doesn\'t arrive.',
      faq3Q: 'I made a purchase but didn\'t receive the gems.',
      faq3A: 'First, try closing and reopening the App. Your purchase is tied to your App Store or Google Play account — if the issue persists, contact us below with your order number and we\'ll resolve it promptly.',
      faq4Q: 'Can I transfer my progress to a new device?',
      faq4A: 'Yes. Your progress is linked to your account, not your device. Sign in with the same email or Google account on your new device and everything will sync automatically.',
      faq5Q: 'How do I delete my account?',
      faq5A: 'Send us a message below with the subject "Delete my account" and include your registered email. We\'ll permanently delete your account and data within 30 days.',
      faq6Q: 'How do cities and city membership work?',
      faq6A: 'Cities are groups of players whose towers contribute to a shared city level. You can join or create a city from the Cities tab. Your tower\'s progress adds XP to your city, which unlocks city-wide bonuses for all members.',
      spMsgH2: 'Send Us a Message',
      spMsgPh: 'Describe your issue in as much detail as possible…',
      spSelectTopic: 'Select a topic…',
      topicProgress: 'Lost progress / sync issue', topicPurchase: 'Purchase not received',
      topicAccount: 'Account & password', topicDelete: 'Account deletion request',
      spSuccess: '✓ Thanks! Your message has been received. We\'ll reply to your email within 24 hours.',
      // privacy / terms (just headings)
      privH1: 'Privacy Policy', termsH1: 'Terms of Service',
    },

    uk: {
      nav: { support: 'Підтримка', contact: 'Контакти', privacy: 'Конфіденційність', terms: 'Умови' },
      footer: {
        copy: '© 2026 Vibe Tower. Всі права захищені.',
        contact: 'Контакти', privacy: 'Політика конфіденційності', terms: 'Умови використання', support: 'Підтримка',
      },
      theme: { light: '☀︎ Світла', dark: '☽ Темна', auto: '◑ Авто' },
      heroTag: 'Доступно на iOS та Android',
      heroH1: 'Будуй свою <em>омріяну вежу</em>',
      heroSub: 'Зводь поверхи, відкривай бізнеси та розбудовуй свою імперію крок за кроком у захопливому idle city-builder.',
      dlApple: 'Завантажити в', appStore: 'App Store',
      dlGoogle: 'Доступно в',   googlePlay: 'Google Play',
      featEyebrow: 'Можливості', featH2: 'Все в одній вежі',
      featLead: 'Від скромного лобі до хмарочосної імперії — Vibe Tower росте так само швидко, як твоя амбіція.',
      feat1Title: 'Будуй поверх за поверхом',
      feat1Desc: 'Відкривай десятки унікальних поверхів та бізнесів. Кожен рівень приносить свій дохід і має свій характер.',
      feat2Title: 'Самоцвіти та монети',
      feat2Desc: 'Заробляй і витрачай валюту на розумні апгрейди. Використовуй самоцвіти стратегічно, щоб пришвидшити зростання вежі.',
      feat3Title: 'Турніри',
      feat3Desc: 'Змагайся з гравцями по всьому світу в обмежених за часом подіях. Піднімайся в таблиці лідерів і здобувай ексклюзивні нагороди.',
      feat4Title: 'Міста та друзі',
      feat4Desc: 'Вступай до міста, об\'єднуйся з гравцями та вкладай силу своєї вежі в спільні цілі.',
      shotsEyebrow: 'Скриншоти', shotsH2: 'Подивись як це виглядає',
      shotsLead: 'Скриншоти з\'являться незабаром — заходь після запуску.',
      contactEyebrow: 'Контакти', contactH2: 'Зв\'яжись з нами',
      contactLead: 'Питання, відгук чи просто привітання — ми відповідаємо протягом 24 годин.',
      contactMore: 'Повна підтримка та FAQ →',
      cEmailLabel: 'Твій email', cMsgLabel: 'Повідомлення',
      cEmailPh: 'ти@example.com', cMsgPh: 'Розкажи, що у тебе на думці…',
      formSubmit: 'Надіслати', formSending: 'Надсилання…',
      formSuccessHome: '✓ Отримали! Відповімо протягом 24 годин.',
      // contact page
      cpH1: 'Зв\'яжись з нами', cpDate: 'Зазвичай відповідаємо протягом 24 годин.',
      cpIntro: 'Маєш відгук, питання або хочеш повідомити про проблему? Заповни форму нижче, і ми зв\'яжемось з тобою.',
      cpH2: 'Надіслати повідомлення',
      fName: 'Твоє ім\'я', fNamePh: 'Олексій',
      fEmail: 'Електронна пошта', fSubject: 'Тема', fMsg: 'Повідомлення',
      fMsgPh: 'Опишіть ваш відгук або питання якомога детальніше…',
      selTopic: 'Оберіть тему…', topicFeedback: 'Загальний відгук',
      topicBug: 'Повідомлення про помилку', topicFeature: 'Запит на функцію',
      topicBusiness: 'Бізнес та партнерство', topicOther: 'Інше',
      formSuccess: '✓ Дякуємо! Ваше повідомлення отримано. Ми відповімо на вашу пошту протягом 24 годин.',
      directEmail: 'Прямий email',
      // support page
      spH1: 'Підтримка', spDate: 'Зазвичай відповідаємо протягом 24 годин.',
      spIntro: 'Маєш питання про Vibe Tower? Перевір FAQ нижче або напиши нам — ми готові допомогти.',
      faqH2: 'Поширені запитання',
      faq1Q: 'Мій прогрес зник після перевстановлення. Чи можна його відновити?',
      faq1A: 'Якщо ти був залогінений у свій акаунт до перевстановлення, твій прогрес збережено на сервері. Просто увійди в той самий акаунт після встановлення — вежа відновиться. Прогрес не зберігається, якщо ти грав як гість без створення акаунту.',
      faq2Q: 'Як скинути пароль?',
      faq2A: 'На екрані входу натисни «Забули пароль?» і введи свою електронну адресу. Посилання для скидання прийде за кілька хвилин. Перевір папку «Спам», якщо лист не з\'явився.',
      faq3Q: 'Я зробив покупку, але не отримав самоцвіти.',
      faq3A: 'Спочатку спробуй закрити і знову відкрити гру. Покупка прив\'язана до твого акаунту App Store або Google Play — якщо проблема залишається, напиши нам нижче з номером замовлення, і ми вирішимо це швидко.',
      faq4Q: 'Чи можна перенести прогрес на новий пристрій?',
      faq4A: 'Так. Прогрес прив\'язаний до акаунту, а не до пристрою. Увійди з тим самим email або Google-акаунтом на новому пристрої — все синхронізується автоматично.',
      faq5Q: 'Як видалити акаунт?',
      faq5A: 'Надішли нам повідомлення нижче з темою «Видалити акаунт» і вкажи свій зареєстрований email. Ми назавжди видалимо акаунт і дані протягом 30 днів.',
      faq6Q: 'Як працюють міста та членство?',
      faq6A: 'Міста — це групи гравців, вежі яких разом формують рівень міста. Можна вступити або створити місто в розділі «Міста». Прогрес твоєї вежі додає XP місту та відкриває бонуси для всіх учасників.',
      spMsgH2: 'Написати нам',
      spMsgPh: 'Опишіть проблему якомога детальніше…',
      spSelectTopic: 'Оберіть тему…',
      topicProgress: 'Втрачений прогрес / проблема синхронізації',
      topicPurchase: 'Покупку не отримано',
      topicAccount: 'Акаунт та пароль',
      topicDelete: 'Запит на видалення акаунту',
      spSuccess: '✓ Дякуємо! Ваше повідомлення отримано. Ми відповімо на вашу пошту протягом 24 годин.',
      // privacy / terms
      privH1: 'Політика конфіденційності', termsH1: 'Умови обслуговування',
    },
  };

  function get(obj, key) {
    return key.split('.').reduce(function (o, k) { return o && o[k]; }, obj);
  }

  var _lang = 'en';

  function applyLang(lang) {
    _lang = lang;
    var t = T[lang] || T.en;
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var v = get(t, el.dataset.i18n);
      if (v !== undefined) el.textContent = v;
    });
    document.querySelectorAll('[data-i18n-html]').forEach(function (el) {
      var v = get(t, el.dataset.i18nHtml);
      if (v !== undefined) el.innerHTML = v;
    });
    document.querySelectorAll('[data-i18n-ph]').forEach(function (el) {
      var v = get(t, el.dataset.i18nPh);
      if (v !== undefined) el.placeholder = v;
    });
    document.documentElement.lang = lang === 'uk' ? 'uk' : 'en';
    var langBtn = document.getElementById('langBtn');
    if (langBtn) langBtn.textContent = lang === 'uk' ? 'УК' : 'EN';
  }

  window.vtI18n = {
    apply: applyLang,
    currentLang: function () { return _lang; },
    themeLabel: function (state) {
      var t = T[_lang] || T.en;
      return t.theme[state] || state;
    },
  };

  document.addEventListener('DOMContentLoaded', function () {
    var saved = 'en';
    try { saved = localStorage.getItem('vt-lang') || 'en'; } catch (e) {}
    applyLang(saved);

    var langBtn = document.getElementById('langBtn');
    if (!langBtn) return;
    langBtn.addEventListener('click', function () {
      var next = _lang === 'en' ? 'uk' : 'en';
      try { localStorage.setItem('vt-lang', next); } catch (e) {}
      applyLang(next);
      // re-apply current theme label
      if (window.vtThemeApply) window.vtThemeApply();
    });
  });
})();
