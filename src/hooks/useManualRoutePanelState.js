import { useCallback, useEffect, useRef, useState } from 'react'

export function useManualRoutePanelState({
	manualRoutePanelDefaultLeft,
	isCompactManualPanel,
	manualRouteMode,
	panelRef,
}) {
	const DEFAULT_PANEL_TOP = 100
	const [manualRoutePanelCollapsed, setManualRoutePanelCollapsed] = useState(false)
	const [manualRoutePanelPosition, setManualRoutePanelPosition] = useState(() => ({
		top: DEFAULT_PANEL_TOP,
		left:
			typeof manualRoutePanelDefaultLeft === 'number'
				? manualRoutePanelDefaultLeft
				: 70,
	}))
	const [manualRoutePanelManuallyMoved, setManualRoutePanelManuallyMoved] =
		useState(false)
	const manualRoutePanelDragDataRef = useRef(null)

	useEffect(() => {
		if (manualRouteMode) {
			if (typeof isCompactManualPanel === 'boolean') {
				setManualRoutePanelCollapsed(isCompactManualPanel)
			} else {
				setManualRoutePanelCollapsed(false)
			}
			return
		}
		if (typeof isCompactManualPanel === 'boolean') {
			setManualRoutePanelCollapsed(isCompactManualPanel)
		}
	}, [isCompactManualPanel, manualRouteMode])

	useEffect(() => {
		if (manualRoutePanelManuallyMoved) return
		if (typeof manualRoutePanelDefaultLeft === 'number') {
			setManualRoutePanelPosition(prev => ({
				...prev,
				left: manualRoutePanelDefaultLeft,
				top: DEFAULT_PANEL_TOP,
			}))
		}
	}, [manualRoutePanelDefaultLeft, manualRoutePanelManuallyMoved])

	const handleManualRoutePanelToggle = useCallback(() => {
		setManualRoutePanelCollapsed(prev => !prev)
	}, [])

	const handleManualRoutePanelPointerMove = useCallback(
		event => {
			const drag = manualRoutePanelDragDataRef.current
			if (!drag) return
			const dx = event.clientX - drag.startX
			const dy = event.clientY - drag.startY
			let nextLeft = drag.offsetLeft + dx
			let nextTop = drag.offsetTop + dy
			const panelEl = panelRef?.current
			if (panelEl) {
				const padding = 8
				const width = panelEl.offsetWidth || 0
				const height = panelEl.offsetHeight || 0
				const maxLeft = Math.max(padding, window.innerWidth - width - padding)
				const maxTop = Math.max(padding, window.innerHeight - height - padding)
				nextLeft = Math.min(Math.max(padding, nextLeft), maxLeft)
				nextTop = Math.min(Math.max(padding, nextTop), maxTop)
			}
			setManualRoutePanelPosition({ left: nextLeft, top: nextTop })
		},
		[panelRef]
	)

	const handleManualRoutePanelPointerUp = useCallback(() => {
		manualRoutePanelDragDataRef.current = null
		document.removeEventListener('pointermove', handleManualRoutePanelPointerMove)
		document.removeEventListener('pointerup', handleManualRoutePanelPointerUp)
	}, [handleManualRoutePanelPointerMove])

	const handleManualRoutePanelPointerDown = useCallback(
		event => {
			const target = event.target
			if (
				target instanceof Element &&
				(target.closest('button') ||
					target.closest('select') ||
					target.closest('input') ||
					target.closest('textarea') ||
					target.closest('[role="listbox"]'))
			) {
				return
			}
			if (!panelRef?.current) return
			event.preventDefault()
			setManualRoutePanelManuallyMoved(true)
			manualRoutePanelDragDataRef.current = {
				startX: event.clientX,
				startY: event.clientY,
				offsetLeft: manualRoutePanelPosition.left,
				offsetTop: manualRoutePanelPosition.top,
			}
			document.addEventListener('pointermove', handleManualRoutePanelPointerMove)
			document.addEventListener('pointerup', handleManualRoutePanelPointerUp)
		},
		[
			manualRoutePanelPosition.left,
			manualRoutePanelPosition.top,
			handleManualRoutePanelPointerMove,
			handleManualRoutePanelPointerUp,
			panelRef,
		]
	)

	useEffect(() => {
		return () => {
			document.removeEventListener('pointermove', handleManualRoutePanelPointerMove)
			document.removeEventListener('pointerup', handleManualRoutePanelPointerUp)
		}
	}, [handleManualRoutePanelPointerMove, handleManualRoutePanelPointerUp])

	return {
		manualRoutePanelCollapsed,
		manualRoutePanelPosition,
		manualRoutePanelIsCollapsed: manualRoutePanelCollapsed,
		manualRoutePanelManuallyMoved,
		handleManualRoutePanelToggle,
		handleManualRoutePanelPointerDown,
	}
}
