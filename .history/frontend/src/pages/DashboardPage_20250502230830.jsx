import React, { useState } from 'react';
import Header from '../components/Header';
import DisplayIcons from '../components/DisplayIcons';
import Yoursupplies from '../components/Yoursupplies';
import Yourborrows from '../components/Yourborrows';
import AssetSupplies from '../components/Assetsupplies';
import AssetBorrow from '../components/Assetborrow';
import SupplyPage from '../pages/SupplyPage';
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
        <div className="supply-overlay">
          <div className="supply-modal">
          <SupplyPage
            onClose={handleCloseSupply}
            tokenName="DAI"
            apy={3.45}
            amount={100}
            ass
  />
          </div>
        </div>
      )}
    </>
  );
};

export default Dashboard;
