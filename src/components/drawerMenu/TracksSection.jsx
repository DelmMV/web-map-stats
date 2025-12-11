import React from 'react'
import { Box, Button, Collapse, FormControl, HStack, Input, Text, VStack } from '@chakra-ui/react'
import { subtleButtonStyles } from '../../styles/buttonStyles'

const TracksSection = ({
	showDailyTracks,
	setShowDailyTracks,
	selectedDate,
	onDateChange,
	trackStatus,
	trackList,
	renderTracks,
	showRecentTracks,
	setShowRecentTracks,
	recentTracksStatus,
	recentTracks,
	paginatedRecentTracks,
	totalRecentTracksPages,
	recentTracksPage,
	setRecentTracksPage,
}) => (
	<VStack spacing={3} align='stretch'>
		<Box>
			<HStack
				as='button'
				onClick={() => setShowDailyTracks(prev => !prev)}
				justify='space-between'
				w='100%'
				py={2}
			>
				<Text fontWeight='semibold' fontSize='md'>
					Треки за выбранный день
				</Text>
				<Text fontSize='xs' color='gray.500'>
					{showDailyTracks ? '▲' : '▼'}
				</Text>
			</HStack>
			<Collapse in={showDailyTracks} animateOpacity style={{ overflow: 'hidden' }}>
				<Box mt={1}>
					<FormControl isRequired mt={2}>
						<Input type='date' value={selectedDate} onChange={onDateChange} borderColor='gray' />
					</FormControl>
					{trackStatus?.loading ? (
						<Text fontSize='sm' color='gray.500' mt={2}>
							Загружаем треки...
						</Text>
					) : trackStatus?.error ? (
						<Text fontSize='sm' color='red.500' mt={2}>
							{trackStatus.error}
						</Text>
					) : trackList.length === 0 ? (
						<Text fontSize='sm' color='gray.500' mt={2}>
							Нет треков для отображения
						</Text>
					) : (
						<Box mt={2}>{renderTracks(trackList)}</Box>
					)}
				</Box>
			</Collapse>
		</Box>

		<Box>
			<HStack
				as='button'
				onClick={() => setShowRecentTracks(prev => !prev)}
				justify='space-between'
				w='100%'
				py={2}
			>
				<Text fontWeight='semibold' fontSize='md'>
					Последние треки (3 мес)
				</Text>
				<Text fontSize='xs' color='gray.500'>
					{showRecentTracks ? '▲' : '▼'}
				</Text>
			</HStack>
			<Collapse in={showRecentTracks} animateOpacity style={{ overflow: 'hidden' }}>
				<Box mt={1}>
					{recentTracksStatus?.loading ? (
						<Text fontSize='sm' color='gray.500' mt={2}>
							Загружаем треки...
						</Text>
					) : recentTracksStatus?.error ? (
						<Text fontSize='sm' color='red.500' mt={2}>
							{recentTracksStatus.error}
						</Text>
					) : recentTracks.length === 0 ? (
						<Text fontSize='sm' color='gray.500' mt={2}>
							Нет треков для отображения
						</Text>
					) : (
						<>
							<Box mt={1}>{renderTracks(paginatedRecentTracks)}</Box>
							{totalRecentTracksPages > 1 && (
								<HStack mt={2} justify='center' spacing={2}>
									<Button
										size='xs'
										onClick={() => setRecentTracksPage(prev => Math.max(1, prev - 1))}
										isDisabled={recentTracksPage === 1}
										sx={subtleButtonStyles}
									>
										Назад
									</Button>
									<Text fontSize='xs' color='gray.600'>
										{recentTracksPage} / {totalRecentTracksPages}
									</Text>
									<Button
										size='xs'
										onClick={() =>
											setRecentTracksPage(prev =>
												Math.min(totalRecentTracksPages, prev + 1)
											)
										}
										isDisabled={recentTracksPage === totalRecentTracksPages}
										sx={subtleButtonStyles}
									>
										Вперёд
									</Button>
								</HStack>
							)}
						</>
					)}
				</Box>
			</Collapse>
		</Box>
	</VStack>
)

export default TracksSection
