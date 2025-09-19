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
