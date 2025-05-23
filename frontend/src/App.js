import React from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import DashboardPage from "./pages/DashboardPage"; // Import the DashboardPage component
import MarketPage from "./pages/MarketPage";
import MarketDetail from "./pages/MarketDetailPage";
import ViewTransaction from "./pages/ViewTransactionPage";
import "./App.css"; // Global CSS for background image and layout
import Sidebar from "./components/Sidebar";

function App() {
  return (
    <Router>
      <div className="background">
        <div className="page-container">
          <Sidebar />
          <div className="main-content">
            <div className="blank"></div>
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/market" element={<MarketPage />} />
              <Route path="/marketdetail" element={<MarketDetail />} />
              <Route path="/viewtransaction" element={<ViewTransaction />} />
            </Routes>
          </div>
        </div>
      </div>
    </Router>
  );
}

export default App;
