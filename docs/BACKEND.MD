# Geolocation & Stats Backend

Бэкенд на **Node.js + Express + MongoDB** для работы с геолокацией пользователей, зарядными станциями, маршрутами, тепловыми картами и статистикой перемещений.

Подходит для картографических приложений (например, Monopiter).

---

## Возможности

* Отслеживание геопозиций пользователей
* Активные пользователи + расчёт средней скорости
* Маршруты за период
* Построение пользовательских маршрутов на карте и сохранение их в профиле
* Регистрация/вход пользователей и загрузка аватаров на сервер
* Тепловые карты:

  * по диапазону дат
  * месячные (предрасчитанные)
  * годовые (агрегация по месяцам)
* Работа с зарядными станциями:

  * создание / редактирование / удаление
  * загрузка фото (multer + sharp)
  * лайки и дизлайки
* Категории по дистанциям ("north/south")
* Топы по дистанциям (неделя, месяц)
* Проксирование аватарок с шифрованием URL
* Получение списка мастерских из другой БД

---

## Стек

| Технология         | Использование                        |
| ------------------ | ------------------------------------ |
| Node.js / Express  | HTTP API                             |
| MongoDB            | Хранение геоданных                   |
| haversine-distance | Вычисление расстояния по координатам |
| multer             | Загрузка изображений                 |
| sharp              | Обработка фото                       |
| node-fetch         | Проксирование URL                    |
| AES-256-CBC        | Шифрование URL аватарок              |
| dotenv             | Конфигурация                         |

---

## Установка

### 1. Клонирование

```bash
git clone <repo-url>
cd <project-folder>
npm install
```

### 2. Переменные окружения

Создать файл `.env` (значения можно скорректировать под своё окружение):

```env
PORT=5001
MONGO_URL=mongodb://localhost:27017
MONGO_DB_NAME=geolocation_db
API_BASE_URL=https://api.monopiter.ru
ENCRYPTION_KEY=<64 hex chars>    # AES-256 key, например 32 байта в hex
CENTER_LAT=59.9505               # Граница север/юг для расчётов
```

> **ENCRYPTION_KEY обязателен** — сервис не стартует, пока ключ не указан и не соответствует формату 32 байт в hex.

### 3. Запуск

```bash
npm start
```

По умолчанию сервер поднимется на `http://localhost:5001` (порт задаётся через `PORT`).

### 4. Тесты

```bash
npm test
```

Тесты написаны на Jest: проверяются утилиты (крипто-хелперы, расчёт периодов) и основные обработчики эндпоинтов (активные пользователи, зарядные станции, теплокарты/маршруты, статистика, мастерские). Новые сценарии добавляем в директорию `tests/`.

---

## Статические файлы

Папка: `./uploads`

Доступ:

```
GET /uploads/<filename>
```

Используется для фото зарядных станций.

---

## Профили пользователей и сохранённые маршруты

Чтобы сохранять вручную построенные маршруты на карте, добавлен набор эндпоинтов. Профиль и сохранённые маршруты хранятся прямо в документе `users` (отдельной коллекции `user_profiles` больше нет).

Основные сценарии:

* `GET /api/users/{userId}/profile` – получить профиль и список сохранённых маршрутов (если профиля ещё нет, вернётся пустой ответ).
* `PUT /api/users/{userId}/profile` – создать/обновить профиль (имя, город, модель моноколеса, аватар).
* `GET /api/users/{userId}/routes` – только список маршрутов.
* `POST /api/users/{userId}/routes` – сохранить новый маршрут. В теле запроса нужно передать `name` и `waypoints` (минимум две точки `{ latitude, longitude }`). Опционально можно указать `description`, `color`, `mapProvider`, `estimatedDurationMinutes`/`averageSpeedKmh`, `difficulty` (строковая метка сложности) и `surfaceTypes` (массив типов покрытия). Сервис посчитает длину маршрута, при необходимости возьмёт цвет маркера/провайдера карты.
* `DELETE /api/users/{userId}/routes/{routeId}` – удалить сохранённый маршрут из профиля.
* `POST /api/users/{userId}/avatar` – загрузить файлом новый аватар. Принимает `multipart/form-data` с полем `avatar` (до 5 МБ). Изображение масштабируется до 512×512, сохраняется в `uploads/avatars`, а ссылка автоматически пробрасывается в профиль и запись `users`.
* `DELETE /api/users/{userId}/avatar` – удалить текущий аватар (файл удаляется с диска, ссылки в коллекциях обнуляются).
* `POST /api/users/{userId}/routes/{routeId}/share` – создать короткую ссылку на конкретный маршрут (возвращается slug + shareUrl).
* `GET /api/shared-routes/{slug}` – получить данные маршрута по короткой ссылке (для фронта достаточно slug из URL).

### Короткие ссылки вне профиля

Для гостей или произвольных маршрутов есть отдельный API:

* `POST /api/shared-routes` – принимает весь payload (name, description, color, followRoads, routingProfile, waypoints, pathCoordinates, distance и т.д.) и возвращает `{ sharedId }`. Ссылку можно выдавать как `/#/?sharedId=abc123`.
* `GET /api/shared-routes` – каталог общественных маршрутов. Поддерживает `limit`, `offset`, фильтрацию по `authorId`, `visibility` и `bbox=minLon,minLat,maxLon,maxLat`. Возвращает метаданные (имя, описание, автор, дистанция, стартовая точка).
* `GET /api/shared-routes/{sharedId}` – отдаёт сохранённый маршрут или 404, если ссылка не найдена/просрочена.
* `DELETE /api/shared-routes/{sharedId}` – удалить ссылку (можно ограничить только авторами/админами).

Такие записи по умолчанию живут 30 дней. Если ссылка истекла, фронт получает 404 и предлагает построить маршрут заново.

## Оптимизация статистики и индексы

* При старте сервера автоматически создаются индексы MongoDB для `locations` (`{ userId: 1, timestamp: 1 }` и `{ timestamp: 1 }`), что значительно ускоряет выборки по пользователям и периодам.
* Популярные эндпоинты статистики (`/api/top-users/*`, `/api/total-distance/:period`, `/api/top-sessions/:period`, `/api/top-daily-distances/:period`, `/api/total-category-by-distance/:period`) кэшируются в памяти на 10 минут. Это избавляет от повторных тяжёлых агрегаций, пока данные не устареют.
* Логику кэша можно посмотреть в `src/services/cache.js`, а TTL/ключи настроить в `src/routes/stats.js`.

Пример запроса на сохранение маршрута:

```json
POST /api/users/42/routes
{
  "name": "Вечерняя покатушка",
  "description": "Маршрут по центру",
  "color": "#f03e3e",
  "waypoints": [
    { "latitude": 59.93, "longitude": 30.31 },
    { "latitude": 59.95, "longitude": 30.32 },
    { "latitude": 59.97, "longitude": 30.34 }
  ]
}
```

В ответ вернётся объект маршрута с рассчитанной дистанцией (км), опциональной длительностью и идентификатором `routeId`, который можно использовать для удаления.

---

## Регистрация и вход

Для полноценных профилей добавлен эндпоинт `POST /api/auth/register`. Он принимает:

* `userId` – числовой идентификатор (например, из Telegram).
* `email` – уникальный e-mail (используется как логин).
* `password` – минимум 8 символов (хэшируется через PBKDF2 перед сохранением).
* `username`, `city` – опционально, сразу же попадут в профиль.

Если пользователя ещё нет, создаётся запись в коллекции `users` вместе с профилем (поля `username`, `city`, `wheelModel`, `avatarUrl`, `routes: []`). Повторная регистрация с тем же `userId` или `email` вернёт `409 Conflict`.

После регистрации пользователь может авторизоваться через `POST /api/auth/login`, передав `email` и `password`. В ответ возвращается та же структура пользователя (ID, e-mail, username, avatarUrl, createdAt). Пока мы не выдаём JWT/сессии — фронт может использовать этот ответ для локального состояния.

---

## Основные коллекции MongoDB

### `locations` (geolocation_db.locations)

Хранит точки трекинга:

```json
{
  "userId": 123,
  "username": "John",
  "sessionId": 12,
  "latitude": 59.9,
  "longitude": 30.3,
  "timestamp": 1710000000,
  "avatarUrl": "https://..."
}
```

Используется для:

* активных пользователей
* маршрутов
* топов
* тепловых карт
* подсчёта north/south

---

### `charging_stations`

```json
{
  "latitude": 59.9,
  "longitude": 30.3,
  "comment": "Free charger",
  "photo": "https://.../uploads/img.jpg",
  "userId": 12,
  "addedBy": {},
  "addedAt": "2024-01-01",
  "is24Hours": true,
  "markerType": "blue",
  "isOffline": false,
  "likes": 0,
  "dislikes": 0,
  "likedBy": [],
  "dislikedBy": []
}
```

---

### `monthly_heatmaps`

Агрегированные точки:

```json
{
  "year": 2024,
  "month": 1,
  "heatmapData": [
    { "latitude": 59.9, "longitude": 30.3, "intensity": 42 }
  ]
}
```

---

### `workshops` (feedback_bot.workshops)

Список мастерских (структура свободная).

---

### `users`

Содержит данные о зарегистрированных пользователях, профиль и сохранённые маршруты:

```json
{
  "userId": 42,
  "email": "user@example.com",
  "username": "Alice",
  "avatarUrl": "https://...",
  "city": "Санкт-Петербург",
  "wheelModel": "Begode Master",
  "routes": [
    {
      "routeId": "66507bd3cfc47f66eaf004ce",
      "name": "Вечерняя покатушка",
      "distanceKm": 12.4,
      "durationMinutes": 45,
      "mapProvider": "custom",
      "color": "#f03e3e",
      "waypoints": [
        { "latitude": 59.93, "longitude": 30.31 }
      ],
      "createdAt": "2024-05-01T20:00:00.000Z"
    }
  ],
  "passwordHash": "<hex>",
  "passwordSalt": "<hex>",
  "passwordIterations": 150000,
  "passwordDigest": "sha256",
  "createdAt": "2024-05-01T20:00:00.000Z",
  "updatedAt": "2024-05-02T12:00:00.000Z"
}
```

Коллекция используется для регистрации и дальнейшей аутентификации (при необходимости). Пароли никогда не хранятся в открытом виде.

---

## 📘 API Documentation – OpenAPI (Swagger)

Полная спецификация доступна в файле:

```
openapi.yaml
```

Можно открыть через:

* [https://editor.swagger.io](https://editor.swagger.io)
* любой Swagger UI

Спецификация включает все эндпоинты:

* /api/active-users
* /api/charging-stations
* /api/heatmap
* /api/route/{userId}
* /api/top-users/*
* /api/total-distance/*
* /api/user-category-by-distance/*
* /api/top-sessions/*
* /api/top-daily-distances/*
* /secure-avatar/*
* /api/workshops
* /api/auth/register
* /api/auth/login
* /api/users/{userId}/avatar (POST/DELETE)

---

## 🧠 Логика расчётов

### Расстояния

Используется:

```
haversine(prev, curr)
```

Возвращает метры → обычно переводится в километры.

### Сессии

* раздельные по `sessionId`
* точки между сессиями не соединяются
* фильтр по времени между точками: `< 3600` секунд

### Неделя

Неделя = **Пн–Вс**
`this_week` и `last_week` вычисляются автоматически.

### North / South

Граница:

```
centerLat = 59.9505
```

Если `latitude >= centerLat` → north, иначе south.

---

## 🛠 Разработка и работа сервера

* Логи подключения MongoDB выводятся в консоль.
* При ошибке подключения — сервер завершает работу.
* Обновление тепловой карты:

  * текущий + предыдущий месяц
  * пересчитывается раз в 24 часа
