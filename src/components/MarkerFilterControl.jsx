import React, { useState } from 'react';
import {
  Box,
  Menu,
  MenuButton,
  MenuList,
  Checkbox,
  Text,
  VStack,
  IconButton
} from '@chakra-ui/react';
import { FaFilter } from "react-icons/fa";

function MarkerFilterControl({ onFilterChange }) {
  const [filters, setFilters] = useState({
    charging: true,
    chargingAuto: true,
    interesting: true,
    danger: true,
    chat: true,
  });

  const handleFilterChange = (type) => {
    const newFilters = { ...filters, [type]: !filters[type] };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const filterLabels = {
    charging: 'Зарядки',
    chargingAuto: 'Автомобильные зарядки',
    interesting: 'Интересные места',
    danger: 'Опасные места',
    chat: 'Разговорчики',
  };

  return (
    <Box
      position="absolute"
      top="120px" 
      left="11px"
      zIndex={1000}
    >
    <Menu closeOnSelect={false}>
    <MenuButton 
      as={IconButton}
      aria-label="Фильтр маркеров"
      icon={<FaFilter />}
      variant="solid"
      size="sm"
      bg="white"
      borderRadius="0"
      borderColor="black"
      borderWidth={1}
    />        
      <MenuList minWidth="200px">
          <VStack align="start" spacing={1} p={2}>
            {Object.keys(filters).map((type) => (
              <Checkbox
                key={type}
                isChecked={filters[type]}
                onChange={() => handleFilterChange(type)}
              >
                <Text fontSize="sm">{filterLabels[type]}</Text>
              </Checkbox>
            ))}
          </VStack>
        </MenuList>
      </Menu>
    </Box>
  );
}
export default MarkerFilterControl;