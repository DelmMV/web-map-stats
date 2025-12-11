# Архитектурный гайд фронтенда

Файл описывает, как устроен текущий фронт, чтобы держать единый порядок при доработках.

## Стек и точка входа
- Vite + React 18, Chakra UI для контролов, Leaflet для карт, React Query для кешируемых запросов.
- `src/main.jsx` рендерит `<App />` внутри `StrictMode`, регистрирует PWA Service Worker.
- `App.jsx` оборачивает все в `QueryClientProvider` + `ChakraProvider`, включает HashRouter и общие проверки авторизации.

## Слои и директории
- `pages/` – тонкие врапперы для роутинга (`/`, `/weekly-stats`, `/top-users`, `/auth`). Логику держим в корневых компонентных файлах (`UserMap.jsx`, `WeeklyStats.jsx`, `TopUsers.jsx` и т.д.).
- `components/` – переиспользуемые блоки (модалки станций, панель ручного маршрута, контролы карты, кастомные маркеры/кластеры, логин-виджет Telegram).
- `hooks/` – бизнес-логика и комплексное состояние. Сюда относится вся работа с ручными маршрутами (`useManualRoute*`), виртуализация маркеров, пропсы для бургер-меню, Telegram тема/пользователь и т.д.
- `services/` – слой общения с API. Каждая функция отвечает за один HTTP вызов, использует `API_CONFIG.BASE_URL`, парсит ответ и кидает осмысленные ошибки. React Query оборачивает только там, где есть очевидный кеш (например, `useActiveUsers`).
- `utils/` – чистые утилиты (config, сериализация/десериализация шаринга маршрутов, профили маршрутов, форматтеры).
- `styles/`, `theme/` – CSS-переменные и кастомная тема Chakra (`theme/chakraTheme.js` синхронизирован с CSS переменными и Telegram WebApp темой).
- `assets/` – статические иконки/картинки.
- `docs/` – текстовая документация (бэкенд, OpenAPI, этот гайд).

## Роутинг и оболочка приложения
- HashRouter нужен для работы внутри Telegram WebApp.
- `NavBar` показывается только для авторизованных (или в dev режиме с подставленным пользователем).
- Для дев-режима включены dev-индикатор, автологин через `APP_CONFIG.development.defaultUser` и логгер `devLog`.

## Авторизация и хранение состояния
- Основной вариант – Telegram WebApp (`window.Telegram.WebApp.initDataUnsafe`). Фолбэк – ручной логин/регистрация через форму, которая бьёт в `POST /api/auth/register` и `POST /api/auth/login`.
- Ключи в `localStorage`: `webmap_auth_v1` (пользователь + токен), `webmap_guest_mode`, `webmap_skip_dev_autologin`.
- Гостевой режим включается при наличии расшаренных маршрутов в URL или по явному выбору; из гостя переходим в `/auth`.

## Работа с API
- Базовый URL задаётся в `src/utils/config.js` (`API_CONFIG.BASE_URL`). По умолчанию локальный `http://localhost:5001/api`.
- Паттерн сервиса: в модуле `services/<domain>Service.js` объявляем функции `fetch.../save.../delete...` с единым разбором ответа (`parseResponse` в `profileService.js` – пример). Не смешиваем HTTP внутри компонентов.
- Доступ к аватаркам идёт через зашифрованный URL и прокси-эндпоинт `/secure-avatar/{encryptedUrl}`.
- Для новых эндпоинтов: добавляем функцию в нужный сервис, не смешиваем HTTP в компонентах/хуках, типовые параметры (`userId`, `routeId`, фильтры) валидируем в сервисе и бросаем понятные ошибки.
- Кешируемые запросы заворачиваем в React Query хуки (см. `useActiveUsers`), остальное вызываем напрямую из хука/эффекта и храним результат в стейте.

## Карта и работа с геоданными
- Основная сцена – `src/UserMap.jsx`. Она управляет слоями Leaflet, активными пользователями, тепловыми картами, зарядками/мастерскими, сохранёнными маршрутами и ручным построителем маршрутов.
- Маркеры:
  - Активные пользователи – кастомные div-маркеры с кластеризацией и анимацией, группы формируются вручную.
  - Зарядки/интересные места/опасности/чаты – через сервисы, могут фильтроваться и частично виртуализируются (`useMarkerVirtualization`).
  - Точки/подписи ручных маршрутов – divIcon с цветом маршрута.
- Рендер оптимизирован через `memo`, собственные кластеры и локальные кеши путей маршрутов в `localStorage` (`ROUTE_PATH_CACHE_KEY`).
- Тепловые карты и слои погоды – данные приходят из соответствующих сервисов (`heatmapService`, `weatherService`), подмешиваются как Leaflet слои.

## Ручные маршруты – разбиение по ответственности
- Состояние: `useManualRouteState` держит флаги режима, точки, путь, метаданные (включая цвет, провайдера карты, профиль маршрута), статус сохранения.
- Производные данные: `useManualRouteDerived` вычисляет positions, дистанции, состояния кнопок/панели.
- Действия: `useManualRouteActions` (очистка/undo/toggle/edit), `useManualRouteEditing` (добавление/удаление/перетаскивание точек), `useManualRoutePath` (строит путь по дорогам либо прямыми отрезками), `useManualRouteSaving` (формирует payload, дергает `saveUserRoute`, обновляет список сохранённых и видимых маршрутов).
- UI: `ManualRoutePanel` читает данные из вышеуказанных хуков и показывает контролы; подсказки по дистанциям и точкам идут из derived-значений.
- Шаринг: `utils/sharedRoute.js` сериализует маршрут в компактный параметр для URL (`sharedRoute`/`sharedId`), умеет восстанавливать путь из GeoJSON/Polyline. `useSharedRoutePreview` и `useSharedRoutesCatalog` работают с API каталога общих маршрутов (`/api/shared-routes`, `/api/shared-routes/{sharedId}`, `/api/shared-routes?bbox=...`). Для профиля есть эндпоинт создания ссылки `/api/users/{userId}/routes/{routeId}/share`.
- Маршрутизация по дорогам выполняется через публичный OSRM (`utils/manualRouteProfiles.js`), fallback – прямые отрезки с `haversine-distance`.

## Темы и UI-стиль
- Цвета задаются CSS переменными в `styles/theme.css`, Chakra тема подтягивает их в `theme/chakraTheme.js`.
- `useTelegramTheme` применяет параметры темы из Telegram WebApp, переключает `data-theme` и прописывает CSS-переменные; если Telegram недоступен – слушает `prefers-color-scheme`.
- При добавлении компонентов используем Chakra для контролов, но кастомные маркеры/кластерные элементы строятся на чистом HTML/CSS внутри divIcon.

## Конвенции разработки
- Имена файлов: React-компоненты в PascalCase, хуки с префиксом `use`, сервисы в `camelCase` функциях.
- Логику запроса/модификации данных держим в `hooks/` и `services/`, компоненты остаются максимально декларативными.
- Общие форматтеры/константы складываем в `utils/`; не дублируем локальные магические строки (ключи `localStorage`, query-параметры) – выносим в константы.
- Перед добавлением новой фичи на карту: описать формат данных, расширить соответствующий сервис, сделать хук с состоянием/кешом, и только потом подключить компонент на сцене.
- Для новых API-фич сохраняем обратную совместимость: при ошибке/отсутствии эндпоинта даём graceful fallback (см. `shareUserRoute`).

## Базовые модели данных (фронт)
- Пользователь: `{ id, username, firstName?, lastName?, avatarUrl?, averageSpeed?, lastActive?, email? }`.
- Ручной маршрут (UI): `{ routeId?, name, description?, color, mapProvider?, routingProfile, followRoads, waypoints: [{lat,lng}], pathCoordinates: [{latitude,longitude}], distanceKm?, durationMinutes?, estimatedDurationMinutes?, averageSpeedKmh?, difficulty?, surfaceTypes?: string[], visibility?, authorId?, sharedId? }`. При сохранении в профиль бьём в `/api/users/{userId}/routes`, для шаринга – `/api/users/{userId}/routes/{routeId}/share` или `/api/shared-routes`.
- Зарядка/интересная точка/опасность/чат/мастерская: `{ latitude, longitude, markerType, title/name, ... }` – тип влияет на иконку и приоритет отображения. Станции поддерживают лайки/дизлайки и фото (multipart).

## Как проверять себя
- Для визуальных изменений – `npm run dev` и ручная проверка в вебе/Telegram WebApp.
- Для сетевых сценариев – помнить, что прод режет автологин: без Telegram WebApp или ручной авторизации вернётся экран `/auth`, в dev можно включить/отключить автологин через `webmap_skip_dev_autologin`.
