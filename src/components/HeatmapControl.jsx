import {
	Box,
	FormControl,
	FormLabel,
	HStack,
	IconButton,
	Popover,
	PopoverArrow,
	PopoverBody,
	PopoverCloseButton,
	PopoverContent,
	PopoverHeader,
	PopoverTrigger,
	Select,
	Switch,
	Text,
	VStack,
} from '@chakra-ui/react'
import { FaFire } from 'react-icons/fa'
import { motion } from 'framer-motion'
import {
	baseIconButtonStyles,
	motionButtonProps,
} from '../styles/buttonStyles'

const HeatmapControl = ({
	position = { top: '430px', left: '11px' },
	inline = false,
	showHeatmap,
	onToggleHeatmap,
	heatmapStatus,
	heatmapPeriod,
	handleHeatmapPeriodChange,
	heatmapMonth,
	setHeatmapMonth,
	heatmapYear,
	setHeatmapYear,
}) => {
	return (
		<Box
			position={inline ? 'relative' : 'absolute'}
			{...(!inline ? position : {})}
			zIndex={1000}
			display={inline ? 'inline-flex' : 'block'}
		>
			<Popover placement='right-start' closeOnBlur>
				{({ onClose }) => (
					<>
						<PopoverTrigger>
							<IconButton
								as={motion.button}
								{...motionButtonProps}
								variant='solid'
								icon={<FaFire />}
								colorScheme={showHeatmap ? 'orange' : 'gray'}
								size='md'
								borderRadius={3}
								borderColor='gray'
								borderWidth={2}
								width='34px'
								padding='0'
								aria-label='Управление тепловой картой'
								sx={baseIconButtonStyles}
							/>
						</PopoverTrigger>
						<PopoverContent
							w='260px'
							boxShadow='lg'
							borderColor='gray.200'
							_onFocus={() => {}}
						>
							<PopoverArrow />
							<PopoverCloseButton />
							<PopoverHeader fontWeight='bold'>
								Тепловая карта
							</PopoverHeader>
							<PopoverBody>
								<VStack spacing={3} align='stretch'>
									<HStack justify='space-between'>
										<Text fontSize='sm'>Показать карту</Text>
										<Switch
											isChecked={showHeatmap}
											onChange={() => {
												onToggleHeatmap()
												if (showHeatmap) {
													onClose()
												}
											}}
											isDisabled={heatmapStatus.loading}
											colorScheme='orange'
										/>
									</HStack>
									{heatmapStatus.loading && (
										<Text fontSize='xs' color='gray.500'>
											Загрузка данных...
										</Text>
									)}
									{heatmapStatus.error && (
										<Text fontSize='xs' color='red.500'>
											{heatmapStatus.error}
										</Text>
									)}
									{showHeatmap && (
										<>
											<FormControl>
												<FormLabel fontSize='sm'>
													Период
												</FormLabel>
												<Select
													value={heatmapPeriod}
													onChange={handleHeatmapPeriodChange}
													borderColor='gray.300'
													size='sm'
												>
													<option value='this_month'>
														Текущий месяц
													</option>
													<option value='last_month'>
														Прошлый месяц
													</option>
													<option value='this_year'>
														Текущий год
													</option>
												</Select>
											</FormControl>
											{heatmapPeriod !== 'this_year' && (
												<FormControl>
													<FormLabel fontSize='sm'>
														Месяц
													</FormLabel>
													<Select
														value={heatmapMonth}
														onChange={e =>
															setHeatmapMonth(
																Number(e.target.value)
															)
														}
														borderColor='gray.300'
														size='sm'
													>
														{[...Array(12)].map((_, i) => (
															<option key={i} value={i + 1}>
																{new Date(0, i).toLocaleString(
																	'default',
																	{
																		month: 'long',
																	}
																)}
															</option>
														))}
													</Select>
												</FormControl>
											)}
											<FormControl>
												<FormLabel fontSize='sm'>Год</FormLabel>
												<Select
													value={heatmapYear}
													onChange={e =>
														setHeatmapYear(Number(e.target.value))
													}
													borderColor='gray.300'
													size='sm'
												>
													{[...Array(3)].map((_, i) => {
														const year = new Date().getFullYear() - i
														return (
															<option key={year} value={year}>
																{year}
															</option>
														)
													})}
												</Select>
											</FormControl>
										</>
									)}
								</VStack>
							</PopoverBody>
						</PopoverContent>
					</>
				)}
			</Popover>
		</Box>
	)
}

export default HeatmapControl
