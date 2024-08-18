import React from 'react';
import { Box, Button } from '@chakra-ui/react';
import { NavLink } from 'react-router-dom';

const NavBar = () => {
	return (
			<Box as="nav" bg="blue.500" p={4} color="white" display="flex" gap={4}>
				<Button
						as={NavLink}
						to="/"
						variant="ghost"
						colorScheme="white"
						_activeLink={{ bg: "gray.100", color: "black" }}
				>
					Мой пробег
				</Button>
				<Button
						as={NavLink}
						to="/top-users"
						variant="ghost"
						colorScheme="white"
						_activeLink={{ bg: "gray.100", color: "black" }}
				>
					Топ 10
				</Button>
				<Button
						as={NavLink}
						to="/routes"
						variant="ghost"
						colorScheme="white"
						_activeLink={{ bg: "gray.100", color: "black" }}
				>
					Мои маршруты
				</Button>
			</Box>
	);
};

export default NavBar;
