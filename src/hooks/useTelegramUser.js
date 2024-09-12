import { useState, useEffect } from 'react';

export function useTelegramUser() {
  const [user, setUser] = useState(null);

  useEffect(() => {
   const tg = window.Telegram?.WebApp?.initDataUnsafe;
    // const tg = {
    //   "query_id": "AAHdF6IQAAAAAN0XohDhrOrc",
    //   "user": {
    //     "id": 351139657,
    //     "first_name": "John",
    //     "last_name": "Doe",
    //     "username": "johndoe",
    //     "language_code": "en" 
    //   },
    //   "auth_date": 1632346474,
    //   "hash": "c1402f68fec70161c2df0b3dba55d3e3f172e0e7d3e9eb3f7fdfc45f9d8eb5c7"
    // }
    if (tg) {
      const userData = tg.user;
      console.log(userData);
      if (userData) {
        setUser({
          id: userData.id,
          firstName: userData.first_name,
          lastName: userData.last_name,
          username: userData.username,
        });
      }
    }
  }, []);

  return user;
}