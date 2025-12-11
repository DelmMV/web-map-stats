import React, { createContext, useContext, useMemo, useReducer } from 'react'

const PREFERRED_CITY_STORAGE_KEY = 'preferredCityCoords'

// UI store: хранит фронтовые флаги/кеши и умеет их сохранять в localStorage.

const PERSISTED_ENTRIES = [
	{ key: 'showDailyTracks', defaultValue: true },
	{ key: 'showRecentTracks', defaultValue: true },
	{ key: 'showSavedRoutesSection', defaultValue: true },
	{ key: 'publishedRoutesMap', defaultValue: {} },
	{ key: 'visibleSavedRouteIds', defaultValue: [] },
	{ key: 'mapLayer', defaultValue: 'default' },
	{ key: PREFERRED_CITY_STORAGE_KEY, defaultValue: null },
]

const initialState = {
	showDailyTracks: true,
	showRecentTracks: true,
	showSavedRoutesSection: true,
	publishedRoutesMap: {},
	selectedRouteDetail: null,
	selectedRouteActions: null,
	visibleSavedRouteIds: [],
	mapLayer: 'default',
	preferredCityCoords: null,
}

const UIStoreContext = createContext(null)

const reducer = (state, action) => {
	switch (action.type) {
		case 'SET_FLAG':
			return { ...state, [action.key]: action.value }
		case 'SET_PUBLISHED_MAP':
			return { ...state, publishedRoutesMap: action.value || {} }
		case 'SET_SELECTED_ROUTE':
			return {
				...state,
				selectedRouteDetail: action.detail || null,
				selectedRouteActions: action.actions || null,
			}
		case 'SET_VISIBLE_SAVED_IDS':
			return { ...state, visibleSavedRouteIds: action.value || [] }
		case 'SET_MAP_LAYER':
			return { ...state, mapLayer: action.value || 'default' }
		case 'SET_PREFERRED_CITY':
			return { ...state, preferredCityCoords: action.value || null }
		default:
			return state
	}
}

const readPersistedState = () => {
	const result = {}
	PERSISTED_ENTRIES.forEach(({ key, defaultValue }) => {
		if (typeof window === 'undefined') {
			result[key] = defaultValue
			return
		}
		try {
			const raw = localStorage.getItem(key)
			result[key] = raw ? JSON.parse(raw) : defaultValue
		} catch (_error) {
			result[key] = defaultValue
		}
	})
	return result
}

const isPersistedKey = key => PERSISTED_ENTRIES.some(entry => entry.key === key)

const persistValue = (key, value) => {
	if (typeof window === 'undefined' || !isPersistedKey(key)) return
	try {
		localStorage.setItem(key, JSON.stringify(value))
	} catch (_error) {
		// no-op: не блокируем UI из-за storage ошибок
	}
}

export const UIStoreProvider = ({ children }) => {
	const persistedState = useMemo(readPersistedState, [])
	const [state, dispatch] = useReducer(reducer, {
		...initialState,
		...persistedState,
	})

	const value = useMemo(
		() => ({
			state,
			setFlag: (key, value) => {
				const nextValue = typeof value === 'function' ? value(state[key]) : value
				dispatch({ type: 'SET_FLAG', key, value: nextValue })
				persistValue(key, nextValue)
			},
			setPublishedRoutesMap: map => {
				const nextValue =
					typeof map === 'function' ? map(state.publishedRoutesMap) : map
				dispatch({ type: 'SET_PUBLISHED_MAP', value: nextValue })
				persistValue('publishedRoutesMap', nextValue)
			},
			setSelectedRoute: (detail, actions = null) =>
				dispatch({ type: 'SET_SELECTED_ROUTE', detail, actions }),
			setVisibleSavedRouteIds: updater => {
				const nextValue =
					typeof updater === 'function'
						? updater(state.visibleSavedRouteIds)
						: updater || []
				dispatch({ type: 'SET_VISIBLE_SAVED_IDS', value: nextValue })
				persistValue('visibleSavedRouteIds', nextValue)
			},
			setMapLayer: value => {
				const nextValue = value || 'default'
				dispatch({ type: 'SET_MAP_LAYER', value: nextValue })
				persistValue('mapLayer', nextValue)
			},
			setPreferredCityCoords: value => {
				dispatch({ type: 'SET_PREFERRED_CITY', value })
				persistValue(PREFERRED_CITY_STORAGE_KEY, value)
			},
		}),
		[state]
	)

	return <UIStoreContext.Provider value={value}>{children}</UIStoreContext.Provider>
}

export const useUIStore = () => {
	const ctx = useContext(UIStoreContext)
	if (!ctx) {
		throw new Error('useUIStore must be used within UIStoreProvider')
	}
	return ctx
}

export const useUISelector = selector => {
	const { state } = useUIStore()
	return selector(state)
}

export const getUIInitialState = () => ({
	...initialState,
	...readPersistedState(),
})
