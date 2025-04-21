import React, { useState } from 'react';
import Header from '../components/Header.jsx';
import DisplayIcons from '../components/DisplayIcons.jsx';
import Yoursupplies from '../components/Yoursupplies.jsx';
import Yourborrows from '../components/Yourborrows.jsx';
import AssetSupplies from '../components/Assetsupplies.jsx';
import AssetBorrow from '../components/Assetborrow.jsx';
import SupplyPage from '../pages/SupplyPage.jsx';
import '../styles/Dashboard.css'; // Ensure your CSS path is correct

const Dashboard = () => {
  const [isSupplyOpen, setIsSupplyOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState(null);

  const handleOpenSupply = (asset) => {
    setSelectedAsset(asset);
    setIsSupplyOpen(true);
  };

  const handleCloseSupply = () => {
    setSelectedAsset(null);
    setIsSupplyOpen(false);
  };

  return (
    <>
      <div className="dashboard-container">
        {/* Sidebar Component */}
        <Header />
        <DisplayIcons />
        <div className="container">
          <div className="upper">
            <Yoursupplies />
            <Yourborrows />
          </div>
          <div className="lower">
            <AssetSupplies onOpenSupply={handleOpenSupply} />
            <AssetBorrow />
          </div>
        </div>
      </div>

      {/* Render Modal Outside */}
      {isSupplyOpen && (
        <SupplyPage asset={selectedAsset} onClose={handleCloseSupply} />
      )}
    </>
  );
};

export default Dashboard;
