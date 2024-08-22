import React, { useState, useEffect } from 'react';
import {Box, Text, Stack, Spinner, Badge, Divider} from '@chakra-ui/react';

const WeeklyStats = ({ userId }) => {
	const [stats, setStats] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [todayDistance, setTodayDistance] = useState(null);
	
	useEffect(() => {
		const fetchStats = async () => {
			setLoading(true);
			setError(null);
			try {
				const response = await fetch(`https://monopiter.ru/api/user-stats/week/${userId}`);
				if (!response.ok) {
					throw new Error(`HTTP error! Status: ${response.status}`);
				}
				const data = await response.json();
				setStats(data);
				
				// Определение текущего дня недели
				const daysOfWeek = ["Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"];
				const todayIndex = new Date().getDay();
				const today = daysOfWeek[todayIndex];
				
				// Получение пробега за сегодняшний день
				const todayStat = data.dailyStats.find(stat => stat.day === today);
				setTodayDistance(todayStat ? todayStat.distance.toFixed(2) : '0.00');
				
			} catch (error) {
				console.error('Error fetching weekly stats:', error);
				setError('Failed to load data');
			} finally {
				setLoading(false);
			}
		};
		
		fetchStats();
	}, [userId]);
	
	return (
			<Box p={5} maxW="800px" mx="auto" marginBottom="60px">
				<Box align="center">
					<Badge   bgColor="gray.100"
									 mb={5}
									 borderRadius={10}
									 fontSize={23}>
						Недельный пробег
					</Badge>
				</Box>
				<Divider bg="black.700"/>
				{loading ? (
						<Box align="center">
							<Spinner size="xl" />
						</Box>
				) : error ? (
						<Text color="red.500">{error}</Text>
				) : (
						stats && (
								<Box>
									<Text fontWeight="bold">Общий пробег: {stats.totalDistance.toFixed(2)} km</Text>
									<Text color="blue.500" fontWeight="bold">Дневной пробег: {todayDistance} km</Text>
									<Text fontWeight="bold">Средняя скорость: {stats.averageSpeed.toFixed(2)} km/h</Text>
									
									{/*<Heading size="md" mt={2} mb={3}>Недельная статистика</Heading>*/}
									<Stack spacing={3} mt={3}>
										{stats.dailyStats.map((dayStat, index) => (
												<Box
														key={index}
														p={3}
														borderWidth="1px"
														borderRadius="lg"
														overflow="hidden"
														bg="gray.100"
												>
													<Text fontWeight="bold">{dayStat.day}</Text>
													<Text>Расстояние: {dayStat.distance.toFixed(2)} km</Text>
													<Text>Средняя скорость: {dayStat.averageSpeed.toFixed(2)} km/h</Text>
												</Box>
										))}
									</Stack>
								</Box>
						)
				)}
			</Box>
	);
};

export default WeeklyStats;
