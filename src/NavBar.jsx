import React from 'react';
import { Link } from 'react-router-dom';
import { Box, Button } from '@chakra-ui/react';

const NavBar = () => {
	return (
			<Box as="nav" bg="blue.500" p={4} color="white" display="flex" gap={4}>
				<Button as={Link} to="/" variant="ghost" colorScheme="whiteAlpha">
					Мой пробег
				</Button>
				<Button as={Link} to="/top-users" variant="ghost" colorScheme="whiteAlpha">
					Топ 10
				</Button>
				<Button as={Link} to="/routes" variant="ghost" colorScheme="whiteAlpha">
					Мои маршруты
				</Button>
			</Box>
	);
};

export default NavBar;
