const API_BASE_URL = 'https://api.monopiter.ru/api';

export const fetchHeatmapData = async (period, year, month) => {
  let url;
  switch (period) {
    case 'this_month':
      url = `${API_BASE_URL}/monthly-heatmap/${year}/${month}`;
      break;
    case 'last_month':
      const lastMonth = month === 1 ? 12 : month - 1;
      const lastMonthYear = month === 1 ? year - 1 : year;
      url = `${API_BASE_URL}/monthly-heatmap/${lastMonthYear}/${lastMonth}`;
      break;
    case 'this_year':
      url = `${API_BASE_URL}/yearly-heatmap/${year}`;
      break;
    default:
      url = `${API_BASE_URL}/monthly-heatmap/${year}/${month}`;
  }

  const response = await fetch(url);
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Ошибка при загрузке данных тепловой карты');
  }
  return response.json();
};