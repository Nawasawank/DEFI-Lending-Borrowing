import React from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import DisplayIcons from '../components/DisplayIcons';
import Yoursupplies from '../components/Yoursupplies';
import '../styles/Dashboard.css'; // Ensure your CSS path is correct

const Dashboard = () => {
  return (
    <div className="dashboard-container">
      {/* Sidebar Component */}
      <Sidebar />
        <Header />
          <DisplayIcons />
            <Yoursupplies />
         

    </div>
  );
};

export default Dashboard;
