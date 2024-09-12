import React, { useState, useEffect } from 'react';
import {
	Box,
	Text,
	Select,
	Stack,
	Spinner,
	Badge,
	Tabs,
	TabList,
	TabPanels,
	Tab,
	TabPanel,
	Progress,
	Flex
} from '@chakra-ui/react';

const TopUsers = ({userId, admins}) => {
	const [topUsers, setTopUsers] = useState([]);
	const [topSessions, setTopSessions] = useState([]);
	const [topDailyDistances, setTopDailyDistances] = useState([]);
	const [totalDistance, setTotalDistance] = useState([]);
	const [period, setPeriod] = useState('last_week');
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
 const [distanceComparison, setDistanceComparison] = useState(null);
 console.log(admins); // Это выведет массив adminIds
	const adminIds = admins
	
	useEffect(() => {
	const fetchData = async () => {
  setLoading(true);
  setError(null);
  try {
    const responses = await Promise.all([
      fetch(`https://monopiter.ru/api/top-users/${period}`),
      fetch(`https://monopiter.ru/api/top-sessions/${period}`),
      fetch(`https://monopiter.ru/api/top-daily-distances/${period}`),
      fetch(`https://monopiter.ru/api/total-distance/${period}`),
      fetch(`https://monopiter.ru/api/total-category-by-distance/${period}`)
    ]);

    const results = await Promise.all(responses.map(async (response) => {
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
      }
      return response.json();
    }));

    const [usersData, sessionsData, dailyDistancesData, totalDistanceData, comparisonData] = results;

    setTopUsers(usersData);
    setTopSessions(sessionsData.topSessions || []);
    setTopDailyDistances(dailyDistancesData.topDailyDistances || []);
    setTotalDistance(totalDistanceData.totalDistance || 0);
    setDistanceComparison(comparisonData);
  } catch (error) {
    console.error('Error fetching data:', error);
    setError(error.message);
  } finally {
    setLoading(false);
  }
};
    
    fetchData();
  }, [period]);
	
	const renderUsersList = (users) => (
			<Stack spacing={3}>
				{users.length === 0 ? (
						<Text>No users found.</Text>
				) : (
						users.map((user, index) => (
								<Box
										key={user.userId}
										p={1.5}
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
	);
	
 const renderDistanceComparison = () => {
    if (!distanceComparison) return null;
    console.log(distanceComparison.northDistance);
    return (
      <Box mt={2} mb={3}>
        <Flex align="center">
          <Text fontSize="xs" width="50px">Север</Text>
          <Progress
            value={distanceComparison.percentageInNorth}
            size="sm"
            width="100%"
            colorScheme="blue"
            bg="red"
          />
          <Text fontSize="xs" width="30px" textAlign="right">Юг</Text>
        </Flex>
        <Flex justify="space-between" mt={1}>
          <Text fontSize="xs">({distanceComparison.percentageInNorth}%)</Text>
          <Text fontSize="xs">({distanceComparison.percentageInSouth}%)</Text>
        </Flex>
      </Box>
    );
  };
	
	const renderSessionsList = (sessions) => (
			<Stack spacing={3}>
				{sessions.length === 0 ? (
						<Text>No sessions found.</Text>
				) : (
						sessions.map((session, index) => (
								<Box
										key={`${index}-${session.sessionId}`}
										p={1.5}
										borderWidth="1px"
										borderRadius="lg"
										overflow="hidden"
										bg="gray.100"
								>
									<Text fontWeight="bold">
										#{index + 1} {session.username}
									</Text>
									<Text>Длительность: {session.duration.toFixed(0)} мин</Text>
									<Text>Расстояние: {session.distance.toFixed(2)} km</Text>
								</Box>
						))
				)}
			</Stack>
	);
	
	const renderDailyDistancesList = (dailyDistances) => (
			<Stack spacing={3}>
				{dailyDistances.length === 0 ? (
						<Text>No daily distances found.</Text>
				) : (
						dailyDistances.map((day, index) => (
								<Box
										key={`${day.userId}-${day.date}`}
										p={1.5}
										borderWidth="1px"
										borderRadius="lg"
										overflow="hidden"
										bg="gray.100"
								>
									<Text fontWeight="bold">
										#{index + 1} {day.username}
									</Text>
									<Text>Дата: {day.date}</Text>
									<Text>Расстояние: {day.distance.toFixed(2)} km</Text>
								</Box>
						))
				)}
			</Stack>
	);
	
	return (
			<Box p={5} maxW="800px" mx="auto" marginBottom="60px">
				<Box align="center">
					<Badge mb={5} fontSize={27} bgColor="gray.100" borderRadius={10}>Топ 50</Badge>
				</Box>
				<Box display="flex" flexDirection="row" alignItems="center" m={0} p={0}>
				<Select
						value={period}
						onChange={(e) => setPeriod(e.target.value)}
						mb={5}
				>{adminIds.includes(userId) ? (
						<>
						<option value="this_week">Текущая неделя</option>
						<option value="this_month">Текущий месяц</option>
						<option value="last_week">Прошедшая неделя</option>
						<option value="last_month">Прошедшый месяц</option>
						</>
					) : (
							<>
							<option value="last_week">Прошлая неделя</option>
							<option value="last_month">Прошлый месяц</option>
							</>
					)}
				</Select>
				</Box>
				{loading ? (
						<Box align="center">
							<Spinner size="xl"/>
						</Box>
				) : error ? (
    <Text color="red.500">
        {error === "No data found for the specified period"
          ? "Нет данных за указанный период"
          : `Ошибка загрузки данных: ${error}`}
      </Text>
				) : (
						
						<Box>
            {renderDistanceComparison()}
						<Tabs>
							<TabList>
								<Tab fontSize="smaller">Общий пробег</Tab>
								<Tab fontSize="smaller">Длина трека</Tab>
								<Tab fontSize="smaller">Дневной пробег</Tab>
							</TabList>
							
							<TabPanels>
								<TabPanel>
									{renderUsersList(topUsers)}
								</TabPanel>
								<TabPanel>
									{renderSessionsList(topSessions)}
								</TabPanel>
								<TabPanel>
									{renderDailyDistancesList(topDailyDistances)}
								</TabPanel>
							</TabPanels>
						</Tabs>
						</Box>
				)}
			</Box>
	);
};

export default TopUsers;
