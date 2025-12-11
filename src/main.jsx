import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { UIStoreProvider } from './state/uiStore.jsx'

createRoot(document.getElementById('root')).render(
	<StrictMode>
		<UIStoreProvider>
			<App />
		</UIStoreProvider>
	</StrictMode>
)

// Регистрируем service worker только в production, чтобы в dev не было спама логов
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
	window.addEventListener('load', () => {
		navigator.serviceWorker
			.register('/sw.js')
			.then(registration => {
				console.log('SW registered: ', registration)
			})
			.catch(registrationError => {
				console.log('SW registration failed: ', registrationError)
			})
	})
}
