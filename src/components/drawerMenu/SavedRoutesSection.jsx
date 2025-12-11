import React from 'react'
import {
	Box,
	Button,
	HStack,
	IconButton,
	Text,
	Tooltip,
	VStack,
} from '@chakra-ui/react'
import {
	DeleteIcon,
	EditIcon,
	LinkIcon,
	ViewIcon,
	ViewOffIcon,
} from '@chakra-ui/icons'
import { FaMapMarkedAlt } from 'react-icons/fa'
import { subtleButtonStyles, subtleIconButtonStyles } from '../../styles/buttonStyles'

const ColorDot = ({ color }) => (
	<Box
		as='span'
		w='12px'
		h='12px'
		borderRadius='full'
		border='1px solid #ccc'
		bg={color || '#6366F1'}
		display='inline-block'
		flexShrink={0}
	/>
)

const SavedRoutesSection = ({
	savedRoutesStatus,
	savedRoutesSorted,
	paginatedSavedRoutes,
	visibleSavedRouteIds,
	publishedRoutesMap,
	expandedDescriptions,
	onToggleDescription,
	extractRouteDateText,
	renderRouteMetaTags,
	computeRouteDistanceText,
	extractSurfaceTypes,
	formatDifficulty,
	extractDifficulty,
	handleSavedRouteCardClick,
	handleRouteCardKeyDown,
	onToggleSavedRouteVisibility,
	handleShareRoute,
	handlePublishRoute,
	onEditSavedRoute,
	handleDeleteRoute,
	totalSavedRoutesPages,
	savedRoutesPage,
	setSavedRoutesPage,
	MotionBox,
	cardMotionProps,
}) => {
	return (
		<VStack spacing={3} align='stretch'>
			<Box>
				{savedRoutesStatus.error ? (
					<Text fontSize='xs' color='red.500' mb={2}>
						{savedRoutesStatus.error}
					</Text>
				) : null}
				{savedRoutesSorted.length === 0 ? (
					<Text fontSize='sm' color='gray.500'>
						Нет сохранённых маршрутов
					</Text>
				) : (
					<VStack spacing={2} align='stretch'>
						{paginatedSavedRoutes.map(route => {
							const isVisible = visibleSavedRouteIds.includes(route.routeId)
							const isPublished =
								route.routeId && Boolean(publishedRoutesMap[route.routeId])
							const cardKey = route.routeId || route.name
							const isExpanded = expandedDescriptions.has(cardKey)
							const shouldShowToggle =
								route.description &&
								typeof route.description === 'string' &&
								route.description.length > 90
							const surfaceTypes = extractSurfaceTypes(route)
							const difficultyLabel = formatDifficulty(extractDifficulty(route))
							const distanceText = computeRouteDistanceText(route)
							return (
								<MotionBox
									key={route.routeId}
									borderWidth='1px'
									borderRadius='md'
									p={2}
									borderColor={isVisible ? 'purple.200' : 'gray.100'}
									bg={isVisible ? 'purple.25' : 'white'}
									{...cardMotionProps}
									role='button'
									tabIndex={0}
									cursor='pointer'
									onClick={() => handleSavedRouteCardClick(route)}
									onKeyDown={event =>
										handleRouteCardKeyDown(event, () =>
											handleSavedRouteCardClick(route)
										)
									}
								>
									<HStack spacing={1.5} align='center'>
										<Text
											fontWeight='semibold'
											fontSize='sm'
											noOfLines={2}
											flex='1'
											wordBreak='break-word'
										>
											{route.name || 'Без названия'}
										</Text>
										<ColorDot color={route.color} />
									</HStack>
									<Text fontSize='xs' color='gray.500'>
										{extractRouteDateText(route)}
									</Text>
									{renderRouteMetaTags({
										distanceText,
										difficultyLabel,
										surfaceTypes,
									})}
									{route.description && (
										<>
											<Text
												fontSize='xs'
												color='gray.500'
												noOfLines={isExpanded ? undefined : 2}
												whiteSpace='pre-wrap'
												wordBreak='break-word'
											>
												{route.description}
											</Text>
											{shouldShowToggle && (
												<Button
													size='xs'
													variant='link'
													alignSelf='flex-start'
													onClick={event => {
														event.stopPropagation()
														onToggleDescription(cardKey)
													}}
												>
													{isExpanded ? 'Свернуть' : 'Показать полностью'}
												</Button>
											)}
										</>
									)}
									<HStack justify='space-between' mt={2}>
										<Tooltip
											label={isVisible ? 'Скрыть маршрут' : 'Показать маршрут'}
											hasArrow
										>
											<IconButton
												size='xs'
												variant='ghost'
												colorScheme={isVisible ? 'blue' : 'gray'}
												icon={isVisible ? <ViewOffIcon /> : <ViewIcon />}
												onClick={event => {
													event.stopPropagation()
													onToggleSavedRouteVisibility(route.routeId)
												}}
												aria-label={
													isVisible ? 'Скрыть маршрут' : 'Показать маршрут'
												}
												sx={subtleIconButtonStyles}
											/>
										</Tooltip>
										<HStack spacing={1}>
											<Tooltip label='Поделиться ссылкой' hasArrow>
												<IconButton
													size='xs'
													variant='ghost'
													colorScheme='teal'
													icon={<LinkIcon />}
													onClick={event => {
														event.stopPropagation()
														handleShareRoute(route)
													}}
													aria-label='Поделиться ссылкой'
													sx={subtleIconButtonStyles}
												/>
											</Tooltip>
											<Tooltip
												label={
													isPublished
														? 'Маршрут уже опубликован'
														: 'Опубликовать на карте'
												}
												hasArrow
											>
												<IconButton
													size='xs'
													variant={isPublished ? 'solid' : 'outline'}
													colorScheme={isPublished ? 'purple' : 'gray'}
													icon={<FaMapMarkedAlt />}
													onClick={event => {
														event.stopPropagation()
														handlePublishRoute(route)
													}}
													aria-label='Опубликовать на карте'
													isActive={isPublished}
													opacity={1}
													sx={{
														...subtleIconButtonStyles,
														bg: isPublished ? 'purple.100' : 'white',
														color: isPublished ? 'purple.700' : 'gray.700',
														borderColor: isPublished ? 'purple.400' : 'gray.300',
														fontWeight: 'bold',
													}}
												/>
											</Tooltip>
											<Tooltip label='Редактировать' hasArrow>
												<IconButton
													size='xs'
													variant='ghost'
													icon={<EditIcon />}
													onClick={event => {
														event.stopPropagation()
														onEditSavedRoute(route)
													}}
													aria-label='Редактировать'
													sx={subtleIconButtonStyles}
												/>
											</Tooltip>
											<Tooltip label='Удалить' hasArrow>
												<IconButton
													size='xs'
													variant='ghost'
													colorScheme='red'
													icon={<DeleteIcon />}
													onClick={event => {
														event.stopPropagation()
														handleDeleteRoute(route)
													}}
													aria-label='Удалить'
													sx={subtleIconButtonStyles}
												/>
											</Tooltip>
										</HStack>
									</HStack>
								</MotionBox>
							)
						})}
						{totalSavedRoutesPages > 1 && (
							<HStack justify='center' pt={2} spacing={4}>
								<Button
									size='xs'
									variant='ghost'
									onClick={() => setSavedRoutesPage(prev => Math.max(1, prev - 1))}
									isDisabled={savedRoutesPage === 1}
									sx={subtleButtonStyles}
								>
									Назад
								</Button>
								<Text fontSize='xs' color='gray.600'>
									{savedRoutesPage} / {totalSavedRoutesPages}
								</Text>
								<Button
									size='xs'
									variant='ghost'
									onClick={() =>
										setSavedRoutesPage(prev =>
											Math.min(totalSavedRoutesPages, prev + 1)
										)
									}
									isDisabled={savedRoutesPage === totalSavedRoutesPages}
									sx={subtleButtonStyles}
								>
									Вперёд
								</Button>
							</HStack>
						)}
					</VStack>
				)}
			</Box>
		</VStack>
	)
}

export default SavedRoutesSection
