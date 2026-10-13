// User agreement (public offer). Changing the text → raise TERMS_VERSION in ui.js: everyone accepts the new version once.
import { L, esc, getLang, TERMS_VERSION } from './ui.js';

export { TERMS_VERSION };

const contact = () => {
  const c = (window.ACE_CONFIG || {}).contactEmail;
  return c ? L(` по почте ${c}`, ` ${c} pochtasi orqali`) : '';
};

const RU = () => [
  ['1. Что это за соглашение', [
    'Это публичная оферта администрации сервиса Ace Tennis (сайт и приложение ace-tennis.uz). Ставя отметку «Принимаю» при заполнении анкеты или заявки тренера, вы полностью принимаете эти условия (статьи 367 и 369 Гражданского кодекса Республики Узбекистан). Если вы не согласны — не пользуйтесь сервисом.',
    'Ace Tennis — бесплатная информационная платформа для любителей тенниса и тренеров: профиль, поиск соперников, учёт матчей и тренировок, рейтинг, турниры и новости.',
  ]],
  ['2. Регистрация и возраст', [
    'Пользоваться сервисом можно с 16 лет. Если вам меньше 18 лет, вы подтверждаете, что родители (законные представители) знают об этом и согласны с условиями.',
    'Указывайте о себе правдивые данные. Один человек — один аккаунт. Вы отвечаете за сохранность своего пароля.',
  ]],
  ['3. Здоровье и риски', [
    'Теннис — физическая нагрузка с риском травм. Вы сами оцениваете состояние своего здоровья и при сомнениях советуетесь с врачом.',
    'Вы играете и тренируетесь добровольно и на свой риск. Администрация не организует ваши встречи, не владеет кортами и не отвечает за травмы, вред здоровью или имуществу, состояние кортов и инвентаря, погоду и действия других людей — в пределах, допустимых законом.',
  ]],
  ['4. Встречи с другими пользователями', [
    'Время, место и условия игры вы согласуете сами. Администрация не проверяет личность пользователей. Встречайтесь в общественных местах, на кортах, и не передавайте деньги незнакомым людям.',
    'Номер телефона другие игроки видят только если вы сами решили его показать при вызове на матч.',
  ]],
  ['5. Для тренеров', [
    'Тренер — самостоятельное лицо, а не сотрудник или представитель Ace Tennis. Тренер сам отвечает за свою квалификацию, безопасность занятий, законность своей деятельности и уплату налогов.',
    'Оплата занятий — напрямую между тренером и учеником, администрация в расчётах не участвует. Цена в профиле — справочная.',
    'Занятия с детьми — только с согласия родителей (законных представителей).',
    'Отметка «тренер» означает только, что администрация связалась с вами. Это не гарантия квалификации для учеников.',
  ]],
  ['6. Правила поведения', [
    'Записывайте только реально сыгранные матчи и честный счёт, уважайте соперников. Запрещены оскорбления, угрозы, спам, реклама без разрешения, чужие фото и выдуманные матчи.',
    'За нарушения администрация может снизить оценку Fair Play, отменить результаты, временно ограничить или заблокировать аккаунт.',
  ]],
  ['7. Рейтинг, очки и награды', [
    'Уровень силы, очки, лиги, кубки и титулы — игровые показатели. Они не имеют денежной стоимости и не являются призами. При ошибках или нарушениях администрация может их пересчитать.',
    'Призы спонсоров, если они есть, вручаются по условиям конкретного турнира.',
  ]],
  ['8. Персональные данные', [
    'Мы обрабатываем: имя, фамилию, фото, пол, год рождения, район, номер телефона, адрес почты, удобное время игры, результаты матчей и тренировок, отзывы и комментарии.',
    'Цели: работа сервиса — поиск соперников, рейтинг, турниры, связь администрации с вами, безопасность. Другим пользователям видны имя, фото, район, уровень и статистика. Телефон и почту видит только администратор; телефон соперник видит только с вашего согласия.',
    'Данные хранятся у поставщика облачной базы данных (Supabase) на серверах за пределами Узбекистана. Принимая соглашение, вы даёте согласие на обработку ваших персональных данных и на их трансграничную передачу для этих целей (Закон Республики Узбекистан «О персональных данных»).',
    'Вы можете исправить данные в анкете в любой момент или попросить администратора удалить аккаунт — данные удаляются, кроме записей о матчах с другими игроками, которые нужны для их рейтинга (без вашего имени).',
  ]],
  ['9. Фото, комментарии и новости', [
    'Вы отвечаете за то, что публикуете, и разрешаете показывать это внутри приложения. Мировые новости — это заголовки и короткие анонсы со ссылкой на источник. Права на эти материалы принадлежат их авторам.',
  ]],
  ['10. Ответственность', [
    'Сервис бесплатный и работает «как есть». Возможны перерывы и ошибки. Администрация не отвечает за упущенную выгоду и косвенные убытки.',
  ]],
  ['11. Изменения и споры', [
    'Администрация может менять соглашение. О новой версии приложение сообщит, и её нужно будет принять заново.',
    `Действует законодательство Республики Узбекистан. Споры решаются переговорами${contact()}, а если договориться не удалось — в суде.`,
  ]],
];

const UZ = () => [
  ['1. Bu qanday kelishuv', [
    'Bu Ace Tennis xizmati (ace-tennis.uz sayti va ilovasi) ma’muriyatining ommaviy ofertasi. Anketa yoki murabbiy arizasini to‘ldirishda «Qabul qilaman» belgisini qo‘yib, siz ushbu shartlarni to‘liq qabul qilasiz (O‘zbekiston Respublikasi Fuqarolik kodeksining 367 va 369-moddalari). Rozi bo‘lmasangiz, xizmatdan foydalanmang.',
    'Ace Tennis — tennis havaskorlari va murabbiylar uchun bepul axborot platformasi: profil, raqib qidirish, o‘yin va mashg‘ulotlar hisobi, reyting, turnirlar va yangiliklar.',
  ]],
  ['2. Ro‘yxatdan o‘tish va yosh', [
    'Xizmatdan 16 yoshdan foydalanish mumkin. 18 yoshga to‘lmagan bo‘lsangiz, ota-onangiz (qonuniy vakillaringiz) bundan xabardor va shartlarga rozi ekanini tasdiqlaysiz.',
    'O‘zingiz haqingizda haqiqiy ma’lumot kiriting. Bir kishi — bitta akkaunt. Parolingiz xavfsizligi uchun o‘zingiz javobgarsiz.',
  ]],
  ['3. Sog‘liq va xavflar', [
    'Tennis — jarohat xavfi bor jismoniy yuklama. Sog‘lig‘ingizni o‘zingiz baholaysiz, shubha bo‘lsa shifokor bilan maslahatlashing.',
    'Siz ixtiyoriy va o‘z tavakkalingizga o‘ynaysiz. Ma’muriyat uchrashuvlaringizni tashkil qilmaydi, kortlarga egalik qilmaydi va qonun ruxsat bergan doirada jarohatlar, sog‘liq yoki mulkka zarar, kort va jihozlar holati, ob-havo va boshqa odamlarning harakatlari uchun javob bermaydi.',
  ]],
  ['4. Boshqa foydalanuvchilar bilan uchrashuv', [
    'O‘yin vaqti, joyi va shartlarini o‘zingiz kelishasiz. Ma’muriyat foydalanuvchilar shaxsini tekshirmaydi. Jamoat joylarida, kortlarda uchrashing va notanish odamlarga pul bermang.',
    'Telefon raqamingizni boshqalar faqat o‘yinga chaqiruvda o‘zingiz ko‘rsatishga qaror qilsangiz ko‘radi.',
  ]],
  ['5. Murabbiylar uchun', [
    'Murabbiy — Ace Tennis xodimi yoki vakili emas, mustaqil shaxs. Malakasi, mashg‘ulotlar xavfsizligi, faoliyatining qonuniyligi va soliqlar uchun o‘zi javob beradi.',
    'Mashg‘ulot uchun to‘lov murabbiy va o‘quvchi o‘rtasida bevosita amalga oshiriladi, ma’muriyat hisob-kitobda qatnashmaydi. Profildagi narx ma’lumot uchun.',
    'Bolalar bilan mashg‘ulotlar — faqat ota-ona (qonuniy vakillar) roziligi bilan.',
    '«Murabbiy» belgisi faqat ma’muriyat siz bilan bog‘langanini bildiradi, o‘quvchilar uchun malaka kafolati emas.',
  ]],
  ['6. Xulq-atvor qoidalari', [
    'Faqat haqiqatan o‘ynalgan o‘yinlar va halol hisobni yozing, raqiblarni hurmat qiling. Haqorat, tahdid, spam, ruxsatsiz reklama, begona rasmlar va to‘qima o‘yinlar taqiqlanadi.',
    'Qoidabuzarlik uchun ma’muriyat Fair Play bahosini pasaytirishi, natijalarni bekor qilishi, akkauntni vaqtincha cheklashi yoki bloklashi mumkin.',
  ]],
  ['7. Reyting, ochkolar va mukofotlar', [
    'Kuch darajasi, ochkolar, ligalar, kuboklar va unvonlar — o‘yin ko‘rsatkichlari. Ularning pul qiymati yo‘q va ular sovrin emas. Xato yoki qoidabuzarlik bo‘lsa, ma’muriyat ularni qayta hisoblashi mumkin.',
    'Homiylar sovrinlari, agar bo‘lsa, aniq turnir shartlariga ko‘ra beriladi.',
  ]],
  ['8. Shaxsiy ma’lumotlar', [
    'Biz quyidagilarni qayta ishlaymiz: ism, familiya, rasm, jins, tug‘ilgan yil, tuman, telefon raqami, pochta manzili, qulay vaqt, o‘yin va mashg‘ulot natijalari, sharh va izohlar.',
    'Maqsad: xizmat ishlashi — raqib qidirish, reyting, turnirlar, ma’muriyatning siz bilan aloqasi, xavfsizlik. Boshqa foydalanuvchilarga ism, rasm, tuman, daraja va statistika ko‘rinadi. Telefon va pochtani faqat administrator ko‘radi; raqib telefoningizni faqat roziligingiz bilan ko‘radi.',
    'Ma’lumotlar bulutli ma’lumotlar bazasi yetkazib beruvchisida (Supabase) O‘zbekistondan tashqaridagi serverlarda saqlanadi. Kelishuvni qabul qilib, siz shaxsiy ma’lumotlaringizni shu maqsadlarda qayta ishlash va transchegaraviy uzatishga rozilik berasiz («Shaxsga doir ma’lumotlar to‘g‘risida»gi O‘zbekiston Respublikasi Qonuni).',
    'Ma’lumotlarni anketada istalgan vaqtda o‘zgartirishingiz yoki administratordan akkauntni o‘chirishni so‘rashingiz mumkin — boshqa o‘yinchilar reytingi uchun kerak bo‘lgan o‘yin yozuvlaridan tashqari (ismingizsiz) ma’lumotlar o‘chiriladi.',
  ]],
  ['9. Rasmlar, izohlar va yangiliklar', [
    'E’lon qilgan narsangiz uchun o‘zingiz javobgarsiz va uni ilova ichida ko‘rsatishga ruxsat berasiz. Jahon yangiliklari — manbaga havola bilan sarlavha va qisqa annotatsiyalar, ularga huquqlar mualliflarga tegishli.',
  ]],
  ['10. Javobgarlik', [
    'Xizmat bepul va «boricha» ishlaydi, uzilishlar va xatolar bo‘lishi mumkin. Ma’muriyat boy berilgan foyda va bilvosita zararlar uchun javob bermaydi.',
  ]],
  ['11. O‘zgarishlar va nizolar', [
    'Ma’muriyat kelishuvni o‘zgartirishi mumkin. Yangi versiya haqida ilova xabar beradi va uni qaytadan qabul qilish kerak bo‘ladi.',
    `O‘zbekiston Respublikasi qonunchiligi amal qiladi. Nizolar muzokaralar yo‘li bilan${contact()}, kelishilmasa — sudda hal qilinadi.`,
  ]],
];

export const termsTitle = () => L('Пользовательское соглашение', 'Foydalanuvchi kelishuvi');

export function termsHtml() {
  const parts = getLang() === 'uz' ? UZ() : RU();
  return `<div class="muted small">${L('Редакция от', 'Tahrir sanasi')} ${TERMS_VERSION.split('-').reverse().join('.')}</div>
    ${parts.map(([h, ps]) => `<h3 class="strong" style="margin:16px 0 6px">${esc(h)}</h3>${ps.map((p) => `<p style="margin:0 0 8px;line-height:1.5">${esc(p)}</p>`).join('')}`).join('')}`;
}
