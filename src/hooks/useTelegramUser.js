import { useCallback, useEffect, useState } from 'react'

const TELEGRAM_STORAGE_KEY = 'telegramUser'
const AUTH_STORAGE_KEY = 'webmap_auth_v1'

const readJson = key => {
	if (typeof window === 'undefined') return null
	try {
		const raw = window.localStorage.getItem(key)
		return raw ? JSON.parse(raw) : null
	} catch (error) {
		console.error(`Error parsing ${key} from localStorage:`, error)
		return null
	}
}

const normalizeUser = source => {
	if (!source) return null
	const id = source.id
	if (!id) return null
	return {
		id,
		firstName: source.first_name || source.firstName || '',
		lastName: source.last_name || source.lastName || '',
		username: source.username || '',
		photoUrl: source.photo_url || source.photoUrl || null,
	}
}

const readAuthStorageUser = () => {
	const payload = readJson(AUTH_STORAGE_KEY)
	if (payload?.user) {
		return normalizeUser(payload.user)
	}
	return null
}

const readTelegramStorageUser = () => {
	return readJson(TELEGRAM_STORAGE_KEY)
}

export function useTelegramUser() {
	const [user, setUser] = useState(null)

	const resolveStoredUser = useCallback(() => {
		const telegramStored = readTelegramStorageUser()
		if (telegramStored) {
			return telegramStored
		}
		return readAuthStorageUser()
	}, [])

	useEffect(() => {
		const tg = window.Telegram?.WebApp?.initDataUnsafe
		if (tg?.user) {
			const normalized = normalizeUser(tg.user)
			if (normalized) {
				setUser(normalized)
				try {
					localStorage.setItem(TELEGRAM_STORAGE_KEY, JSON.stringify(normalized))
				} catch (error) {
					console.error('Error saving telegram user to localStorage:', error)
				}
				return
			}
		}

		const stored = resolveStoredUser()
		setUser(stored)
	}, [resolveStoredUser])

	return user
}
