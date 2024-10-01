import React from 'react';
import {
  VStack,
  Text,
  FormControl,
  FormLabel,
  Input,
  Button,
  Checkbox,
  Select,
  Box,
  HStack,
  IconButton,
  Flex,
  Divider,
} from '@chakra-ui/react';
import { ChevronLeftIcon, ChevronRightIcon } from '@chakra-ui/icons';
import { CiRoute } from "react-icons/ci";

const DrawerMenu = ({
  dateRange,
  handleDateChange,
  handleSearch,
  showHeatmap,
  setShowHeatmap,
  heatmapStatus,
  handleHeatmapPeriodChange,
  heatmapPeriod,
  heatmapMonth,
  setHeatmapMonth,
  heatmapYear,
  setHeatmapYear,
  totalActiveDistance,
  routesState,
  toggleSession,
  handleScroll,
  carouselRef,
}) => {
  return (
    <VStack spacing={4} align="stretch">
      <VStack as="form" onSubmit={handleSearch} spacing={2} align="stretch">
        <FormControl isRequired>
          <FormLabel>Начальная дата</FormLabel>
          <Input
            type="date"
            name="start"
            value={dateRange.start}
            onChange={handleDateChange}
            borderColor="gray"
          />
        </FormControl>
        <FormControl isRequired>
          <FormLabel>Конечная дата</FormLabel>
          <Input
            type="date"
            name="end"
            value={dateRange.end}
            onChange={handleDateChange}
            borderColor="gray"
          />
        </FormControl>
      </VStack>
      
      <Divider />

      <VStack spacing={2} align="stretch">
        <Button
          onClick={() => setShowHeatmap(!showHeatmap)}
          isLoading={heatmapStatus.loading}
          colorScheme={showHeatmap ? 'blue' : 'green'}
          borderColor={showHeatmap ? 'gray' : 'blue'}
        >
          {showHeatmap ? 'Скрыть тепловую карту' : 'Показать тепловую карту'}
        </Button>
        {showHeatmap && (
          <>
            <Checkbox
              borderColor="gray.300"
              isChecked={heatmapPeriod === 'this_year'}
              onChange={(e) => handleHeatmapPeriodChange({ target: { value: e.target.checked ? 'this_year' : 'this_month' } })}
            >
              Годовая
            </Checkbox>
            {heatmapPeriod !== 'this_year' && (
              <Select
                value={heatmapMonth}
                borderColor="gray"
                onChange={(e) => setHeatmapMonth(Number(e.target.value))}
              >
                {[...Array(12)].map((_, i) => (
                  <option key={i} value={i + 1}>
                    {new Date(0, i).toLocaleString('default', { month: 'long' })}
                  </option>
                ))}
              </Select>
            )}
            <Select
              borderColor="gray"
              value={heatmapYear}
              onChange={(e) => setHeatmapYear(Number(e.target.value))}
            >
              {[...Array(2)].map((_, i) => {
                const year = new Date().getFullYear() - i;
                return <option key={year} value={year}>{year}</option>;
              })}
            </Select>
          </>
        )}
      </VStack>
      

      {/* Секция для общего пробега активных маршрутов */}
        {totalActiveDistance > 0 && (
          <Box position="absolute" bottom={90} left={0} right={0} m={2}>
          <Box p={2} borderWidth={1} borderRadius="md" borderColor="gray">
            <Text fontWeight="bold" fontSize="sm">
              Общий пробег маршрутов: {(totalActiveDistance / 1000).toFixed(2)} км
            </Text>
          </Box>
          </Box>
        )}

      {/* Секция для меню активных маршрутов */}
      {Object.keys(routesState.data).length > 0 && (
        <Box position="absolute" bottom={0} left={0} right={0} m={2}>
          <Text fontWeight="bold" mb={2}>Активные маршруты</Text>
          <Flex align="center">
            <IconButton
              icon={<ChevronLeftIcon />}
              onClick={() => handleScroll('left')}
              aria-label="Прокрутить влево"
              size="sm"
              borderWidth={1}
              borderColor="gray"
            />
            <Box
              ref={carouselRef}
              overflowX="auto"
              whiteSpace="nowrap"
              css={{
                '&::-webkit-scrollbar': { display: 'none' },
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
              }}
              flex={1}
            >
              <HStack spacing={2} p={2}>
                {Object.keys(routesState.data).map((sessionId) => (
                  <Button
                    key={sessionId}
                    size="sm"
                    colorScheme={routesState.visibleSessions[sessionId] ? "green" : "gray"}
                    onClick={() => toggleSession(sessionId)}
                    flexShrink={0}
                  >
                    <Text display="flex" alignItems="center">
                      <CiRoute size="17px" />
                      {(routesState.distances[sessionId] / 1000).toFixed(2)} км
                    </Text>
                  </Button>
                ))}
              </HStack>
            </Box>
            <IconButton
              icon={<ChevronRightIcon />}
              onClick={() => handleScroll('right')}
              aria-label="Прокрутить вправо"
              size="sm"
              borderWidth={1}
              borderColor="gray"
            />
          </Flex>
        </Box>
      )}
    </VStack>
  );
};

export default DrawerMenu;