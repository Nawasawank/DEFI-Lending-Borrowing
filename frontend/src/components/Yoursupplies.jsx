import React, { useState } from 'react';
import '../styles/Yoursupplies.css';
import WithdrawPage from '../pages/WithdrawPage';

// ✅ Token icons
import wethIcon from '../pictures/weth.png';
import wbtcIcon from '../pictures/wbtc.png';
import usdcIcon from '../pictures/usdc.png';
import daiIcon from '../pictures/dai.png';
import ghoIcon from '../pictures/gho.svg';

const tokenIcons = {
  WETH: wethIcon,
  WBTC: wbtcIcon,
  USDC: usdcIcon,
  DAI: daiIcon,
  GHO: ghoIcon,
};

function Yoursupplies() {
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState(null);

  const supplies = {
    balance: '$10.00',
    apy: '2.71%',
    collateral: '$10.00',
    assets: [
      { id: 1, walletBalance: 3.5, apy: '2.71', name: 'WETH' },
      { id: 2, walletBalance: 0.75, apy: '3.80', name: 'WBTC' },
      { id: 3, walletBalance: 250, apy: '2.20', name: 'USDC' },
      { id: 4, walletBalance: 190, apy: '2.15', name: 'DAI' },
      { id: 5, walletBalance: 400, apy: '3.60', name: 'GHO' },
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <img
                        src={tokenIcons[asset.name]}
                        alt={asset.name}
                        style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: 'white' }}
                      />
                      <span>{asset.name}</span>
                    </div>
                  </td>
                  <td>{asset.walletBalance}</td>
                  <td>{asset.apy}%</td>
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
