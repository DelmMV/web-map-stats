import { MoonIcon, SunIcon } from '@chakra-ui/icons'
import { IconButton } from '@chakra-ui/react'
import { useTelegramTheme } from '../hooks/useTelegramTheme'

/**
 * Компонент переключения темы (для тестирования)
 */
const ThemeToggle = () => {
	const { theme, isDark, toggleTheme } = useTelegramTheme()

	return (
		<IconButton
			aria-label='Переключить тему'
			icon={isDark ? <SunIcon /> : <MoonIcon />}
			onClick={toggleTheme}
			variant='ghost'
			size='sm'
			position='fixed'
			top='10px'
			right='10px'
			zIndex={1000}
			bg={isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}
			color={isDark ? 'white' : 'black'}
			_hover={{
				bg: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)',
			}}
		/>
	)
}

export default ThemeToggle
