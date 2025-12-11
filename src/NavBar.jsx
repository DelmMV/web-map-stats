import React from 'react'
import { Box, Button, Text, Flex } from '@chakra-ui/react'
import { NavLink } from 'react-router-dom'
import { GiPathDistance } from 'react-icons/gi'
import { IoPodiumOutline, IoMapOutline } from 'react-icons/io5'
import { motion } from 'framer-motion'
import { subtleButtonStyles, motionButtonProps } from './styles/buttonStyles'

const MotionButton = motion(Button)

const NavBar = () => {
	return (
		<Flex
			justifyContent='center'
			position='fixed'
			bottom={0}
			left={0}
			right={0}
			zIndex={1000}
			p={2}
		>
			<Box
				as='nav'
				bg='rgba(255,255,255,0.9)'
				backdropFilter='blur(12px)'
				borderWidth='1px'
				borderColor='gray.200'
				p={1}
				color='gray.800'
				display='flex'
				justifyContent='space-between'
				gap={2}
				width='100%'
				maxWidth='420px'
				height='60px'
				borderRadius={14}
				boxShadow='0 12px 28px rgba(0,0,0,0.16)'
			>
				{[
					{
						to: '/',
						icon: <IoMapOutline size='24px' />,
						label: 'Карта',
					},
					{
						to: '/weekly-stats',
						icon: <GiPathDistance size='24px' />,
						label: 'Пробег',
					},
					{
						to: '/top-users',
						icon: <IoPodiumOutline size='24px' />,
						label: 'Топ 50',
					},
				].map(item => (
					<MotionButton
						key={item.to}
						as={NavLink}
						to={item.to}
						variant='ghost'
						display='flex'
						flexDirection='column'
						alignItems='center'
						justifyContent='center'
						flex='1'
						gap={0.5}
						colorScheme='gray'
						_activeLink={{
							bg: 'purple.50',
							color: 'purple.700',
						}}
						sx={{
							...subtleButtonStyles,
							height: '100%',
							borderRadius: 12,
							boxShadow: 'none',
						}}
						{...motionButtonProps}
					>
						<>
							{item.icon}
							<Text fontSize='xs'>{item.label}</Text>
						</>
					</MotionButton>
				))}
			</Box>
		</Flex>
	)
}

export default NavBar
