const API_BASE_URL = 'https://api.monopiter.ru/api';

export const fetchChargingStations = async () => {
  const response = await fetch(`${API_BASE_URL}/charging-stations`);
  if (!response.ok) {
    throw new Error('Не удалось найти зарядные станции');
  }
  return response.json();
};

export const addChargingStation = async (formData) => {
  const response = await fetch(`${API_BASE_URL}/charging-stations`, {
    method: 'POST',
    body: formData,
  });
  if (!response.ok) {
    throw new Error('Не удалось добавить маркер зарядной станции');
  }
  return response.json();
};

export const updateChargingStation = async (id, formData) => {
  const response = await fetch(`${API_BASE_URL}/charging-stations/${id}`, {
    method: 'PUT',
    body: formData,
  });
  if (!response.ok) {
    throw new Error('Не удалось обновить маркер зарядной станции');
  }
  return response.json();
};

export const deleteChargingStation = async (id) => {
  const response = await fetch(`${API_BASE_URL}/charging-stations/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Не удалось удалить маркер зарядной станции');
  }
  return response.json();
};