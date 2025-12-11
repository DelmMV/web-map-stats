import React from 'react'
import {
	Box,
	Button,
	Checkbox,
	Collapse,
	FormControl,
	HStack,
	IconButton,
	Input,
	Select,
	Text,
	Textarea,
	Tooltip,
	VStack,
	Wrap,
	WrapItem,
} from '@chakra-ui/react'
import { ChevronDownIcon, ChevronUpIcon } from '@chakra-ui/icons'
import { FaTrashAlt, FaUndo } from 'react-icons/fa'
import { motion } from 'framer-motion'
import {
	baseButtonStyles,
	motionButtonProps,
	subtleIconButtonStyles,
} from '../styles/buttonStyles'

const SURFACE_LABELS = {
	forest: 'Лесные дороги',
	sidewalks: 'Тротуары',
	bike_lanes: 'Велодорожки',
	road: 'Проезжая часть',
}

const SURFACE_OPTIONS = [
	{ value: 'forest', label: 'Лесные дороги' },
	{ value: 'sidewalks', label: 'Тротуары' },
	{ value: 'bike_lanes', label: 'Велодорожки' },
	{ value: 'road', label: 'Проезжая часть' },
]

const DIFFICULTY_OPTIONS = [
	{ value: '', label: 'Без указания' },
	{ value: 'easy', label: 'Легкий' },
	{ value: 'medium', label: 'Средний' },
	{ value: 'hard', label: 'Сложный' },
]

const ManualRoutePanel = ({
	isVisible,
	panelRef,
	position,
	isCompact,
	isCollapsed,
	actionButtonSize,
	controlSize,
	followRoads,
	profile,
	profileOptions = [],
	profileLabel,
	summaryDistance,
	mode,
	saveDisabled,
	hasExistingRoute,
	hasUndo,
	meta,
	routingStatus,
	status,
	onPointerDown,
	onToggleCollapse,
	onComplete,
	onClear,
	onUndo,
	onReset,
	onProfileChange,
	onFollowRoadsChange,
	onMetaChange,
	onEdit,
}) => {
	if (!isVisible) return null

	return (
		<Box
			ref={panelRef}
			position='absolute'
			style={{ top: `${position.top}px`, left: `${position.left}px` }}
			zIndex={1000}
			bg='white'
			borderRadius='xl'
			borderWidth='1px'
			borderColor='gray.200'
			padding={isCompact ? 2.5 : 4}
			boxShadow='0 14px 40px rgba(15, 23, 42, 0.12)'
			width='320px'
			maxW='calc(100vw - 32px)'
		>
			<VStack spacing={isCompact ? 1.5 : 2.5} align='stretch'>
				<HStack
					align='center'
					justify='space-between'
					spacing={3}
					onPointerDown={onPointerDown}
					cursor='grab'
				>
					<IconButton
						as={motion.button}
						{...motionButtonProps}
						size={actionButtonSize}
						variant='ghost'
						icon={isCollapsed ? <ChevronDownIcon /> : <ChevronUpIcon />}
						aria-label={
							isCollapsed
								? 'Развернуть настройки маршрута'
								: 'Свернуть настройки маршрута'
						}
						onClick={onToggleCollapse}
						isRound
						aria-haspopup='true'
						sx={subtleIconButtonStyles}
					/>
					<Wrap
						spacing='4px'
						maxW='60%'
						fontSize={isCompact ? '10px' : 'xs'}
						color='gray.500'
					>
						<WrapItem>{followRoads ? profileLabel : 'Прямой'}</WrapItem>
						<WrapItem>{summaryDistance} км</WrapItem>
					</Wrap>
					<HStack spacing={1}>
						<Button
							as={motion.button}
							{...motionButtonProps}
							size={actionButtonSize}
							variant='outline'
							onClick={mode ? onComplete : onClear}
							isDisabled={mode ? saveDisabled : !hasExistingRoute}
							sx={baseButtonStyles}
							minW='96px'
						>
							{mode ? 'Сохранить' : 'Сбросить'}
						</Button>
					</HStack>
				</HStack>
				<HStack spacing={isCompact ? 1.5 : 2} flexWrap='wrap' align='center'>
					<Tooltip label='Отменить точку' hasArrow placement='bottom'>
						<IconButton
							as={motion.button}
							{...motionButtonProps}
							size='xs'
							icon={<FaUndo />}
							variant='ghost'
							onClick={onUndo}
							isDisabled={!hasUndo}
							aria-label='Отменить точку'
							sx={subtleIconButtonStyles}
						/>
					</Tooltip>
					<Tooltip label='Очистить' hasArrow placement='bottom'>
						<IconButton
							as={motion.button}
							{...motionButtonProps}
							size='xs'
							icon={<FaTrashAlt />}
							variant='ghost'
							onClick={onReset}
							isDisabled={!hasUndo}
							aria-label='Очистить маршрут'
							sx={subtleIconButtonStyles}
						/>
					</Tooltip>
					{followRoads && (
						<Select
							size='xs'
							maxW={isCompact ? '60px' : '100px'}
							value={profile}
							onChange={event => onProfileChange(event.target.value)}
						>
							{profileOptions.map(profileOption => (
								<option key={profileOption.value} value={profileOption.value}>
									{profileOption.label}
								</option>
							))}
						</Select>
					)}
					<HStack>
						<Text fontSize='xs' color='gray.500'>
							Цвет
						</Text>
						<Input
							size={controlSize}
							width='60px'
							type='color'
							value={meta.color}
							onChange={e => onMetaChange('color', e.target.value)}
						/>
					</HStack>
					{!mode && hasExistingRoute && (
						<Button
							as={motion.button}
							{...motionButtonProps}
							size={actionButtonSize}
							variant='outline'
							onClick={onEdit}
							sx={baseButtonStyles}
							minW='110px'
						>
							Редактировать
						</Button>
					)}
				</HStack>
				{routingStatus.loading && followRoads && (
					<Text fontSize='xs' color='gray.500'>
						Строим маршрут по улицам...
					</Text>
				)}
				{routingStatus.error && (
					<Text fontSize='xs' color='red.500'>
						{routingStatus.error}
					</Text>
				)}
				<Collapse in={!isCollapsed} animateOpacity>
					<VStack spacing={isCompact ? 1.5 : 2} align='stretch' mt={1}>
						<Text fontSize='xs' color='gray.500'>
							Клик по карте — добавить точку. Перетащите маркер для коррекции,
							правый клик удаляет точку, Shift + клик по линии вставляет точку
							между существующими.
						</Text>
						<Checkbox
							size={controlSize}
							isChecked={!followRoads}
							onChange={event => onFollowRoadsChange(!event.target.checked)}
						>
							<Text fontSize='xs' color='gray.500'>
								Прямой маршрут
							</Text>
						</Checkbox>
						<FormControl>
							<Text fontSize='xs' color='gray.500'>
								Название
							</Text>
							<Input
								size={controlSize}
								value={meta.name}
								onChange={e => onMetaChange('name', e.target.value)}
							/>
						</FormControl>
						<FormControl>
							<Text fontSize='xs' color='gray.500'>
								Описание
							</Text>
							<Textarea
								size={controlSize}
								rows={isCompact ? 2 : 3}
								value={meta.description}
								onChange={e => onMetaChange('description', e.target.value)}
							/>
						</FormControl>
						<FormControl>
							<Text fontSize='xs' color='gray.500'>
								Сложность
							</Text>
							<Select
								size={controlSize}
								value={meta.difficulty || ''}
								onChange={e => onMetaChange('difficulty', e.target.value)}
							>
								{DIFFICULTY_OPTIONS.map(option => (
									<option key={option.value} value={option.value}>
										{option.label}
									</option>
								))}
							</Select>
						</FormControl>
						<FormControl>
							<Wrap spacing={1} mt={1}>
								{SURFACE_OPTIONS.map(option => {
									const isActive = Array.isArray(meta.surfaceTypes)
										? meta.surfaceTypes.includes(option.value)
										: false
									return (
										<WrapItem key={option.value}>
											<Button
												size='xs'
												variant={isActive ? 'solid' : 'outline'}
												colorScheme={isActive ? 'purple' : 'gray'}
												onClick={() => {
													const current = Array.isArray(meta.surfaceTypes)
														? meta.surfaceTypes
														: []
													const next = isActive
														? current.filter(item => item !== option.value)
														: [...current, option.value]
													onMetaChange('surfaceTypes', next)
												}}
												sx={{ minW: 'auto' }}
											>
												{option.label}
											</Button>
										</WrapItem>
									)
								})}
							</Wrap>
						</FormControl>
						{!mode && hasExistingRoute && (
							<Button
								as={motion.button}
								{...motionButtonProps}
								size={actionButtonSize}
								variant='outline'
								onClick={onEdit}
								sx={baseButtonStyles}
							>
								Редактировать маршрут
							</Button>
						)}
					</VStack>
				</Collapse>
				{status.error && (
					<Text fontSize='xs' color='red.500'>
						{status.error}
					</Text>
				)}
				{status.success && (
					<Text fontSize='xs' color='green.500'>
						Маршрут сохранён
					</Text>
				)}
			</VStack>
		</Box>
	)
}

export default React.memo(ManualRoutePanel)
