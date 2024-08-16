import React, { useState, useEffect } from 'react';
import { Box, Heading, Text, Stack, Spinner } from '@chakra-ui/react';

const WeeklyStats = ({ userId }) => {
	const [stats, setStats] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	
	useEffect(() => {
		const fetchStats = async () => {
			setLoading(true);
			setError(null);
			try {
				const response = await fetch(`http://localhost:5001/api/user-stats/week/${userId}`);
				if (!response.ok) {
					throw new Error(`HTTP error! Status: ${response.status}`);
				}
				const data = await response.json();
				setStats(data);
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
			<Box p={5} maxW="800px" mx="auto">
				<Heading mb={5}>Мой недельный пробег</Heading>
				
				{loading ? (
						<Spinner size="xl" />
				) : error ? (
						<Text color="red.500">{error}</Text>
				) : (
						stats && (
								<Box>
									<Text fontWeight="bold">Общая дистанция: {stats.totalDistance.toFixed(2)} km</Text>
									<Text fontWeight="bold">Средняя скорость: {stats.averageSpeed.toFixed(2)} km/h</Text>
									
									<Heading size="md" mt={5} mb={3}>Недельная статистика</Heading>
									<Stack spacing={3}>
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
