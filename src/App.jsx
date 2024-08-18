import { ChakraProvider } from '@chakra-ui/react';
import { Routes, Route, HashRouter} from 'react-router-dom';
import NavBar from './NavBar.jsx';
import UserMap from './UserMap.jsx';
import TopUsers from "./TopUsers.jsx";
import WeeklyStats from "./WeeklyStats.jsx";
import {useEffect, useState} from "react";

function App() {
//  const userId = 200885469; // Example userId
  const [userId, setUserId] = useState(null);
  
  useEffect(() => {
    if (window.Telegram?.WebApp?.initDataUnsafe) {
      const telegramUserId = window.Telegram.WebApp.initDataUnsafe.user?.id;
      setUserId(telegramUserId);
    }
  }, []);

  if (!userId) {
    return <div>Loading...</div>;
  }
  return (
      <ChakraProvider>
        <HashRouter>
          <NavBar />
          <Routes>
            <Route path="/" element={<WeeklyStats userId={userId} />} />
            <Route path="/routes" element={<UserMap userId={userId} />} />
            <Route path="/top-users" element={<TopUsers />} />
          </Routes>
        </HashRouter>
      </ChakraProvider>
  );
}

export default App;
