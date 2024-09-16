import React from 'react';
import {Box, Button, Text, Flex} from '@chakra-ui/react';
import { NavLink } from 'react-router-dom';
import { GiPathDistance } from "react-icons/gi";
import { IoPodiumOutline, IoMapOutline } from "react-icons/io5";

const NavBar = () => {
    return (
        <Flex justifyContent="center" position="fixed" bottom={0} left={0} right={0} zIndex={1000} p={2}>
            <Box
                as="nav"
                bg="rgba(66, 153, 225, 0.8)"
                p={1}
                color="white"
                display="flex"
                justifyContent="space-between"
                gap={1}
                width="100%"
                maxWidth="400px"  // Максимальная ширина панели
                height="50px"
                borderRadius={10}
                sx={{
                    backdropFilter: "blur(10px)",
                    WebkitBackdropFilter: "blur(10px)",
                    '@supports not (backdrop-filter: blur(10px))': {
                        bg: 'blue.500',
                    },
                }}
            >
                {/* Кнопки навигации остаются без изменений */}
                <Button
                    as={NavLink}
                    to="/"
                    variant="ghost"
                    display="flex"
                    flexDirection="column"
                    colorScheme="white"
                    _activeLink={{ bg: "gray.100", color: "black" }}
                >
                    <IoMapOutline size="30px"/>
                    <Text fontSize="small">Карта</Text>
                </Button>
                <Button
                    as={NavLink}
                    to="/weekly-stats"
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
            </Box>
        </Flex>
    );
};

export default NavBar;