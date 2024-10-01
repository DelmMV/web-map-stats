import { useQuery } from '@tanstack/react-query';

const CACHE_TIME = 1000 * 60 * 5; // 5 минут
const STALE_TIME = 1000 * 60; // 1 минута

const fetchActiveUsers = async () => {
  const response = await fetch('https://api.monopiter.ru/api/active-users');
  if (!response.ok) {
    throw new Error('Ошибка при загрузке активных пользователей');
  }
  return response.json();
};

export const useActiveUsers = () => {
  return useQuery({
    queryKey: ['activeUsers'],
    queryFn: fetchActiveUsers,
    cacheTime: CACHE_TIME,
    staleTime: STALE_TIME,
    refetchInterval: 20000, // Обновляем каждые 10 секунд
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    onError: (error) => {
      console.error('Ошибка при загрузке активных пользователей:', error);
    },
  });
};