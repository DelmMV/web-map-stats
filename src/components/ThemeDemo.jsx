import { Box, Button, Text } from '@chakra-ui/react'
import { useTelegramTheme } from '../hooks/useTelegramTheme'

const ThemeDemo = () => {
	const { theme, isDark, toggleTheme } = useTelegramTheme()

	return (
		<Box
			position='fixed'
			top='10px'
			right='10px'
			p={3}
			bg='var(--bg-card)'
			border='1px solid var(--border-primary)'
			borderRadius='md'
			boxShadow='var(--shadow-md)'
			zIndex={1000}
		>
			<Text fontSize='sm' mb={2} color='var(--text-primary)'>
				Тема: {isDark ? '🌙 Темная' : '☀️ Светлая'}
			</Text>
			<Button size='sm' onClick={toggleTheme}>
				{isDark ? '☀️' : '🌙'} Переключить
			</Button>
		</Box>
	)
}

export default ThemeDemo
