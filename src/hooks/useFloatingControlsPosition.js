import { useCallback, useEffect, useRef, useState } from 'react'

const STORAGE_KEY = 'floatingControlsPosition'
const MIN_LEFT = 8

const getMinTop = () => {
	if (typeof window === 'undefined') return 120
	return window.innerWidth < 768 ? 220 : 140
}

const clampPosition = (minTop, { top, left }) => {
	return {
		top: Math.max(minTop, top),
		left: Math.max(MIN_LEFT, left),
	}
}

const loadPosition = () => {
	const minTop = getMinTop()
	const defaultPosition = { top: minTop, left: 11 }
	if (typeof window === 'undefined') return defaultPosition
	try {
		const stored = localStorage.getItem(STORAGE_KEY)
		if (stored) {
			const parsed = JSON.parse(stored)
			if (
				parsed &&
				typeof parsed.top === 'number' &&
				typeof parsed.left === 'number'
			) {
				return clampPosition(minTop, parsed)
			}
		}
	} catch (error) {
		console.error('Failed to parse floating controls position', error)
	}
	return defaultPosition
}

export function useFloatingControlsPosition() {
	const [minTop, setMinTop] = useState(getMinTop)
	const [position, setPosition] = useState(loadPosition)
	const dragDataRef = useRef(null)

	const handlePointerMove = useCallback(event => {
		const drag = dragDataRef.current
		if (!drag) return
		const dx = event.clientX - drag.startX
		const dy = event.clientY - drag.startY

		const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1440
		const viewportHeight =
			typeof window !== 'undefined' ? window.innerHeight : 900
		const nextLeft = Math.min(
			Math.max(MIN_LEFT, drag.offsetLeft + dx),
			viewportWidth - 80
		)
		const nextTop = Math.min(Math.max(minTop, drag.offsetTop + dy), viewportHeight - 80)
		setPosition({ left: nextLeft, top: nextTop })
	}, [minTop])

	const handlePointerUp = useCallback(() => {
		dragDataRef.current = null
		document.removeEventListener('pointermove', handlePointerMove)
		document.removeEventListener('pointerup', handlePointerUp)
	}, [handlePointerMove])

	const handlePointerDown = useCallback(
		event => {
			const target = event.target
			if (!(target instanceof Element)) return
			if (target.closest('[data-no-drag]')) return
			const hasDragHandle = target.closest('[data-drag-handle]')
			const isDragArea = target.closest('[data-drag-area]')
			if (!hasDragHandle && !isDragArea) return
			event.preventDefault()
			dragDataRef.current = {
				startX: event.clientX,
				startY: event.clientY,
				offsetLeft: Math.max(MIN_LEFT, position.left),
				offsetTop: Math.max(minTop, position.top),
			}
			document.addEventListener('pointermove', handlePointerMove)
			document.addEventListener('pointerup', handlePointerUp)
		},
		[position.left, position.top, minTop, handlePointerMove, handlePointerUp]
	)

	useEffect(() => {
		return () => {
			document.removeEventListener('pointermove', handlePointerMove)
			document.removeEventListener('pointerup', handlePointerUp)
		}
	}, [handlePointerMove, handlePointerUp])

	useEffect(() => {
		if (typeof window === 'undefined') return
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(position))
		} catch (error) {
			console.error('Failed to save floating controls position', error)
		}
	}, [position])

	useEffect(() => {
		const handleResize = () => {
			const nextMinTop = getMinTop()
			setMinTop(nextMinTop)
			setPosition(prev => clampPosition(nextMinTop, prev))
		}
		window.addEventListener('resize', handleResize)
		return () => window.removeEventListener('resize', handleResize)
	}, [])

	return { position, handlePointerDown }
}
