import React, { useEffect, useRef, useState } from 'react'
import { Tooltip, useBreakpointValue } from '@chakra-ui/react'

const MobileTooltip = ({
	children,
	autoHideMs = 2000,
	placement = 'right',
	...props
}) => {
	const isMobile = useBreakpointValue({ base: true, md: false })
	const [isOpen, setIsOpen] = useState(false)
	const timerRef = useRef(null)

	useEffect(() => {
		return () => {
			if (timerRef.current) {
				clearTimeout(timerRef.current)
			}
		}
	}, [])

	const handleOpen = () => {
		if (!isMobile) return
		if (timerRef.current) {
			clearTimeout(timerRef.current)
		}
		setIsOpen(true)
		timerRef.current = setTimeout(() => setIsOpen(false), autoHideMs)
	}

	const handleClose = () => {
		if (timerRef.current) {
			clearTimeout(timerRef.current)
		}
		setIsOpen(false)
	}

	const mobileProps = isMobile
		? {
				isOpen,
				onOpen: handleOpen,
				onClose: handleClose,
				closeOnClick: true,
				closeOnEsc: true,
				closeOnScroll: true,
				openDelay: 0,
				closeDelay: 0,
		  }
		: {
				openDelay: 150,
				closeDelay: 100,
		  }

	return (
		<Tooltip hasArrow placement={placement} {...mobileProps} {...props}>
			<span style={{ display: 'inline-block' }} onClick={handleOpen}>
				{children}
			</span>
		</Tooltip>
	)
}

export default MobileTooltip
