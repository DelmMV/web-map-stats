import React, { useState, useEffect } from 'react';
import { Box, Text, Stack, Spinner, Badge, Card, CardBody } from '@chakra-ui/react';

const WeeklyStats = ({ userId }) => {
  const [stats, setStats] = useState(null);
  const [distanceCategory, setDistanceCategory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [todayDistance, setTodayDistance] = useState(null);
  
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [weeklyStatsResponse, distanceCategoryResponse] = await Promise.all([
          fetch(`https://monopiter.ru/api/user-stats/week/${userId}`),
          fetch(`https://monopiter.ru/api/user-category-by-distance/${userId}`)
        ]);
        
        if (!weeklyStatsResponse.ok || !distanceCategoryResponse.ok) {
          throw new Error(`HTTP error! Status: ${weeklyStatsResponse.status} ${distanceCategoryResponse.status}`);
        }
        
        const [weeklyData, categoryData] = await Promise.all([
          weeklyStatsResponse.json(),
          distanceCategoryResponse.json()
        ]);
        
        setStats(weeklyData);
        setDistanceCategory(categoryData);
        
        const daysOfWeek = ["Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"];
        const todayIndex = new Date().getDay();
        const today = daysOfWeek[todayIndex];
        
        const todayStat = weeklyData.dailyStats.find(stat => stat.day === today);
        setTodayDistance(todayStat ? todayStat.distance.toFixed(2) : '0.00');
        
      } catch (error) {
        console.error('Error fetching data:', error);
        setError('Failed to load data');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [userId]);
  
  return (
    <Box p={5} maxW="800px" mx="auto" marginBottom="60px">
      <Box align="center">
        <Badge bgColor="gray.100" borderRadius={10} fontSize={23}>
          Общая статистика
        </Badge>
      </Box>
      {loading ? (
        <Box align="center">
          <Spinner size="xl" />
        </Box>
      ) : error ? (
        <Text color="red.500">{error}</Text>
      ) : (
        stats && distanceCategory && (
          <Box>
            <Card mb={3} mt={3}>
              <CardBody p={2}>
                <Text>Общее расстояние: <Text as="span">{distanceCategory.totalDistance} km</Text></Text>
                <Text>Недельный пробег: <Text as="span">{stats.totalDistance.toFixed(2)} km</Text></Text>
                <Text>Дневной пробег: <Text as="span">{todayDistance} km</Text></Text>
              </CardBody>
            </Card>
            <Card mb={3}>
              <CardBody p={2}>
                {distanceCategory.category === 'north' ? (
                  <Text>
                    <Text as="span" color="blue.400" fontWeight="bold">Братство Cеверного Бублика:</Text>
                  </Text>
                ) : (
                  <Text>
                    <Text as="span" color="red" fontWeight="bold">Южный СКА Сквад:</Text>
                  </Text>
                )}
                <Text>Пробег на севере: <Text as="span" color="blue.400">{distanceCategory.northDistance} km ({distanceCategory.percentageInNorth}%)</Text></Text>
                <Text>Пробег на юге: <Text as="span" color="red">{distanceCategory.southDistance} km ({distanceCategory.percentageInSouth}%)</Text></Text>
              </CardBody>
            </Card>
            
            <Box align="center">
              <Badge bgColor="gray.100" borderRadius={10} fontSize={20}>
                Недельный пробег
              </Badge>
            </Box>
            
            <Stack spacing={3} mt={3}>
              {stats.dailyStats.map((dayStat, index) => (
                <Box
                  key={index}
                  p={1.5}
                  borderWidth="1px"
                  borderRadius="lg"
                  overflow="hidden"
                  bg="gray.100"
                >
                  <Text fontWeight="bold">{dayStat.day}</Text>
                  <Text>Расстояние: <Text as="span">{dayStat.distance.toFixed(2)} km</Text></Text>
                  <Text>Средняя скорость: <Text as="span">{dayStat.averageSpeed.toFixed(2)} km/h</Text></Text>
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
