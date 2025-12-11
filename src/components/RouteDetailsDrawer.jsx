import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
	Box,
	Drawer,
	DrawerBody,
	DrawerCloseButton,
	DrawerContent,
	DrawerHeader,
	DrawerOverlay,
	HStack,
	Tag,
	Text,
	VStack,
	Wrap,
	Divider,
} from '@chakra-ui/react'
import { MapContainer, Marker, Polyline, TileLayer } from 'react-leaflet'
import L from 'leaflet'
import {
	createRouteEndMarker,
	createRouteStartMarker,
} from './ModernMarkerIcon'
import { resolveRouteAuthor } from '../utils/routeFormatters'

const SURFACE_LABELS = {
	forest: 'Лесные дороги',
	sidewalks: 'Тротуары',
	bike_lanes: 'Велодорожки',
	road: 'Проезжая часть',
}

const DIFFICULTY_LABELS = {
	easy: 'Легкий',
	medium: 'Средний',
	hard: 'Сложный',
}

const RoutePreviewMap = ({ points = [], color, isOpen, mapKey }) => {
	const normalizePoint = point => {
		if (!point) return null
		if (Array.isArray(point) && point.length >= 2) {
			const lat = Number(point[0])
			const lng = Number(point[1])
			return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null
		}
		const latValue =
			point.lat ??
			point.latitude ??
			(Array.isArray(point.latLng) ? point.latLng[0] : point.latLng?.lat)
		const lngValue =
			point.lng ??
			point.longitude ??
			point.lon ??
			(Array.isArray(point.latLng) ? point.latLng[1] : point.latLng?.lng)
		const lat = Number(latValue)
		const lng = Number(lngValue)
		return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null
	}

	const positions = useMemo(() => {
		if (!Array.isArray(points)) return []
		return points.map(normalizePoint).filter(Boolean)
	}, [points])

	const bounds = useMemo(() => {
		if (positions.length < 2) return null
		return L.latLngBounds(positions.map(([lat, lng]) => L.latLng(lat, lng)))
	}, [positions])

	const mapRef = useRef(null)
	const [mapReady, setMapReady] = useState(false)

	useEffect(() => {
		if (mapRef.current && bounds && mapReady && isOpen) {
			const map = mapRef.current
			const fit = () => map.fitBounds(bounds, { padding: [20, 20] })
			fit()
			const raf = requestAnimationFrame(() => {
				map.invalidateSize()
				fit()
			})
			const timeout = setTimeout(() => {
				map.invalidateSize()
				fit()
			}, 250)
			return () => {
				cancelAnimationFrame(raf)
				clearTimeout(timeout)
			}
		}
		return undefined
	}, [bounds, isOpen, mapReady, positions])

	if (positions.length < 2) return null

	const startIcon = useMemo(
		() => createRouteStartMarker(color || '#4285f4'),
		[color]
	)
	const endIcon = useMemo(() => createRouteEndMarker(color || '#ea4335'), [color])

	const hasBounds = Boolean(bounds)
	const initialCenter = hasBounds ? undefined : positions[0]
	const initialZoom = hasBounds ? undefined : 13

	return (
		<Box
			borderWidth='1px'
			borderRadius='md'
			overflow='hidden'
			sx={{
				'& .leaflet-control-container': { display: 'none' },
			}}
		>
			<MapContainer
				key={mapKey}
				center={initialCenter}
				zoom={initialZoom}
				bounds={bounds || undefined}
				boundsOptions={{ padding: [20, 20] }}
				style={{ width: '100%', height: '220px' }}
				attributionControl={false}
				zoomControl={false}
				scrollWheelZoom={false}
				doubleClickZoom={false}
				dragging={false}
				touchZoom={false}
				boxZoom={false}
				keyboard={false}
				whenCreated={map => {
					mapRef.current = map
					if (bounds) {
						map.fitBounds(bounds, { padding: [20, 20] })
					} else if (positions[0]) {
						map.setView(positions[0], 13)
					}
					setMapReady(true)
				}}
			>
				<TileLayer url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png' />
				<Polyline
					positions={positions}
					pathOptions={{
						color: color || '#6366F1',
						weight: 4,
						opacity: 0.9,
					}}
				/>
				<Marker position={positions[0]} icon={startIcon} />
				<Marker position={positions[positions.length - 1]} icon={endIcon} />
			</MapContainer>
		</Box>
	)
}

const RouteDetailsDrawer = ({ isOpen, onClose, route }) => {
	if (!route) return null

	const {
		title,
		description,
		distanceText,
		createdAtText,
		color,
		points,
		author,
		surfaceTypes = [],
		difficulty = '',
		routeId,
		source,
	} = route

	const authorText = useMemo(() => {
		if (author) return author
		const metaAuthor = resolveRouteAuthor(route.meta || route)
		return metaAuthor || ''
	}, [author, route])
	const shouldShowAuthor = Boolean(authorText && source !== 'Мой маршрут')
	const hasPath = Array.isArray(points) && points.length >= 2
	const surfaceBadges = Array.isArray(surfaceTypes)
		? surfaceTypes.filter(Boolean)
		: []
	const difficultyLabel = difficulty ? DIFFICULTY_LABELS[difficulty] || difficulty : ''
	const accent = color || '#6366F1'

	return (
		<Drawer isOpen={isOpen} placement='bottom' onClose={onClose} size='full'>
			<DrawerOverlay />
			<DrawerContent
				bg='transparent'
				boxShadow='none'
				p={0}
				position='fixed'
				inset={0}
				pointerEvents='none'
			>
				<Box
					bg='white'
					borderTopRadius='20px'
					borderBottomRadius={0}
					h='auto'
					maxH='90vh'
					w='100%'
					maxW={{ base: '100%', md: '500px' }}
					overflow='hidden'
					position='absolute'
					left='50%'
					bottom={0}
					transform='translateX(-50%)'
					boxShadow='xl'
					mx='auto'
					mb={0}
					pointerEvents='auto'
				>
					<DrawerCloseButton top={4} right={4} />
					<DrawerHeader pb={2} pt={3} px={4}>
						<Box
							borderRadius='lg'
							bgGradient={`linear(to-r, ${accent}1a, ${accent}33)`}
							p={3}
							borderWidth='1px'
							borderColor='gray.100'
						>
							<VStack align='start' spacing={1.5}>
								<HStack spacing={2} align='center' flexWrap='wrap'>
									<Text fontSize='lg' fontWeight='semibold' color='gray.800'>
										{title || 'Маршрут'}
									</Text>
									{color ? (
										<HStack spacing={1.5} align='center'>
											<Box
												as='span'
												w='14px'
												h='14px'
												borderRadius='full'
												border='1px solid #E2E8F0'
												bg={color}
											/>
											<Text fontSize='xs' color='gray.600'>
												{color}
											</Text>
										</HStack>
									) : null}
								</HStack>
								{createdAtText ? (
									<Text fontSize='xs' color='gray.500'>
										{createdAtText}
									</Text>
								) : null}
							</VStack>
						</Box>
					</DrawerHeader>
					<DrawerBody
						pt={0}
						pb={0}
						px={4}
						display='block'
						maxH='calc(90vh - 84px)'
						overflowY='auto'
					>
						<VStack align='stretch' spacing={3} pb={4}>
							<Wrap spacing={2} shouldWrapChildren>
								{distanceText ? (
									<Tag size='sm' variant='subtle' colorScheme='blue'>
										{distanceText}
									</Tag>
								) : null}
								{shouldShowAuthor ? (
									<Tag size='sm' variant='subtle' colorScheme='gray'>
										Автор: {authorText}
									</Tag>
								) : null}
								<Tag
									size='sm'
									variant='subtle'
									colorScheme={difficultyLabel ? 'orange' : 'gray'}
								>
									Сложность: {difficultyLabel || 'не указана'}
								</Tag>
								{surfaceBadges.length > 0 ? (
									surfaceBadges.map(surface => (
										<Tag key={surface} size='sm' variant='subtle' colorScheme='gray'>
											{SURFACE_LABELS[surface] || surface}
										</Tag>
									))
								) : (
									<Tag size='sm' variant='subtle' colorScheme='gray'>
										Покрытие: не указано
									</Tag>
								)}
							</Wrap>

							<Box
								borderWidth='1px'
								borderColor='gray.200'
								borderRadius='md'
								bg='gray.50'
								p={3}
							>
								<Text
									fontSize='sm'
									color={description ? 'gray.800' : 'gray.500'}
									whiteSpace='pre-wrap'
									lineHeight='1.6'
								>
									{description || 'Описание отсутствует'}
								</Text>
							</Box>

							{shouldShowAuthor || routeId ? (
								<Box>
									<Divider my={2} />
									<Wrap spacing={2} shouldWrapChildren>
										{routeId ? (
											<Tag size='sm' variant='subtle' colorScheme='purple'>
												ID: {routeId}
											</Tag>
										) : null}
										{shouldShowAuthor ? (
											<Tag size='sm' variant='subtle' colorScheme='gray'>
												Автор: {authorText}
											</Tag>
										) : null}
									</Wrap>
								</Box>
							) : null}

							{hasPath ? (
								<RoutePreviewMap
									points={points}
									color={color}
									isOpen={isOpen}
									mapKey={`${routeId || 'route'}-${points?.length || 0}`}
								/>
							) : null}
						</VStack>
					</DrawerBody>
				</Box>
			</DrawerContent>
		</Drawer>
	)
}

export default RouteDetailsDrawer
