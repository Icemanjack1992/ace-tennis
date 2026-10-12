# Ace Tennis

Сообщество любителей тенниса Намангана: подтверждённые матчи и тренировки, рейтинг (Эло + уровень силы), лиги, очки сезона (весенний, летний, осенний, зимний) и года, Fair Play, поиск соперников, тренеры с отзывами, турниры на 8 игроков, новости, админ-панель.

Веб-приложение (PWA) без сборки: открывается в браузере и ставится на главный экран телефона.

## Режимы

- **Демо** — `js/config.js` пустой. Данные хранятся в браузере, есть тестовые игроки, тренеры и турнир. На экране входа — кнопки «Игрок / Тренер / Админ».
- **Рабочий** — в `js/config.js` вписаны адрес и публичный ключ Supabase. Вход по SMS, общая база.

## Запуск рабочей версии

1. **Supabase → SQL Editor** → вставить весь файл `supabase/schema.sql` → Run.
2. **Supabase → Database → Extensions** → включить `pg_cron`, затем в SQL Editor:
   ```sql
   select cron.schedule('expire-pending', '*/15 * * * *', 'select public.expire_pending()');
   select cron.schedule('season-daily', '5 19 * * *', 'select public.daily_season_job()');
   ```
3. **Supabase → Authentication → Providers → Phone** — включить вход по телефону и подключить SMS-сервис.
4. **Supabase → Project Settings → API** — скопировать *Project URL* и *anon public key* в `js/config.js`.
5. Зарегистрироваться в приложении своим номером, затем в SQL Editor сделать себя администратором:
   ```sql
   update public.profiles set role = 'admin' where phone = '+998XXXXXXXXX';
   ```
6. **Vercel → Add New Project** → выбрать репозиторий на GitHub → Deploy (настройки сборки не нужны).

## Структура

| Файл | Что внутри |
| --- | --- |
| `js/rating.js` | Формулы: Эло, уровень силы, лиги, очки сезона |
| `js/logic.js` | Правила: подтверждение, санкции, сетка турнира |
| `js/store-demo.js` | Демо-данные в браузере |
| `js/store-supabase.js` | Работа с Supabase |
| `js/views.js` | Все экраны |
| `supabase/schema.sql` | Таблицы, права доступа (RLS), серверные функции, задачи по расписанию |

Формулы в `js/rating.js` и `supabase/schema.sql` совпадают: пример из ТЗ (1 180 обыгрывает 1 300 → +21) проверен в обоих.
