import React from "react";
import Header from "../components/Header";
import DisplayIcons from "../components/DisplayIcons";
import Yoursupplies from "../components/Yoursupplies";
import "../styles/Dashboard.css"; // Ensure your CSS path is correct

const Dashboard = () => {
  return (
    <div className="dashboard-container">
      <Header />
      <DisplayIcons />
      <Yoursupplies />
    </div>
  );
};

export default Dashboard;
