import React, { useState, useEffect } from 'react';
import { Box, Heading, Text, Select, Stack, Spinner } from '@chakra-ui/react';

const TopUsers = () => {
	const [users, setUsers] = useState([]);
	const [period, setPeriod] = useState('week');
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	
	useEffect(() => {
		const fetchData = async () => {
			setLoading(true);
			setError(null);
			try {
				const response = await fetch(`http://188.243.88.61:5001/api/top-users/${period}`);
				if (!response.ok) {
					throw new Error(`HTTP error! Status: ${response.status}`);
				}
				const data = await response.json();
				setUsers(data);
			} catch (error) {
				console.error('Error fetching top users:', error);
				setError('Failed to load data');
			} finally {
				setLoading(false);
			}
		};
		
		fetchData();
	}, [period]);
	
	return (
			<Box p={5} maxW="800px" mx="auto">
				<Heading mb={5}>Топ 10</Heading>
				<Select
						value={period}
						onChange={(e) => setPeriod(e.target.value)}
						mb={5}
				>
					<option value="week">Неделя</option>
					<option value="month">Месяц</option>
				</Select>
				
				{loading ? (
						<Box align="center">
							<Spinner size="xl"/>
						</Box>
				) : error ? (
						<Text color="red.500">{error}</Text>
				) : (
						<Stack spacing={3}>
							{users.length === 0 ? (
									<Text>No users found.</Text>
							) : (
									users.map((user, index) => (
											<Box
													key={user.userId}
													p={3}
													borderWidth="1px"
													borderRadius="lg"
													overflow="hidden"
													bg="gray.100"
											>
												<Text fontWeight="bold">
													#{index + 1} {user.username}
												</Text>
												<Text>Расстояние: {user.distance.toFixed(2)} km</Text>
											</Box>
									))
							)}
						</Stack>
				)}
			</Box>
	);
};

export default TopUsers;
