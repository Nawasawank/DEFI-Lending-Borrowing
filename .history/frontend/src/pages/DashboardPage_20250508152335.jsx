import React, { useState } from 'react';
import Header from '../components/Header';
import DisplayIcons from '../components/DisplayIcons';
import Yoursupplies from '../components/Yoursupplies';
import Yourborrows from '../components/Yourborrows';
import AssetSupplies from '../components/Assetsupplies';
import AssetBorrow from '../components/Assetborrow';
import SupplyPage from '../pages/SupplyPage';
import BorrowPage from '../pages/BorrowPage'; // ✅ Import BorrowPage
import '../styles/Dashboard.css';

const Dashboard = () => {
  const [isSupplyOpen, setIsSupplyOpen] = useState(false);
  const [isBorrowOpen, setIsBorrowOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState(null);

  const handleOpenSupply = (asset) => {
    setSelectedAsset(asset);
    setIsSupplyOpen(true);
  };

  const handleCloseSupply = () => {
    setSelectedAsset(null);
    setIsSupplyOpen(false);
  };

  const handleOpenBorrow = (asset) => {
    setSelectedAsset(asset);
    setIsBorrowOpen(true);
  };

  const handleCloseBorrow = () => {
    setSelectedAsset(null);
    setIsBorrowOpen(false);
  };

  return (
    <>
      <div className="dashboard-container">
        <Header />
        <DisplayIcons />
        <div className="container">
          <div className="upper">
            <Yoursupplies />
            <Yourborrows />
          </div>
          <div className="lower">
            <AssetSupplies onOpenSupply={handleOpenSupply} />
            <AssetBorrow onOpenBorrow={handleOpenBorrow} /> {/* Pass handler */}
          </div>
        </div>
      </div>

      {/* Supply Modal */}
      {isSupplyOpen && (
        <div className="supply-overlay">
          <div className="supply-modal">
            <SupplyPage
              onClose={handleCloseSupply}
              tokenName="DAI"
              apy={3.45}
              amount={100}
              asset="DAI"
            />
          </div>
        </div>
      )}

      {/* Borrow Modal */}
      {isBorrowOpen && (
        <div className="supply-overlay">
          <div className="supply-modal">
            <BorrowPage
              onClose={handleCloseBorrow}
              tokenName="DAI"
              apy={2.15}
              amountAvailable={75}
            />
          </div>
        </div>
      )}
    </>
  );
};

export default Dashboard;
