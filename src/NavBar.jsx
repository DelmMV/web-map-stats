import React from 'react';
import {Box, Button, Text} from '@chakra-ui/react';
import { NavLink } from 'react-router-dom';
import { GiPathDistance } from "react-icons/gi";
import { IoPodiumOutline, IoMapOutline } from "react-icons/io5";

const NavBar = () => {
	return (
			<Box
					as="nav"
					bg="blue.500"
					p={3}
					color="white"
					display="flex"
					justifyContent="space-between"
					gap={4}
					position="fixed"
					bottom={0}
					left={0}
					width="100%"
					zIndex={1000}
			>
				<Button
						as={NavLink}
						to="/"
						variant="ghost"
						colorScheme="white"
						display="flex"
						flexDirection="column"
						_activeLink={{ bg: "gray.100", color: "black" }}
				>
					<GiPathDistance size="30px"/>
					<Text fontSize="small">Пробег</Text>
				</Button>
				<Button
						as={NavLink}
						to="/top-users"
						variant="ghost"
						display="flex"
						flexDirection="column"
						colorScheme="white"
						_activeLink={{ bg: "gray.100", color: "black" }}
				>
					<IoPodiumOutline size="30px"/>
					<Text fontSize="small">Топ 50</Text>
				</Button>
				<Button
						as={NavLink}
						to="/routes"
						variant="ghost"
						display="flex"
						flexDirection="column"
						colorScheme="white"
						_activeLink={{ bg: "gray.100", color: "black" }}
				>
					<IoMapOutline size="30px"/>
					<Text fontSize="small">Маршруты</Text>
				</Button>
			</Box>
	);
};

export default NavBar;
