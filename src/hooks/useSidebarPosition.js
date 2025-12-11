import { useCallback, useEffect, useRef, useState } from 'react'

const loadSidebarPosition = () => {
	if (typeof window === 'undefined') return { top: 70, right: 60 }
	try {
		const stored = localStorage.getItem('desktopSidebarPosition')
		if (stored) {
			const parsed = JSON.parse(stored)
			if (
				parsed &&
				typeof parsed.top === 'number' &&
				typeof parsed.right === 'number'
			) {
				return parsed
			}
		}
	} catch (error) {
		console.error('Failed to read sidebar position:', error)
	}
	return { top: 70, right: 60 }
}

export function useSidebarPosition(isDesktopSidebar) {
	const [sidebarPosition, setSidebarPosition] = useState(loadSidebarPosition)
	const sidebarDragDataRef = useRef(null)

	const handleSidebarPointerMove = useCallback(event => {
		if (!sidebarDragDataRef.current) return
		const { startX, startY, offsetTop, offsetRight } = sidebarDragDataRef.current
		const deltaX = event.clientX - startX
		const deltaY = event.clientY - startY
		const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 900
		const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1440

		const nextTop = Math.min(Math.max(20, offsetTop + deltaY), viewportHeight - 150)
		const nextRight = Math.min(
			Math.max(20, offsetRight - deltaX),
			viewportWidth - 220
		)
		setSidebarPosition({ top: nextTop, right: nextRight })
	}, [])

	const handleSidebarPointerUp = useCallback(() => {
		sidebarDragDataRef.current = null
		document.removeEventListener('pointermove', handleSidebarPointerMove)
		document.removeEventListener('pointerup', handleSidebarPointerUp)
	}, [handleSidebarPointerMove])

	const handleSidebarPointerDown = useCallback(
		event => {
			if (!isDesktopSidebar) return
			const target = event.target
			if (
				target instanceof Element &&
				(target.closest('button') ||
					target.closest('input') ||
					target.closest('textarea') ||
					target.closest('select') ||
					target.closest('[role="listbox"]') ||
					target.closest('[data-no-drag]'))
			) {
				return
			}
			event.preventDefault()
			sidebarDragDataRef.current = {
				startX: event.clientX,
				startY: event.clientY,
				offsetTop: sidebarPosition.top,
				offsetRight: sidebarPosition.right,
			}
			document.addEventListener('pointermove', handleSidebarPointerMove)
			document.addEventListener('pointerup', handleSidebarPointerUp)
		},
		[isDesktopSidebar, sidebarPosition.top, sidebarPosition.right, handleSidebarPointerMove, handleSidebarPointerUp]
	)

	useEffect(() => {
		return () => {
			document.removeEventListener('pointermove', handleSidebarPointerMove)
			document.removeEventListener('pointerup', handleSidebarPointerUp)
		}
	}, [handleSidebarPointerMove, handleSidebarPointerUp])

	useEffect(() => {
		if (!isDesktopSidebar) return
		try {
			localStorage.setItem('desktopSidebarPosition', JSON.stringify(sidebarPosition))
		} catch (error) {
			console.error('Failed to persist sidebar position:', error)
		}
	}, [sidebarPosition, isDesktopSidebar])

	return { sidebarPosition, handleSidebarPointerDown }
}
