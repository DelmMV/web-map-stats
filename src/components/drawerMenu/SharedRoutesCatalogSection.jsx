import React from 'react'
import { Box, Button, HStack, Spinner, Text, VStack } from '@chakra-ui/react'
import { subtleButtonStyles } from '../../styles/buttonStyles'
import { resolveRouteAuthor } from '../../utils/routeFormatters'

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

const SharedRoutesCatalogSection = ({
	sharedRoutesCatalogStatus,
	catalogRoutesList,
	paginatedSharedRoutes,
	sharedRouteDetails,
	extractDescription,
	userId,
	authorName,
	resolveAuthor = resolveRouteAuthor,
	extractRouteDateText,
	formatRouteDate,
	renderRouteMetaTags,
	extractSurfaceTypes,
	formatDifficulty,
	extractDifficulty,
	handleSharedRouteCardClick,
	handleRouteCardKeyDown,
	onOpenSharedRouteFromCatalog,
	expandedDescriptions,
	onToggleDescription,
	UNKNOWN_DATE_LABEL,
	MotionBox,
	cardMotionProps,
	totalSharedRoutesPages,
	sharedRoutesPage,
	setSharedRoutesPage,
}) => (
	<VStack spacing={3} align='stretch'>
		{sharedRoutesCatalogStatus.loading ? (
			<HStack spacing={2} color='gray.600'>
				<Spinner size='sm' />
				<Text fontSize='sm'>Загружаем каталог...</Text>
			</HStack>
		) : sharedRoutesCatalogStatus.error ? (
			<Text fontSize='sm' color='red.500'>
				{sharedRoutesCatalogStatus.error}
			</Text>
		) : catalogRoutesList.length === 0 ? (
			<Text fontSize='sm' color='gray.500'>
				Нет маршрутов в текущей области
			</Text>
		) : (
			<VStack spacing={2}>
				{paginatedSharedRoutes.map(item => {
					if (!item) return null
					const name = item.name || item.route?.name
					const distanceKm =
						typeof item.distanceKm === 'number'
							? item.distanceKm
							: typeof item.route?.distanceKm === 'number'
							? item.route.distanceKm
							: null
					const createdAt = item.createdAt || item.route?.createdAt
					const detailedRoute = (item.sharedId && sharedRouteDetails[item.sharedId]) || null
					const description =
						extractDescription(detailedRoute) ||
						extractDescription(item) ||
						extractDescription(item.route) ||
						extractDescription(item.meta)
					const cardKey = item.sharedId || item.routeId || item.name || name
					const isExpanded = expandedDescriptions.has(cardKey)
					const shouldShowToggle = description && description.length > 90
					const metaParts = []
					const authorText =
						resolveAuthor(detailedRoute || item.route || item, {
							currentUserId: userId,
							currentUserName: authorName,
						}) || 'Неизвестно'
					metaParts.push(`Автор: ${authorText}`)
					const resolvedDateText = extractRouteDateText(detailedRoute || item.route || item)
					const dateText =
						resolvedDateText !== UNKNOWN_DATE_LABEL || !createdAt
							? resolvedDateText
							: formatRouteDate(createdAt)
					metaParts.push(dateText)
					const surfaceTypes = extractSurfaceTypes(detailedRoute || item.route || item)
					const difficultyLabel = formatDifficulty(extractDifficulty(detailedRoute || item.route || item))
					const distanceText = typeof distanceKm === 'number' ? `${distanceKm.toFixed(2)} км` : null
					const cardColor = detailedRoute?.color || item.color || item.route?.color || '#6366F1'
					return (
						<MotionBox
							key={cardKey}
							borderWidth='1px'
							borderRadius='md'
							p={2}
							borderColor='gray.100'
							bg='white'
							{...cardMotionProps}
							role='button'
							tabIndex={0}
							cursor='pointer'
							onClick={() => handleSharedRouteCardClick(item)}
							onKeyDown={event => handleRouteCardKeyDown(event, () => handleSharedRouteCardClick(item))}
						>
							<VStack align='stretch' spacing={0.5}>
								<HStack spacing={1.5} align='center'>
									<Text
										fontWeight='semibold'
										fontSize='sm'
										noOfLines={2}
										wordBreak='break-word'
										flex='1'
									>
										{name || 'Без названия'}
									</Text>
									<ColorDot color={cardColor} />
								</HStack>
								<Text fontSize='xs' color='gray.600' noOfLines={2}>
									{metaParts.join(' • ')}
								</Text>
								{renderRouteMetaTags({
									distanceText,
									difficultyLabel,
									surfaceTypes,
								})}
								<Text
									fontSize='xs'
									color={description ? 'gray.600' : 'gray.400'}
									whiteSpace='pre-wrap'
									wordBreak='break-word'
									noOfLines={isExpanded ? undefined : 2}
								>
									{description || 'Описание отсутствует'}
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
								<Button
									size='xs'
									mt={0.5}
									variant='outline'
									colorScheme='purple'
									alignSelf='flex-start'
									onClick={event => {
										event.stopPropagation()
										onOpenSharedRouteFromCatalog(item.sharedId)
									}}
									sx={subtleButtonStyles}
								>
									Открыть
								</Button>
							</VStack>
						</MotionBox>
					)
				})}
				{totalSharedRoutesPages > 1 && (
					<HStack justify='center' pt={2} spacing={2}>
						<Button
							size='xs'
							onClick={() => setSharedRoutesPage(prev => Math.max(1, prev - 1))}
							isDisabled={sharedRoutesPage === 1}
						>
							Назад
						</Button>
						<Text fontSize='xs' color='gray.600'>
							{sharedRoutesPage} / {totalSharedRoutesPages}
						</Text>
						<Button
							size='xs'
							onClick={() =>
								setSharedRoutesPage(prev => Math.min(totalSharedRoutesPages, prev + 1))
							}
							isDisabled={sharedRoutesPage === totalSharedRoutesPages}
						>
							Вперёд
						</Button>
					</HStack>
				)}
			</VStack>
		)}
	</VStack>
)

export default SharedRoutesCatalogSection
