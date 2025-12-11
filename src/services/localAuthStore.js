const LOCAL_USERS_KEY = 'webmap_known_users'

const readStore = () => {
	if (typeof window === 'undefined') return {}
	try {
		const raw = window.localStorage.getItem(LOCAL_USERS_KEY)
		return raw ? JSON.parse(raw) : {}
	} catch (error) {
		console.error('Error parsing stored auth users:', error)
		return {}
	}
}

const writeStore = data => {
	if (typeof window === 'undefined') return
	try {
		window.localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(data))
	} catch (error) {
		console.error('Error saving auth users:', error)
	}
}

export const saveKnownUser = (email, payload) => {
	if (!email) return
	const normalizedEmail = email.toLowerCase()
	const store = readStore()
	store[normalizedEmail] = {
		...store[normalizedEmail],
		...payload,
		lastUpdated: Date.now(),
	}
	writeStore(store)
}

export const getKnownUser = email => {
	if (!email) return null
	const normalizedEmail = email.toLowerCase()
	const store = readStore()
	return store[normalizedEmail] || null
}

