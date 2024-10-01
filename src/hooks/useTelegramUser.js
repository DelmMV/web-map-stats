import { useState, useEffect, useCallback } from 'react';

export function useTelegramUser() {
  const [user, setUser] = useState(null);
  const getStorageUser = useCallback(() => {
    try {
      const data = localStorage.getItem('telegramUser');
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error parsing user data from localStorage:', error); 
      return null;
    }
  }, []);  
  useEffect(() => {
    //const tg = window.Telegram?.WebApp?.initDataUnsafe;
    const tg = {
      "query_id": "AAHdF6IQAAAAAN0XohDhrOrc",
      "user": {
        "id": 351139657,
        "first_name": "John",
        "last_name": "Doe",
        "username": "johndoe",
        "language_code": "en" 
      },
      "auth_date": 1632346474,
      "hash": "c1402f68fec70161c2df0b3dba55d3e3f172e0e7d3e9eb3f7fdfc45f9d8eb5c7"
    }
    if (tg && tg.user) {
      setUser({
        id: tg.user.id,
        firstName: tg.user.first_name,
        lastName: tg.user.last_name,
        username: tg.user.username,
      });
    } else {
      const storageUser = getStorageUser();
      setUser(storageUser);
    }
  }, [getStorageUser]);
  return user;
}

