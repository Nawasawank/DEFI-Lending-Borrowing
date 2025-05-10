import React, { useState } from 'react';
import '../styles/Yoursupplies.css';
import WithdrawPage from '../pages/WithdrawPage'; // ✅ Import Withdraw modal

function Yoursupplies() {
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState(null);

  const supplies = {
    balance: '$10.00',
    apy: '2.71%',
    collateral: '$10.00',
    assets: [
      { id: 1, walletBalance: 5, apy: '5', name: 'USDT' },
      { id: 2, walletBalance: 10, apy: '3.5', name: 'DAI' }
    ]
  };

  const handleOpenWithdraw = (asset) => {
    setSelectedAsset(asset);
    setIsWithdrawOpen(true);
  };

  const handleCloseWithdraw = () => {
    setSelectedAsset(null);
    setIsWithdrawOpen(false);
  };

  return (
    <>
      <div className="activity-containers">
        <div className="supplies">
          <div className="supplies-header">
            <h2>Your Supplies</h2>
            <div className="info-section">
              <div className="info-box">Balance {supplies.balance}</div>
              <div className="info-box">APY {supplies.apy}</div>
              <div className="info-box">Collateral {supplies.collateral}</div>
            </div>
          </div>

          <table className="s">
            <thead>
              <tr>
                <th>Assets</th>
                <th>Wallet balance</th>
                <th>APY</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {supplies.assets.map(asset => (
                <tr key={asset.id}>
                  <td>
                    <div className="asset-icon" />
                    {asset.name}
                  </td>
                  <td>{asset.walletBalance}</td>
                  <td>{asset.apy}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      className="slink-button sWithdraw-button"
                      onClick={() => handleOpenWithdraw(asset)}
                    >
                      Withdraw
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Withdraw Modal */}
      {isWithdrawOpen && selectedAsset && (
        <div className="withdraw-overlay">
          <div className="withdraw-modal">
            <WithdrawPage
              onClose={handleCloseWithdraw}
              tokenName={selectedAsset.name}
              available={selectedAsset.walletBalance}
            />
          </div>
        </div>
      )}
    </>
  );
}

export default Yoursupplies;
