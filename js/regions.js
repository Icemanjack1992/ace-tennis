// Regions of Uzbekistan and their cities / districts. Stored in the profile: region = code, district = Russian name.
// Fergana Valley first. [code, ru, uz, [[ru, uz], …]]
import { L } from './ui.js';

const R = (code, ru, uz, list) => ({ code, ru, uz, districts: list.map(([r, u]) => ({ ru: r, uz: u })) });

export const REGIONS = [
  R('namangan', 'Наманганская область', 'Namangan viloyati', [
    ['г. Наманган', 'Namangan shahri'], ['Касансайский район', 'Kosonsoy tumani'], ['Мингбулакский район', 'Mingbuloq tumani'],
    ['Наманганский район', 'Namangan tumani'], ['Нарынский район', 'Norin tumani'], ['Папский район', 'Pop tumani'],
    ['Туракурганский район', 'To‘raqo‘rg‘on tumani'], ['Уйчинский район', 'Uychi tumani'], ['Учкурганский район', 'Uchqo‘rg‘on tumani'],
    ['Чартакский район', 'Chortoq tumani'], ['Чустский район', 'Chust tumani'], ['Янгикурганский район', 'Yangiqo‘rg‘on tumani'],
  ]),
  R('andijan', 'Андижанская область', 'Andijon viloyati', [
    ['г. Андижан', 'Andijon shahri'], ['г. Ханабад', 'Xonobod shahri'], ['Алтынкульский район', 'Oltinko‘l tumani'],
    ['Андижанский район', 'Andijon tumani'], ['Асакинский район', 'Asaka tumani'], ['Балыкчинский район', 'Baliqchi tumani'],
    ['Бозский район', 'Bo‘z tumani'], ['Булакбашинский район', 'Buloqboshi tumani'], ['Джалакудукский район', 'Jalaquduq tumani'],
    ['Избасканский район', 'Izboskan tumani'], ['Кургантепинский район', 'Qo‘rg‘ontepa tumani'], ['Мархаматский район', 'Marhamat tumani'],
    ['Пахтаабадский район', 'Paxtaobod tumani'], ['Улугнорский район', 'Ulug‘nor tumani'], ['Ходжаабадский район', 'Xo‘jaobod tumani'],
    ['Шахриханский район', 'Shahrixon tumani'],
  ]),
  R('fergana', 'Ферганская область', 'Farg‘ona viloyati', [
    ['г. Фергана', 'Farg‘ona shahri'], ['г. Коканд', 'Qo‘qon shahri'], ['г. Маргилан', 'Marg‘ilon shahri'], ['г. Кувасай', 'Quvasoy shahri'],
    ['Алтыарыкский район', 'Oltiariq tumani'], ['Багдадский район', 'Bag‘dod tumani'], ['Бешарыкский район', 'Beshariq tumani'],
    ['Бувайдинский район', 'Buvayda tumani'], ['Дангаринский район', 'Dang‘ara tumani'], ['Кувинский район', 'Quva tumani'],
    ['Куштепинский район', 'Qo‘shtepa tumani'], ['Риштанский район', 'Rishton tumani'], ['Сохский район', 'So‘x tumani'],
    ['Ташлакский район', 'Toshloq tumani'], ['Узбекистанский район', 'O‘zbekiston tumani'], ['Учкуприкский район', 'Uchko‘prik tumani'],
    ['Ферганский район', 'Farg‘ona tumani'], ['Фуркатский район', 'Furqat tumani'], ['Язъяванский район', 'Yozyovon tumani'],
  ]),
  R('tashkent_city', 'г. Ташкент', 'Toshkent shahri', [
    ['Алмазарский район', 'Olmazor tumani'], ['Бектемирский район', 'Bektemir tumani'], ['Мирабадский район', 'Mirobod tumani'],
    ['Мирзо-Улугбекский район', 'Mirzo Ulug‘bek tumani'], ['Сергелийский район', 'Sergeli tumani'], ['Учтепинский район', 'Uchtepa tumani'],
    ['Чиланзарский район', 'Chilonzor tumani'], ['Шайхантахурский район', 'Shayxontohur tumani'], ['Юнусабадский район', 'Yunusobod tumani'],
    ['Яккасарайский район', 'Yakkasaroy tumani'], ['Янгихаётский район', 'Yangihayot tumani'], ['Яшнабадский район', 'Yashnobod tumani'],
  ]),
  R('tashkent', 'Ташкентская область', 'Toshkent viloyati', [
    ['г. Нурафшан', 'Nurafshon shahri'], ['г. Алмалык', 'Olmaliq shahri'], ['г. Ангрен', 'Angren shahri'], ['г. Ахангаран', 'Ohangaron shahri'],
    ['г. Бекабад', 'Bekobod shahri'], ['г. Чирчик', 'Chirchiq shahri'], ['г. Янгиюль', 'Yangiyo‘l shahri'],
    ['Аккурганский район', 'Oqqo‘rg‘on tumani'], ['Ахангаранский район', 'Ohangaron tumani'], ['Бекабадский район', 'Bekobod tumani'],
    ['Бостанлыкский район', 'Bo‘stonliq tumani'], ['Букинский район', 'Bo‘ka tumani'], ['Зангиатинский район', 'Zangiota tumani'],
    ['Кибрайский район', 'Qibray tumani'], ['Куйичирчикский район', 'Quyichirchiq tumani'], ['Паркентский район', 'Parkent tumani'],
    ['Пскентский район', 'Piskent tumani'], ['Ташкентский район', 'Toshkent tumani'], ['Уртачирчикский район', 'O‘rtachirchiq tumani'],
    ['Чиназский район', 'Chinoz tumani'], ['Юкоричирчикский район', 'Yuqorichirchiq tumani'], ['Янгиюльский район', 'Yangiyo‘l tumani'],
  ]),
  R('samarkand', 'Самаркандская область', 'Samarqand viloyati', [
    ['г. Самарканд', 'Samarqand shahri'], ['г. Каттакурган', 'Kattaqo‘rg‘on shahri'], ['Акдарьинский район', 'Oqdaryo tumani'],
    ['Булунгурский район', 'Bulung‘ur tumani'], ['Джамбайский район', 'Jomboy tumani'], ['Иштыханский район', 'Ishtixon tumani'],
    ['Каттакурганский район', 'Kattaqo‘rg‘on tumani'], ['Кошрабадский район', 'Qo‘shrabot tumani'], ['Нарпайский район', 'Narpay tumani'],
    ['Нурабадский район', 'Nurobod tumani'], ['Пайарыкский район', 'Payariq tumani'], ['Пастдаргомский район', 'Pastdarg‘om tumani'],
    ['Пахтачийский район', 'Paxtachi tumani'], ['Самаркандский район', 'Samarqand tumani'], ['Тайлакский район', 'Toyloq tumani'],
    ['Ургутский район', 'Urgut tumani'],
  ]),
  R('bukhara', 'Бухарская область', 'Buxoro viloyati', [
    ['г. Бухара', 'Buxoro shahri'], ['г. Каган', 'Kogon shahri'], ['Алатский район', 'Olot tumani'], ['Бухарский район', 'Buxoro tumani'],
    ['Вабкентский район', 'Vobkent tumani'], ['Гиждуванский район', 'G‘ijduvon tumani'], ['Жондорский район', 'Jondor tumani'],
    ['Каганский район', 'Kogon tumani'], ['Каракульский район', 'Qorako‘l tumani'], ['Караулбазарский район', 'Qorovulbozor tumani'],
    ['Пешкунский район', 'Peshku tumani'], ['Ромитанский район', 'Romitan tumani'], ['Шафирканский район', 'Shofirkon tumani'],
  ]),
  R('jizzakh', 'Джизакская область', 'Jizzax viloyati', [
    ['г. Джизак', 'Jizzax shahri'], ['Арнасайский район', 'Arnasoy tumani'], ['Бахмальский район', 'Baxmal tumani'],
    ['Галляаральский район', 'G‘allaorol tumani'], ['Дустликский район', 'Do‘stlik tumani'], ['Зааминский район', 'Zomin tumani'],
    ['Зарбдарский район', 'Zarbdor tumani'], ['Зафарабадский район', 'Zafarobod tumani'], ['Мирзачульский район', 'Mirzacho‘l tumani'],
    ['Пахтакорский район', 'Paxtakor tumani'], ['Фаришский район', 'Forish tumani'], ['Шараф-Рашидовский район', 'Sharof Rashidov tumani'],
    ['Янгиабадский район', 'Yangiobod tumani'],
  ]),
  R('kashkadarya', 'Кашкадарьинская область', 'Qashqadaryo viloyati', [
    ['г. Карши', 'Qarshi shahri'], ['г. Шахрисабз', 'Shahrisabz shahri'], ['Гузарский район', 'G‘uzor tumani'],
    ['Дехканабадский район', 'Dehqonobod tumani'], ['Камашинский район', 'Qamashi tumani'], ['Каршинский район', 'Qarshi tumani'],
    ['Касанский район', 'Koson tumani'], ['Касбийский район', 'Kasbi tumani'], ['Китабский район', 'Kitob tumani'],
    ['Кукдалинский район', 'Ko‘kdala tumani'], ['Миришкорский район', 'Mirishkor tumani'], ['Мубарекский район', 'Muborak tumani'],
    ['Нишанский район', 'Nishon tumani'], ['Чиракчинский район', 'Chiroqchi tumani'], ['Шахрисабзский район', 'Shahrisabz tumani'],
    ['Яккабагский район', 'Yakkabog‘ tumani'],
  ]),
  R('navoi', 'Навоийская область', 'Navoiy viloyati', [
    ['г. Навои', 'Navoiy shahri'], ['г. Зарафшан', 'Zarafshon shahri'], ['Канимехский район', 'Konimex tumani'],
    ['Карманинский район', 'Karmana tumani'], ['Кызылтепинский район', 'Qiziltepa tumani'], ['Навбахорский район', 'Navbahor tumani'],
    ['Нуратинский район', 'Nurota tumani'], ['Тамдынский район', 'Tomdi tumani'], ['Учкудукский район', 'Uchquduq tumani'],
    ['Хатырчинский район', 'Xatirchi tumani'],
  ]),
  R('surkhandarya', 'Сурхандарьинская область', 'Surxondaryo viloyati', [
    ['г. Термез', 'Termiz shahri'], ['Алтынсайский район', 'Oltinsoy tumani'], ['Ангорский район', 'Angor tumani'],
    ['Бандихонский район', 'Bandixon tumani'], ['Байсунский район', 'Boysun tumani'], ['Денауский район', 'Denov tumani'],
    ['Джаркурганский район', 'Jarqo‘rg‘on tumani'], ['Кизирикский район', 'Qiziriq tumani'], ['Кумкурганский район', 'Qumqo‘rg‘on tumani'],
    ['Музрабадский район', 'Muzrabot tumani'], ['Сариасийский район', 'Sariosiyo tumani'], ['Термезский район', 'Termiz tumani'],
    ['Узунский район', 'Uzun tumani'], ['Шерабадский район', 'Sherobod tumani'], ['Шурчинский район', 'Sho‘rchi tumani'],
  ]),
  R('syrdarya', 'Сырдарьинская область', 'Sirdaryo viloyati', [
    ['г. Гулистан', 'Guliston shahri'], ['г. Янгиер', 'Yangiyer shahri'], ['г. Ширин', 'Shirin shahri'],
    ['Акалтынский район', 'Oqoltin tumani'], ['Баяутский район', 'Boyovut tumani'], ['Гулистанский район', 'Guliston tumani'],
    ['Мирзаабадский район', 'Mirzaobod tumani'], ['Сайхунабадский район', 'Sayxunobod tumani'], ['Сардобинский район', 'Sardoba tumani'],
    ['Сырдарьинский район', 'Sirdaryo tumani'], ['Хавастский район', 'Xovos tumani'],
  ]),
  R('khorezm', 'Хорезмская область', 'Xorazm viloyati', [
    ['г. Ургенч', 'Urganch shahri'], ['г. Хива', 'Xiva shahri'], ['Багатский район', 'Bog‘ot tumani'], ['Гурленский район', 'Gurlan tumani'],
    ['Кошкупырский район', 'Qo‘shko‘pir tumani'], ['Тупроккалинский район', 'Tuproqqal’a tumani'], ['Ургенчский район', 'Urganch tumani'],
    ['Хазараспский район', 'Hazorasp tumani'], ['Ханкинский район', 'Xonqa tumani'], ['Хивинский район', 'Xiva tumani'],
    ['Шаватский район', 'Shovot tumani'], ['Янгиарыкский район', 'Yangiariq tumani'], ['Янгибазарский район', 'Yangibozor tumani'],
  ]),
  R('karakalpakstan', 'Республика Каракалпакстан', 'Qoraqalpog‘iston Respublikasi', [
    ['г. Нукус', 'Nukus shahri'], ['Амударьинский район', 'Amudaryo tumani'], ['Берунийский район', 'Beruniy tumani'],
    ['Бозатауский район', 'Bo‘zatov tumani'], ['Канлыкульский район', 'Qanliko‘l tumani'], ['Караузякский район', 'Qorao‘zak tumani'],
    ['Кегейлийский район', 'Kegeyli tumani'], ['Кунградский район', 'Qo‘ng‘irot tumani'], ['Муйнакский район', 'Mo‘ynoq tumani'],
    ['Нукусский район', 'Nukus tumani'], ['Тахиаташский район', 'Taxiatosh tumani'], ['Тахтакупырский район', 'Taxtako‘pir tumani'],
    ['Турткульский район', 'To‘rtko‘l tumani'], ['Ходжейлийский район', 'Xo‘jayli tumani'], ['Чимбайский район', 'Chimboy tumani'],
    ['Шуманайский район', 'Shumanay tumani'], ['Элликкалинский район', 'Ellikqal’a tumani'],
  ]),
];

export const region = (code) => REGIONS.find((r) => r.code === code) || null;
export const regionName = (code) => { const r = region(code); return r ? L(r.ru, r.uz) : ''; };
// Short: 'Наманганская' / 'Namangan'; the capital is written in full
export const regionShort = (code) => {
  const r = region(code); if (!r) return '';
  return code === 'tashkent_city' ? L('Ташкент', 'Toshkent') : code === 'karakalpakstan' ? L('Каракалпакстан', 'Qoraqalpog‘iston') : L(r.ru.replace(' область', ''), r.uz.replace(' viloyati', ''));
};
export const districtName = (v, code) => {
  const list = code ? (region(code)?.districts || []) : REGIONS.flatMap((r) => r.districts);
  const d = list.find((x) => x.ru === v);
  return d ? L(d.ru, d.uz) : (v || '');
};
// Region of an old profile that has only a district (all old districts are in Namangan region)
export const regionOf = (u) => u?.region || (REGIONS.find((r) => r.districts.some((d) => d.ru === u?.district))?.code ?? '');
