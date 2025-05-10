import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import DisplayIcons from '../components/DisplayIcons';
import Yoursupplies from '../components/Yoursupplies';
import Yourborrows from '../components/Yourborrows';
import AssetSupplies from '../components/Assetsupplies';
import AssetBorrow from '../components/Assetborrow';
import SupplyPage from '../pages/SupplyPage';
import BorrowPage from '../pages/BorrowPage';
import '../styles/Dashboard.css';

const Dashboard = () => {
  const navigate = useNavigate();
  const [isSupplyOpen, setIsSupplyOpen] = useState(false);
  const [isBorrowOpen, setIsBorrowOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState(null);

  const handleViewTransaction = () => {
    navigate('/viewtransaction');
  };

  const handleOpenSupply = (asset) => {
    const parsedAmount = parseFloat(asset.value.replace(/\$|,/g, ''));
    const parsedAPY = parseFloat(asset.apy);
    setSelectedAsset({
      name: asset.name,
      apy: parsedAPY,
      amount: parsedAmount,
    });
    setIsSupplyOpen(true);
  };

  const handleCloseSupply = () => {
    setSelectedAsset(null);
    setIsSupplyOpen(false);
  };

  const handleOpenBorrow = (asset) => {
    setSelectedAsset({
      name: asset.name,
      apy: asset.apy,
      available: asset.available,
    });
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
        <DisplayIcons onViewTransactionClick={handleViewTransaction} />
        <div className="container">
          <div className="upper">
            <Yoursupplies />
            <Yourborrows />
          </div>
          <div className="lower">
            <AssetSupplies onOpenSupply={handleOpenSupply} />
            <AssetBorrow onOpenBorrow={handleOpenBorrow} />
          </div>
        </div>
      </div>

      {isSupplyOpen && (
        <div className="supply-overlay">
          <div className="supply-modal">
            <SupplyPage
              onClose={handleCloseSupply}
              tokenName={selectedAsset.name}
              apy={selectedAsset.apy}
              amount={selectedAsset.amount}
            />
          </div>
        </div>
      )}

      {isBorrowOpen && selectedAsset && (
        <div className="borrow-overlay">
          <div className="borrow-modal">
            <BorrowPage
              onClose={handleCloseBorrow}
              tokenName={selectedAsset.name}
              apy={selectedAsset.apy}
              amountAvailable={selectedAsset.available}
            />
          </div>
        </div>
      )}
    </>
  );
};

export default Dashboard;
