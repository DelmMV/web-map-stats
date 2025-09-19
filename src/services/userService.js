import { useQuery } from '@tanstack/react-query'

const CACHE_TIME = 1000 * 60 * 5 // 5 минут
const STALE_TIME = 1000 * 60 // 1 минута

const fetchActiveUsers = async () => {
	const response = await fetch('https://api.monopiter.ru/api/active-users')
	if (!response.ok) {
		throw new Error('Ошибка при загрузке активных пользователей')
	}
	return response.json()
}

export const useActiveUsers = () => {
	return useQuery({
		queryKey: ['activeUsers'],
		queryFn: fetchActiveUsers,
		cacheTime: CACHE_TIME,
		staleTime: STALE_TIME,
		refetchInterval: 30000, // Увеличиваем интервал до 30 секунд
		refetchOnWindowFocus: false, // Не обновляем при фокусе окна
		refetchOnMount: false, // Не обновляем при монтировании если есть кеш
		retry: 3,
		retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
		notifyOnChangeProps: ['data', 'error'], // Уведомляем только о важных изменениях
		onError: error => {
			console.error('Ошибка при загрузке активных пользователей:', error)
		},
	})
}
