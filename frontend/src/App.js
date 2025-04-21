import React from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import DashboardPage from "./pages/DashboardPage.jsx"; // Import the DashboardPage component
import MarketPage from "./pages/MarketPage.jsx";
import MarketDetail from "./pages/MarketDetailPage.jsx";
import "./App.css"; // Global CSS for background image and layout
import Sidebar from "./components/Sidebar";

function App() {
  return (
    <Router>
      <div className="background">
        <div className="page-container">
          <Sidebar />
          <div className="main-content">
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/market" element={<MarketPage />} />
              <Route path="/marketdetail" element={<MarketDetail />} />
            </Routes>
          </div>{" "}
        </div>
      </div>
    </Router>
  );
}

export default App;
