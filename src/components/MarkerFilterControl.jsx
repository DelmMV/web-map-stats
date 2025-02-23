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

function MarkerFilterControl({ onFilterChange }) {
	const [filters, setFilters] = useState(() => {
		const savedFilters = localStorage.getItem('markerFilters')
		console.log(savedFilters)
		return savedFilters
			? JSON.parse(savedFilters)
			: {
					charging: true,
					chargingAuto: true,
					interesting: true,
					danger: true,
					chat: true,
					workshop: true,
			  }
	})

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
		<Box position='absolute' top='180px' left='11px' zIndex={1000}>
			<Menu closeOnSelect={false} placement='right-start'>
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
				/>
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
