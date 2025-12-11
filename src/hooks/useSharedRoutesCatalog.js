import { useCallback, useEffect, useState } from 'react'

import { fetchSharedRoutesCatalog } from '../services/sharedRouteService'

const STORAGE_KEY = 'showSharedRoutesCatalog'

export function useSharedRoutesCatalog(toast) {
	const [showSharedRoutesCatalog, setShowSharedRoutesCatalog] = useState(() => {
		if (typeof window === 'undefined') return false
		try {
			const stored = localStorage.getItem(STORAGE_KEY)
			return stored ? JSON.parse(stored) : false
		} catch (error) {
			console.error('Failed to read catalog visibility:', error)
			return false
		}
	})

	const [sharedRoutesCatalog, setSharedRoutesCatalog] = useState([])
	const [sharedRoutesCatalogStatus, setSharedRoutesCatalogStatus] = useState({
		loading: false,
		error: null,
	})

	const loadSharedRoutesCatalog = useCallback(async () => {
		setSharedRoutesCatalogStatus({ loading: true, error: null })
		try {
			const data = await fetchSharedRoutesCatalog({ limit: 100 })
			const items = Array.isArray(data?.items) ? data.items : []
			const deduped = []
			const seen = new Set()
			for (const item of items) {
				if (!item) continue
				const key =
					item.sharedId ||
					item.routeId ||
					(item.route && item.route.routeId) ||
					item.slug ||
					item.name
				const safeKey = key ? String(key) : null
				if (safeKey && seen.has(safeKey)) continue
				if (safeKey) seen.add(safeKey)
				deduped.push(item)
			}
			setSharedRoutesCatalog(deduped)
			setSharedRoutesCatalogStatus({ loading: false, error: null })
		} catch (error) {
			console.error('Failed to load shared routes catalog:', error)
			setSharedRoutesCatalogStatus({
				loading: false,
				error: error.message || 'Не удалось загрузить каталог маршрутов',
			})
			if (toast) {
				toast({
					title: 'Каталог маршрутов недоступен',
					description: error.message || undefined,
					status: 'error',
					duration: 4000,
					isClosable: true,
				})
			}
		}
	}, [toast])

	const ensureSharedRoutesCatalogVisible = useCallback(() => {
		setShowSharedRoutesCatalog(true)
		loadSharedRoutesCatalog()
	}, [loadSharedRoutesCatalog])

	const handleRefreshSharedRoutesCatalog = useCallback(() => {
		setShowSharedRoutesCatalog(true)
		loadSharedRoutesCatalog()
	}, [loadSharedRoutesCatalog])

	useEffect(() => {
		if (showSharedRoutesCatalog) {
			loadSharedRoutesCatalog()
		}
	}, [showSharedRoutesCatalog, loadSharedRoutesCatalog])

	useEffect(() => {
		if (typeof window === 'undefined') return undefined
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(showSharedRoutesCatalog))
		} catch (error) {
			console.error('Failed to persist catalog visibility:', error)
		}
	}, [showSharedRoutesCatalog])

	useEffect(() => {
		const handleCatalogUpdate = event => {
			const detail = event?.detail || {}
			if (detail.removed && detail.sharedId) {
				setSharedRoutesCatalog(prev =>
					prev.filter(
						item =>
							item.sharedId !== detail.sharedId &&
							item.routeId !== detail.routeId
					)
				)
			} else if (detail.removed && detail.routeId) {
				setSharedRoutesCatalog(prev =>
					prev.filter(item => item.routeId !== detail.routeId)
				)
			} else if (detail.cleared) {
				setSharedRoutesCatalog([])
			}
			const shouldReload =
				Boolean(detail?.updated) || Boolean(showSharedRoutesCatalog)
			if (shouldReload) {
				loadSharedRoutesCatalog()
			}
		}
		if (typeof window !== 'undefined') {
			window.addEventListener('shared-route-published', handleCatalogUpdate)
		}
		return () => {
			if (typeof window !== 'undefined') {
				window.removeEventListener('shared-route-published', handleCatalogUpdate)
			}
		}
	}, [showSharedRoutesCatalog, loadSharedRoutesCatalog])

	return {
		showSharedRoutesCatalog,
		setShowSharedRoutesCatalog,
		sharedRoutesCatalog,
		sharedRoutesCatalogStatus,
		loadSharedRoutesCatalog,
		ensureSharedRoutesCatalogVisible,
		handleRefreshSharedRoutesCatalog,
	}
}
