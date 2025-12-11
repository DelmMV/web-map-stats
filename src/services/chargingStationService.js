import { API_CONFIG } from '../utils/config';

const API_BASE_URL = API_CONFIG.BASE_URL;

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

export const updateChargingStationStatus = async (station, isOffline, userId) => {
  const stationId = station?._id ?? station?.id;
  if (!stationId) {
    throw new Error('Неизвестный идентификатор станции');
  }
  const formData = new FormData();
  formData.append('latitude', station.latitude);
  formData.append('longitude', station.longitude);
  formData.append('is24Hours', station.is24Hours || false);
  formData.append('markerType', station.markerType || 'charging');
  formData.append('comment', station.comment || '');
  formData.append('userId', userId);
  formData.append('isOffline', isOffline);

  const response = await fetch(`${API_BASE_URL}/charging-stations/${stationId}`, {
    method: 'PUT',
    body: formData,
  });
  if (!response.ok) {
    throw new Error('Не удалось обновить статус зарядной станции');
  }
  return response.json();
};
