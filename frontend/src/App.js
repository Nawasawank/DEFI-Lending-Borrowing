import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import DashboardPage from './pages/DashboardPage';  // Import the DashboardPage component
import './App.css';  // Global CSS for background image and layout

function App() {
  return (
    <Router>
          <Routes>
            {/* Route for Dashboard */}
            <Route path="/" element={<DashboardPage />} />
          </Routes>
    </Router>
  );
}

export default App;

