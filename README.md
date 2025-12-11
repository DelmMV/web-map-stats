# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

# web-map-stats

# Development vs Production Modes

## Автоматическое переключение режимов

Приложение автоматически определяет режим работы и настраивает аутентификацию:

### Development режим (`npm run dev`)

- 🛠️ **Автоматический вход**: Использует предустановленного тестового пользователя
- 📊 **Debug логи**: Включены подробные логи разработки
- 🎯 **Индикатор**: Отображается "DEV MODE" в правом верхнем углу
- ⚡ **Быстрый старт**: Никаких действий по аутентификации не требуется

### Production режим (`npm run build && npm run preview`)

- 🔐 **Telegram аутентификация**: Требует входа через Telegram виджет
- 🚀 **Оптимизация**: Отключены debug логи для производительности
- 👤 **Безопасность**: Настоящая аутентификация пользователей

## Конфигурация

Настройки находятся в `src/utils/config.js`:

```javascript
export const APP_CONFIG = {
	development: {
		defaultUser: { id: 200885469 }, // Тестовый пользователь
		enableDebugLogs: true,
		showDevIndicator: true,
	},
	production: {
		telegramBotName: 'LampStatsBot',
		enableDebugLogs: false,
		showDevIndicator: false,
	},
}
```

## Утилиты для разработки

### devLog - умное логирование

```javascript
import { devLog } from './utils/config.js'

devLog.info('Информационное сообщение') // ℹ️ [DEV]
devLog.success('Успешная операция') // ✅ [DEV]
devLog.warn('Предупреждение') // ⚠️ [DEV]
devLog.error('Ошибка') // ❌ [DEV]
devLog.debug('Отладочная информация') // 🐛 [DEV]
```

Логи отображаются только в development режиме.

## Запуск

```bash
# Development режим (с тестовым пользователем)
npm run dev

# Production режим (с Telegram аутентификацией)
npm run build && npm run preview
```

## Geolocation & Stats Backend

Бэкенд сервиса построен на **Node.js + Express + MongoDB** и обслуживает все функции геолокации, статистики и работы с зарядными станциями. Он подходит для картографических интерфейсов (например, Monopiter) и взаимодействует с фронтендом через REST API на `https://api.monopiter.ru`.

### Возможности

- Отслеживание геопозиций пользователей и расчет средней скорости
- Получение маршрутов за выбранный период
- Тепловые карты (диапазон дат, месячные, годовые)
- CRUD-операции по зарядным станциям с загрузкой фото, лайками и дизлайками
- Категоризация пользователей по дистанциям (north/south)
- Топы и статистика по дистанциям (неделя, месяц)
- Проксирование аватарок с шифрованием URL (AES-256-CBC)
- Импорт списка мастерских из внешней базы

### Технологии

| Технология | Использование |
| ---------- | ------------- |
| Node.js / Express | HTTP API |
| MongoDB | Хранение геоданных |
| haversine-distance | Расчет дистанций |
| multer + sharp | Загрузка и обрезка фото |
| node-fetch | Проксирование URL |
| AES-256-CBC | Шифрование URL аватарок |
| dotenv | Конфигурация окружения |

### Установка

```bash
git clone <repo-url>
cd <project-folder>
npm install
```

Создайте `.env`:

```env
PORT=5001
MONGO_URL=mongodb://localhost:27017
MONGO_DB_NAME=geolocation_db
API_BASE_URL=https://api.monopiter.ru
ENCRYPTION_KEY=<64 hex chars>
CENTER_LAT=59.9505
```

> `ENCRYPTION_KEY` обязателен и должен содержать 32 байта (64 hex символа).

Запуск:

```bash
npm start
```

Тесты на Jest:

```bash
npm test
```

### Статические файлы

Фото зарядных станций хранятся в `./uploads` и доступны по `GET /uploads/<filename>`.

### Основные коллекции MongoDB

**locations** — точки трекинга (userId, sessionId, координаты, timestamp, avatarUrl). Используются для активных пользователей, маршрутов, топов, тепловых карт и расчета north/south.

**charging_stations** — описание станций (координаты, комментарий, фото, автор, 24/7, тип метки, статус, лайки/дизлайки).

**monthly_heatmaps** — агрегированные данные тепловых карт.

**workshops** — список мастерских (берется из `feedback_bot.workshops`).

### API

Полная OpenAPI спецификация находится в `openapi.yaml` и может быть открыта в Swagger UI или editor.swagger.io. Основные эндпоинты:

- `/api/active-users`
- `/api/charging-stations`
- `/api/heatmap`
- `/api/route/{userId}`
- `/api/top-users/*`
- `/api/top-sessions/*`
- `/api/top-daily-distances/*`
- `/api/total-distance/*`
- `/api/user-category-by-distance/*`
- `/secure-avatar/*`
- `/api/workshops`

### Бизнес-логика

- Расстояния вычисляются через `haversine(prev, curr)` (в метрах → км)
- Сессии разделяются по `sessionId`; точки разных сессий не объединяются
- Фильтрация точек по времени `< 3600` секунд
- Неделя считается Пн–Вс; периоды `this_week`, `last_week` определяются автоматически
- Граница north/south: `CENTER_LAT=59.9505` (>= north, иначе south)
- Тепловые карты пересчитываются для текущего и предыдущего месяцов раз в 24 часа

### Работа сервера

- Логи подключения MongoDB выводятся в консоль; при ошибке сервер останавливается
- Проксирование аватарок с шифрованием URL
- Обработка загрузок фото для станций через `multer` + `sharp`
