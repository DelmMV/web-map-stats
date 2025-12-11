import React from 'react'
import {
	Box,
	Button,
	Collapse,
	HStack,
	IconButton,
	Text,
} from '@chakra-ui/react'
import { AddIcon, HamburgerIcon } from '@chakra-ui/icons'
import { motion } from 'framer-motion'
import {
	baseButtonStyles,
	baseIconButtonStyles,
	motionButtonProps,
} from '../styles/buttonStyles'

const MapTopControls = ({
	isDesktopSidebar,
	isDrawerOpen,
	onDrawerOpen,
	manualRouteMode,
	onManualRouteToggle,
	isEditMode,
	onEditModeToggle,
	onAddStation,
	isAddingStation,
	isGuestView,
	onRequireAuth,
	sharedRoutePreview,
	onSharedRouteClear,
	sharedRouteFetchStatus,
	sharedRouteError,
	sharedRoutesCatalogStatus,
	showSharedRoutesCatalog,
}) => {
	return (
		<Box
			position='absolute'
			top='10px'
			left='11px'
			zIndex={1000}
			display='flex'
			flexDirection='column'
			alignItems='flex-start'
			gap='6px'
		>
			<HStack align='center' spacing='10px' flexWrap='wrap'>
				{!isDesktopSidebar && (
					<IconButton
						as={motion.button}
						{...motionButtonProps}
						onClick={onDrawerOpen}
						icon={
							<Box
								as={HamburgerIcon}
								boxSize={6}
								transition='transform 0.25s ease'
								transform={isDrawerOpen ? 'rotate(90deg)' : 'rotate(0deg)'}
							/>
						}
						size='lg'
						borderWidth={2}
						borderRadius={4}
						borderColor='gray'
						width='44px'
						height='44px'
						aria-label='Открыть меню'
						sx={baseIconButtonStyles}
					/>
				)}
				<Button
					as={motion.button}
					{...motionButtonProps}
					size='sm'
					colorScheme={isEditMode ? 'yellow' : 'teal'}
					variant='solid'
					onClick={onEditModeToggle}
					px={4}
					sx={baseButtonStyles}
				>
					Режим редактирования
				</Button>
				{isGuestView && (
					<Button
						as={motion.button}
						{...motionButtonProps}
						size='sm'
						colorScheme='blue'
						variant='outline'
						onClick={onRequireAuth}
						sx={baseButtonStyles}
					>
						Войти / Регистрация
					</Button>
				)}
			</HStack>
			{isGuestView && (
				<Text fontSize='xs' color='gray.600'>
					Гостевой режим — авторизуйтесь, чтобы добавлять маршруты и станции.
				</Text>
			)}
			<Collapse in={isEditMode} animateOpacity>
				<HStack
					align='center'
					spacing='10px'
					flexWrap='wrap'
					mt='4px'
					ml={{ base: '52px', md: '60px' }}
				>
					<Button
						as={motion.button}
						{...motionButtonProps}
						size='sm'
						colorScheme={manualRouteMode ? 'red' : 'teal'}
						variant='solid'
						onClick={onManualRouteToggle}
						px={4}
						sx={baseButtonStyles}
					>
						{manualRouteMode ? 'Отменить' : 'Добавить маршрут'}
					</Button>
					<Button
						as={motion.button}
						{...motionButtonProps}
						size='sm'
						variant='solid'
						colorScheme='purple'
						leftIcon={<AddIcon />}
						onClick={onAddStation}
						isDisabled={isAddingStation}
						sx={baseButtonStyles}
					>
						Добавить станцию
					</Button>
				</HStack>
			</Collapse>
			{showSharedRoutesCatalog && sharedRoutesCatalogStatus?.loading && (
				<Text fontSize='xs' color='gray.600'>Загружаем каталог маршрутов...</Text>
			)}
			{sharedRoutePreview && (
				<HStack spacing={3} align='center' flexWrap='wrap'>
					<Text fontSize='xs' color='gray.700'>
						Маршрут по ссылке: {sharedRoutePreview.name || 'Без названия'}
					</Text>
					<Button
						as={motion.button}
						{...motionButtonProps}
						size='xs'
						variant='link'
						colorScheme='gray'
						onClick={onSharedRouteClear}
						sx={{ ...baseButtonStyles, boxShadow: 'none', px: 0 }}
					>
						Скрыть
					</Button>
				</HStack>
			)}
			{sharedRouteFetchStatus?.loading && !sharedRoutePreview && (
				<Text fontSize='xs' color='gray.600'>Загружаем маршрут по ссылке...</Text>
			)}
			{sharedRouteError && (
				<HStack spacing={3} align='center' flexWrap='wrap'>
					<Text fontSize='xs' color='red.500'>{sharedRouteError}</Text>
					<Button size='xs' variant='link' colorScheme='red' onClick={onSharedRouteClear}>
						Закрыть
					</Button>
				</HStack>
			)}
		</Box>
	)
}

export default React.memo(MapTopControls)
