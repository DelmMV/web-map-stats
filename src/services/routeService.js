const API_BASE_URL = 'https://api.monopiter.ru/api';

export const fetchRoute = async (userId, startDate, endDate) => {
  const url = new URL(`${API_BASE_URL}/route/${userId}`);
  if (startDate && endDate) {
    url.searchParams.append('startDate', startDate.toISOString());
    url.searchParams.append('endDate', endDate.toISOString());
  }

  const response = await fetch(url);
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Некорректные данные');
  }
  return response.json();
};