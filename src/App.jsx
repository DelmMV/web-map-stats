import { ChakraProvider } from '@chakra-ui/react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import NavBar from './NavBar.jsx';
import UserMap from './UserMap.jsx';
import TopUsers from "./TopUsers.jsx";
import WeeklyStats from "./WeeklyStats.jsx";

function App() {
  const userId = 200885469; // Example userId
  
  return (
      <ChakraProvider>
        <Router>
          <NavBar />
          <Routes>
            <Route path="/" element={<WeeklyStats userId={userId} />} />
            <Route path="/routes" element={<UserMap userId={userId} />} />
            <Route path="/top-users" element={<TopUsers />} />
          </Routes>
        </Router>
      </ChakraProvider>
  );
}

export default App;
