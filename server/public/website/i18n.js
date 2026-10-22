(function () {
  var T = {
    en: {
      nav: { support: 'Support', contact: 'Contact', privacy: 'Privacy', terms: 'Terms' },
      footer: {
        copy: '© 2026 Vibe Tower. All rights reserved.',
        contact: 'Contact', privacy: 'Privacy Policy', terms: 'Terms of Service', support: 'Support',
      },
      theme: { light: '☀︎ Light', dark: '☽ Dark', auto: '◑ Auto' },
      heroTag: 'Coming soon — iOS & Android',
      heroH1: 'Build Your<br><em>Dream Tower</em>',
      heroSub: 'Construct floors, unlock businesses, and grow your empire one level at a time in the addictive idle city-builder.',
      dlApple: 'Download on the', appStore: 'App Store',
      dlGoogle: 'Get it on',      googlePlay: 'Google Play',
      featEyebrow: 'Features', featH2: 'Everything in one tower',
      featLead: 'From a humble lobby to a sky-high empire — everything you need to build the ultimate tower.',
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
      heroTag: 'Незабаром — iOS та Android',
      heroH1: 'Будуй свою <em>омріяну вежу</em>',
      heroSub: 'Зводь поверхи, відкривай бізнеси та розбудовуй свою імперію крок за кроком у захопливому idle city-builder.',
      dlApple: 'Завантажити в', appStore: 'App Store',
      dlGoogle: 'Доступно в',   googlePlay: 'Google Play',
      featEyebrow: 'Можливості', featH2: 'Все в одній вежі',
      featLead: 'Від скромного лобі до хмарочосної імперії — все, що потрібно, щоб збудувати ідеальну вежу.',
      feat1Title: 'Будуй поверх за поверхом',
      feat1Desc: 'Відкривай десятки унікальних поверхів та бізнесів. Кожен рівень приносить свій дохід і має свій характер.',
      feat2Title: 'Діаманти та монети',
      feat2Desc: 'Заробляй і витрачай валюту на розумні апгрейди. Використовуй діаманти стратегічно, щоб пришвидшити зростання вежі.',
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
      faq3Q: 'Я зробив покупку, але не отримав діаманти.',
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
      // privacy page
      privH1: 'Політика конфіденційності',
      privDate: 'Оновлено: 19 жовтня 2026 р.',
      privIntro: 'Vibe Tower («ми», «нас» або «наш») розроблено та керується Volodymyr Shmidt. Ця Політика конфіденційності пояснює, яку інформацію ми збираємо, коли ви використовуєте мобільний додаток Vibe Tower («Додаток»), як ми її використовуємо та ваші права щодо цієї інформації.',
      privH2Collect: 'Яку інформацію ми збираємо',
      privCollectIntro: 'Коли ви створюєте акаунт та використовуєте Додаток, ми збираємо:',
      privCollectList: '<li><strong>Інформацію про акаунт</strong> — вашу електронну адресу та ім\'я користувача при реєстрації через email, або ім\'я та email вашого Google-акаунту при вході через Google.</li><li><strong>Ігрові дані</strong> — прогрес вежі, розблоковані поверхи, баланс монет та діамантів, покупки, досягнення, історію турнірів та ігрову статистику.</li><li><strong>Інформацію про пристрій</strong> — модель пристрою, версію операційної системи та версію Додатку для діагностики та сумісності.</li>',
      privH2Use: 'Як ми використовуємо вашу інформацію',
      privUseList: '<li>Для створення та управління вашим акаунтом.</li><li>Для синхронізації вашого прогресу між пристроями та сесіями.</li><li>Для безпечної автентифікації (Google OAuth, email + пароль).</li><li>Для надсилання транзакційних листів — підтвердження акаунту, посилань для скидання пароля та привітальних повідомлень.</li><li>Для відповіді на ваші запити в підтримку.</li><li>Для роботи функцій турнірів та таблиць лідерів.</li>',
      privH2Legal: 'Правова підстава обробки (GDPR)',
      privLegalBlock: '<p>Якщо ви знаходитесь в Європейському економічному просторі (ЄЕП) або Великій Британії, ми обробляємо ваші персональні дані на таких правових підставах:</p><ul><li><strong>Виконання договору</strong> — обробка, необхідна для надання Додатку та його функцій.</li><li><strong>Законні інтереси</strong> — обробка, необхідна для нашого законного інтересу в роботі та вдосконаленні Додатку, запобіганні шахрайству та забезпеченні безпеки.</li><li><strong>Правове зобов\'язання</strong> — де ми зобов\'язані обробляти дані відповідно до чинного законодавства.</li><li><strong>Згода</strong> — де ми отримали вашу явну згоду, яку ви можете відкликати в будь-який час без впливу на попередню обробку.</li></ul>',
      privH2Dont: 'Чого ми не робимо',
      privDontList: '<li>Ми не продаємо ваші персональні дані третім особам.</li><li>Ми не показуємо рекламу третіх сторін.</li><li>Ми не передаємо вашу інформацію нікому, крім інфраструктурних служб, необхідних для роботи Додатку (дивіться нижче).</li>',
      privH2Third: 'Сторонні сервіси',
      privThirdIntro: 'Ми використовуємо наступні сторонні сервіси для роботи Додатку. Кожен з них має власну політику конфіденційності щодо даних, які він обробляє.',
      privThirdList: '<li><strong>Google Sign-In (OAuth 2.0)</strong> — використовується як необов\'язковий метод автентифікації. Політика конфіденційності Google застосовується до процесу входу.</li><li><strong>Resend</strong> — використовується для доставки транзакційних листів (скидання пароля, привітання). Лише ваша електронна адреса передається для доставки.</li><li><strong>Sentry</strong> — використовується для звітування про збої та моніторингу помилок. Sentry може отримувати деталі помилок, інформацію про пристрій та анонімізовані ідентифікатори для діагностики. Дивіться <a href="https://sentry.io/privacy/" target="_blank" rel="noopener">sentry.io/privacy</a>.</li><li><strong>Хмарна інфраструктура</strong> — наш сервер, база даних (PostgreSQL) та кеш (Redis) розміщені на захищеній хмарній інфраструктурі. Ніякі персональні дані не передаються провайдеру понад необхідне для роботи сервісу.</li>',
      privH2Retention: 'Зберігання даних',
      privRetentionP: 'Дані вашого акаунту та ігровий прогрес зберігаються, поки ваш акаунт активний. Якщо ви видалите акаунт або попросите про видалення, ми видалимо вашу персональну інформацію протягом 30 днів, крім випадків, коли збереження вимагається законом.',
      privH2Transfers: 'Міжнародна передача даних',
      privTransfersP: 'Ваша інформація може бути передана та оброблена в країнах, що відрізняються від країни вашого проживання. Ці країни можуть мати закони про захист даних, що відрізняються від законів у вашій країні. Коли ми передаємо персональні дані з ЄЕП, Великої Британії або Швейцарії до країни без належного захисту даних, ми покладаємося на відповідні гарантії, такі як Стандартні договірні положення Європейської Комісії.',
      privH2Children: 'Конфіденційність дітей',
      privChildrenP: 'Додаток не призначений для дітей до 13 років. Ми свідомо не збираємо персональну інформацію дітей до 13 років. Якщо ви вважаєте, що дитина до 13 років надала нам персональну інформацію, зв\'яжіться з нами, і ми видалимо її негайно.',
      privH2Rights: 'Ваші права',
      privRightsBlock: '<p>Залежно від вашого місцезнаходження, ви можете мати такі права:</p><ul><li><strong>Право на доступ</strong> — запит на отримання копії персональних даних, які ми зберігаємо про вас.</li><li><strong>Право на виправлення</strong> — запит на виправлення неточних або неповних даних.</li><li><strong>Право на видалення</strong> («право бути забутим») — запит на видалення ваших персональних даних за певних обставин.</li><li><strong>Право на обмеження обробки</strong> — запит на обмеження способу використання ваших даних.</li><li><strong>Право на перенесення даних</strong> — отримання ваших даних у структурованому, машиночитаному форматі.</li><li><strong>Право на заперечення</strong> — заперечення проти обробки на основі наших законних інтересів.</li><li><strong>Право на відкликання згоди</strong> — відкликайте згоду в будь-який час без впливу на попередню обробку.</li><li><strong>Право на подачу скарги</strong> — зверніться до місцевого органу із захисту даних.</li></ul><p>Для реалізації будь-якого з цих прав зв\'яжіться з нами за адресою <a href="mailto:privacy@vibetower.app">privacy@vibetower.app</a>. Ми відповімо протягом 30 днів.</p>',
      privH2California: 'Права мешканців Каліфорнії (CCPA/CPRA)',
      privCaliforniaBlock: '<p>Якщо ви є резидентом Каліфорнії, CCPA з поправками CPRA надає вам додаткові права:</p><ul><li><strong>Право на інформацію</strong> — запит на розкриття категорій та конкретних фрагментів персональних даних, які ми збираємо, використовуємо та розкриваємо про вас.</li><li><strong>Право на видалення</strong> — запит на видалення ваших персональних даних з певними винятками.</li><li><strong>Право на виправлення</strong> — запит на виправлення неточних персональних даних.</li><li><strong>Право відмови від продажу</strong> — ми не продаємо ваші персональні дані.</li><li><strong>Право на недискримінацію</strong> — ми не будемо дискримінувати вас за реалізацію ваших прав CCPA.</li></ul><p>Для реалізації своїх прав зв\'яжіться з нами за адресою <a href="mailto:privacy@vibetower.app">privacy@vibetower.app</a>.</p>',
      privH2Security: 'Безпека',
      privSecurityP: 'Ми використовуємо галузеві стандарти для захисту вашої інформації, включаючи зашифровані з\'єднання (HTTPS), хешовані паролі та короткострокові токени автентифікації в Redis. Жоден метод передачі або зберігання даних не є на 100% безпечним; ми не можемо гарантувати абсолютну безпеку.',
      privH2Changes: 'Зміни до цієї Політики',
      privChangesP: 'Ми можемо час від часу оновлювати цю Політику. Коли ми це робимо, ми оновлюємо дату «оновлено» вгорі цієї сторінки. Продовження використання Додатку після набрання змін чинності означає прийняття оновленої Політики.',
      privH2Contact: 'Контакти',
      privContactP: 'Питання або запити щодо цієї Політики:',
      privContactLabel: 'Конфіденційність',
      // terms page
      termsH1: 'Умови обслуговування',
      termsDate: 'Оновлено: 19 жовтня 2026 р.',
      termsIntro: 'Ці Умови обслуговування («Умови») регулюють використання вами мобільного додатку Vibe Tower («Додаток»), яким керує Volodymyr Shmidt («ми», «нас» або «наш»). Завантажуючи або використовуючи Додаток, ви погоджуєтесь з цими Умовами. Якщо ви не погоджуєтесь, не використовуйте Додаток.',
      termsH2_1: '1. Вік користувача',
      termsP1: 'Вам повинно бути щонайменше 13 років для використання Додатку. Якщо вам від 13 до 18 років, вам необхідний дозвіл батьків або законного опікуна. Використовуючи Додаток, ви підтверджуєте, що відповідаєте цим вимогам.',
      termsH2_2: '2. Ваш акаунт',
      termsP2: 'Ви несете відповідальність за збереження безпеки облікових даних та за всі дії, що відбуваються у вашому акаунті. Негайно повідомте нас, якщо підозрюєте несанкціонований доступ. Ми залишаємо за собою право призупинити або видалити акаунти, що порушують ці Умови.',
      termsH2_3: '3. Віртуальна валюта та покупки',
      termsP3: 'Додаток містить віртуальні валюти (монети та діаманти) та необов\'язкові покупки всередині додатку. Усі покупки є остаточними і не підлягають поверненню, крім випадків, передбачених чинним законодавством або визначених на наш розсуд. Віртуальні валюти та предмети не мають реальної грошової цінності і не можуть бути обміняні на реальні гроші. Ми залишаємо за собою право змінювати, призупиняти або видаляти віртуальні предмети в будь-який час.',
      termsH2_4: '4. Допустиме використання',
      termsP4: 'Ви погоджуєтесь не:',
      termsUse4: '<li>Шахраювати, використовувати помилки або несанкціоновані сторонні інструменти для отримання несправедливої переваги.</li><li>Намагатись зворотно розробити, декомпілювати або модифікувати Додаток або його серверні компоненти.</li><li>Переслідувати, погрожувати або завдавати шкоди іншим гравцям.</li><li>Створювати кілька акаунтів для обходу блокувань або обмежень.</li><li>Втручатись у роботу або порушувати роботу серверів або мереж Додатку.</li><li>Використовувати Додаток в будь-яких незаконних цілях.</li>',
      termsH2_5: '5. Інтелектуальна власність',
      termsP5: 'Весь вміст Додатку — включаючи графіку, звуки, ігрову логіку та текст — є власністю Volodymyr Shmidt та захищений авторським правом та іншими законами про інтелектуальну власність. Ви не можете копіювати, розповсюджувати або створювати похідні роботи з будь-якого вмісту Додатку без нашого попереднього письмового дозволу.',
      termsH2_6: '6. Контент користувача',
      termsP6: 'Якщо Додаток дозволяє вам надсилати імена користувачів, повідомлення або інший контент, ви надаєте нам невиключну, безоплатну ліцензію на використання, відображення та обробку цього контенту для роботи Додатку. Ви несете виключну відповідальність за надісланий вами контент та погоджуєтесь не надсилати нічого незаконного, шкідливого або такого, що порушує права третіх осіб.',
      termsH2_7: '7. Припинення',
      termsP7: 'Ми можемо призупинити або припинити ваш доступ до Додатку в будь-який час, з попередженням або без, за будь-яке порушення цих Умов або з будь-якої іншої причини на наш розсуд. Після припинення ваше право на використання Додатку негайно припиняється.',
      termsH2_8: '8. Відмова від гарантій',
      termsP8: 'Додаток надається «як є» та «як доступний» без будь-якої гарантії, явної чи мається на увазі. Ми не гарантуємо, що Додаток буде безперервним, без помилок або вільним від шкідливих компонентів. Ви використовуєте Додаток на власний ризик.',
      termsH2_9: '9. Обмеження відповідальності',
      termsP9: 'У максимально допустимих межах, передбачених чинним законодавством, ми не несемо відповідальності за будь-які непрямі, випадкові, спеціальні, наслідкові або штрафні збитки, що виникають внаслідок використання або неможливості використання Додатку, навіть якщо нас попередили про можливість таких збитків.',
      termsH2_10: '10. Зміни до цих Умов',
      termsP10: 'Ми можемо змінювати ці Умови в будь-який час. Ми повідомимо вас про суттєві зміни, оновивши дату вгорі цієї сторінки. Продовження використання Додатку після змін означає прийняття оновлених Умов.',
      termsH2_11: '11. Застосовне право',
      termsP11: 'Ці Умови регулюються законами України, без урахування принципів колізії законів, крім випадків, коли місцеві закони про захист прав споживачів у вашій юрисдикції надають додаткові права.',
      termsH2_12: '12. Користувачі Apple App Store',
      termsP12: 'Якщо ви завантажили Додаток з Apple App Store, застосовуються наступні додаткові умови:',
      termsAppleList: '<li>Ці Умови є між вами та нами, а не з Apple Inc. («Apple»). Apple не несе відповідальності за Додаток або його вміст.</li><li>Apple не зобов\'язана надавати будь-які послуги з обслуговування або підтримки Додатку.</li><li>У разі будь-якої невідповідності Додатку застосовній гарантії, ви можете повідомити Apple, і Apple поверне вартість покупки (якщо є). Максимально дозволеним чинним законодавством Apple не має інших гарантійних зобов\'язань щодо Додатку.</li><li>Apple не несе відповідальності за розгляд будь-яких претензій від вас або третіх осіб щодо Додатку, включаючи: (i) претензії щодо відповідальності за якість продукту; (ii) претензії щодо невідповідності Додатку будь-яким застосовним вимогам законодавства; або (iii) претензії, що виникають відповідно до законодавства про захист прав споживачів.</li><li>У разі будь-якої претензії третьої сторони про те, що Додаток або ваше використання порушує права інтелектуальної власності цієї третьої сторони, Apple не нестиме відповідальності за розслідування, захист, врегулювання або розгляд такої претензії.</li><li>Apple та її дочірні компанії є третіми бенефіціарами цих Умов. Після вашого прийняття Apple матиме право застосовувати ці Умови проти вас як третій бенефіціар.</li><li>Ви також повинні дотримуватись застосовних умов обслуговування третіх осіб при використанні Додатку (наприклад, угода про послуги бездротового передавання даних).</li>',
      termsH2_13: '13. Користувачі Google Play',
      termsP13: 'Якщо ви завантажили Додаток з Google Play, застосовуються наступні додаткові умови:',
      termsGoogleList: '<li>Ці Умови є між вами та нами, а не з Google LLC («Google»). Google не несе відповідальності за Додаток або його вміст.</li><li>Google не зобов\'язана надавати будь-які послуги з обслуговування або підтримки Додатку.</li><li>Максимально дозволеним чинним законодавством Google не має жодних гарантійних зобов\'язань щодо Додатку.</li><li>Google не несе відповідальності за розгляд будь-яких претензій від вас або третіх осіб щодо Додатку, включаючи претензії щодо якості продукту, відповідності законодавству або захисту прав споживачів.</li><li>У разі будь-якої претензії третьої сторони щодо інтелектуальної власності Google не нестиме відповідальності за розслідування, захист, врегулювання або розгляд такої претензії.</li><li>Ви також повинні дотримуватись застосовних умов обслуговування третіх осіб при використанні Додатку.</li>',
      termsH2_14: '14. Ліцензія',
      termsP14: 'За умови дотримання цих Умов, ми надаємо вам обмежену, невиключну, непередавану, відкличну ліцензію на завантаження, встановлення та використання Додатку на пристрої, яким ви володієте або керуєте, виключно для ваших особистих, некомерційних цілей. Ця ліцензія не включає право на субліцензування, перепродаж, модифікацію, адаптацію, переклад, зворотне розроблення або створення похідних робіт з Додатку.',
      termsH2_15: '15. Відшкодування збитків',
      termsP15: 'Ви погоджуєтесь відшкодовувати, захищати та звільняти від відповідальності Volodymyr Shmidt та його афіліатів, посадових осіб, агентів та співробітників від будь-яких претензій, зобов\'язань, збитків, втрат та витрат, включаючи розумні гонорари адвокатів, що виникають у зв\'язку з: (а) вашим доступом до Додатку або його використанням; (б) вашим порушенням цих Умов; або (в) вашим порушенням будь-якого права третьої сторони, включаючи права інтелектуальної власності або приватності.',
      termsH2_16: '16. Загальні положення',
      termsGeneralBlock: '<p><strong>Подільність.</strong> Якщо будь-яке положення цих Умов буде визнано таким, що не підлягає виконанню або недійсним, воно буде змінено до мінімально необхідного ступеня або виключено, а решта положень залишаться чинними.</p><p><strong>Відмова від права.</strong> Невиконання нами будь-якого права або положення цих Умов не вважається відмовою від таких прав. Відмова від будь-якого порушення не є відмовою від подальших порушень.</p><p><strong>Повна угода.</strong> Ці Умови разом з нашою Політикою конфіденційності складають повну угоду між вами та нами щодо Додатку та замінюють усі попередні угоди та домовленості.</p><p><strong>Уступка.</strong> Ви не можете уступати або передавати ці Умови або будь-які права за ними без нашої попередньої письмової згоди. Ми можемо уступати ці Умови без обмежень.</p>',
      termsH2Contact: 'Контакти',
      termsContactP: 'Питання щодо цих Умов:',
      termsContactLabel: 'Юридичний відділ',
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
    var label = lang === 'uk' ? 'УК' : 'EN';
    document.querySelectorAll('#langBtn, #mobileLangBtn').forEach(function (b) { b.textContent = label; });
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

    // Lang toggle (desktop + mobile)
    document.querySelectorAll('#langBtn, #mobileLangBtn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var next = _lang === 'en' ? 'uk' : 'en';
        try { localStorage.setItem('vt-lang', next); } catch (e) {}
        applyLang(next);
        if (window.vtThemeApply) window.vtThemeApply();
      });
    });

    // Hamburger menu
    var burgerBtn  = document.getElementById('burgerBtn');
    var mobileMenu = document.getElementById('mobileMenu');
    if (burgerBtn && mobileMenu) {
      function closeMobileMenu() {
        mobileMenu.classList.remove('open');
        mobileMenu.setAttribute('aria-hidden', 'true');
        burgerBtn.setAttribute('aria-expanded', 'false');
        burgerBtn.textContent = '☰';
      }
      burgerBtn.addEventListener('click', function () {
        var isOpen = mobileMenu.classList.contains('open');
        if (isOpen) {
          closeMobileMenu();
        } else {
          mobileMenu.classList.add('open');
          mobileMenu.setAttribute('aria-hidden', 'false');
          burgerBtn.setAttribute('aria-expanded', 'true');
          burgerBtn.textContent = '✕';
        }
      });
      // Close button inside the menu
      var burgerClose = document.getElementById('burgerClose');
      if (burgerClose) burgerClose.addEventListener('click', closeMobileMenu);

      // Close when a nav link is tapped
      mobileMenu.querySelectorAll('a').forEach(function (a) {
        a.addEventListener('click', closeMobileMenu);
      });
      // Close on outside tap
      document.addEventListener('click', function (e) {
        if (!mobileMenu.contains(e.target) && e.target !== burgerBtn) {
          closeMobileMenu();
        }
      });
    }

    // Mobile theme button mirrors desktop theme button
    var mobileThemeBtn = document.getElementById('mobileThemeBtn');
    var desktopThemeBtn = document.getElementById('themeBtn');
    if (mobileThemeBtn && desktopThemeBtn) {
      mobileThemeBtn.addEventListener('click', function () {
        desktopThemeBtn.click();
        // sync label
        mobileThemeBtn.textContent = desktopThemeBtn.textContent;
      });
      // keep in sync when desktop applies theme
      var origApply = window.vtThemeApply;
      window.vtThemeApply = function () {
        if (origApply) origApply();
        mobileThemeBtn.textContent = desktopThemeBtn.textContent;
      };
    }
  });
})();
