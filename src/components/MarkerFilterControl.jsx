import {
	Box,
	Checkbox,
	IconButton,
	Menu,
	MenuButton,
	MenuList,
	Text,
	VStack,
} from '@chakra-ui/react'
import React, { useState } from 'react'
import { FaFilter } from 'react-icons/fa'
import { motion } from 'framer-motion'
import {
	baseIconButtonStyles,
	motionButtonProps,
} from '../styles/buttonStyles'
import MobileTooltip from './MobileTooltip'

const DEFAULT_FILTERS = {
	charging: true,
	chargingAuto: true,
	interesting: true,
	danger: true,
	chat: true,
	workshop: true,
}

function MarkerFilterControl({
	filters: controlledFilters,
	onFilterChange,
	inline = false,
	position = { top: '180px', left: '11px' },
}) {
	const [filters, setFilters] = useState(() => {
		if (controlledFilters) return controlledFilters
		const savedFilters = localStorage.getItem('markerFilters')
		return savedFilters ? JSON.parse(savedFilters) : DEFAULT_FILTERS
	})

	React.useEffect(() => {
		if (!controlledFilters) return
		setFilters(prev => {
			const prevStr = JSON.stringify(prev)
			const nextStr = JSON.stringify(controlledFilters)
			return prevStr === nextStr ? prev : controlledFilters
		})
	}, [controlledFilters])

	const handleFilterChange = type => {
		const newFilters = { ...filters, [type]: !filters[type] }
		setFilters(newFilters)
		localStorage.setItem('markerFilters', JSON.stringify(newFilters))
		onFilterChange(newFilters)
	}

	const filterLabels = {
		charging: 'Обычные розетки',
		chargingAuto: 'Авто зарядки',
		interesting: 'Интересные места',
		danger: 'Опасные места',
		chat: 'Чаты',
		workshop: 'Сервисы',
	}

	return (
		<Box
			position={inline ? 'relative' : 'absolute'}
			{...(!inline ? position : {})}
			zIndex={1000}
		>
			<Menu closeOnSelect={false} placement='right-start'>
				<motion.div {...motionButtonProps}>
					<MobileTooltip label='Фильтр маркеров'>
						<MenuButton
							as={IconButton}
							aria-label='Фильтр маркеров'
							icon={<FaFilter />}
							variant='solid'
							size='md'
							colorScheme='gray'
							borderRadius={3}
							borderColor='gray'
							borderWidth={2}
							width='34px'
							padding='0'
							sx={baseIconButtonStyles}
						/>
					</MobileTooltip>
				</motion.div>
				<MenuList minWidth='200px'>
					<VStack align='start' spacing={1} p={2}>
						{Object.keys(filters).map(type => (
							<Checkbox
								key={type}
								isChecked={filters[type]}
								onChange={() => handleFilterChange(type)}
							>
								<Text fontSize='sm'>{filterLabels[type]}</Text>
							</Checkbox>
						))}
					</VStack>
				</MenuList>
			</Menu>
		</Box>
	)
}
export default MarkerFilterControl
