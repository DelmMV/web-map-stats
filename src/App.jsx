import { ChakraProvider } from '@chakra-ui/react';
import { Routes, Route, HashRouter} from 'react-router-dom';
import NavBar from './NavBar.jsx';
import UserMap from './UserMap.jsx';
import TopUsers from "./TopUsers.jsx";
import WeeklyStats from "./WeeklyStats.jsx";
import {useEffect, useState} from "react";
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import './index.css';

function App() {
const adminIds = [200885469, 900133683, 527549474, 294170514, 5550302390, 495310665];

//const userId = 351139657; // Example userId
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
          <Routes>
            <Route path="/" element={<UserMap userId={userId} admins={adminIds}/>} />
            <Route path="/weekly-stats" element={<WeeklyStats userId={userId} />} />
            <Route path="/top-users" element={<TopUsers userId={userId} admins={adminIds}/>} />
          </Routes>
          <NavBar />
        </HashRouter>
      </ChakraProvider>
  );
}

export default App;
