import React from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import DashboardPage from "./pages/DashboardPage"; // Import the DashboardPage component
import MarketPage from "./pages/MarketPage";
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
            </Routes>
          </div>{" "}
        </div>
      </div>
    </Router>
  );
}

export default App;
