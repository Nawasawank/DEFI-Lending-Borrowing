import React, { useState, useEffect } from 'react';
import '../styles/Yoursupplies.css';
import WithdrawPage from '../pages/WithdrawPage';

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
  const [account, setAccount] = useState(null);
  const [supplyStats, setSupplyStats] = useState({
    balance: '-',
    apy: '-',
    collateral: '-',
  });

  const supplies = {
    assets: [
      { id: 1, walletBalance: 3.5, apy: '2.71', name: 'WETH' },
      { id: 2, walletBalance: 0.75, apy: '3.80', name: 'WBTC' },
      { id: 3, walletBalance: 250, apy: '2.20', name: 'USDC' },
      { id: 4, walletBalance: 190, apy: '2.15', name: 'DAI' },
      { id: 5, walletBalance: 400, apy: '3.60', name: 'GHO' },
    ]
  };

  useEffect(() => {
    const getAccount = async () => {
      if (window.ethereum) {
        try {
          const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
          setAccount(accounts[0]);
        } catch (error) {
          console.error("MetaMask connection error:", error);
        }
      }
    };
    getAccount();
  }, []);

  useEffect(() => {
    if (!account) return;

    const fetchSupplyStats = async () => {
      try {
        const [balanceRes, apyRes, collateralRes] = await Promise.all([
          fetch(`http://localhost:3001/api/lender-collateral?userAddress=${account}`),
          fetch(`http://localhost:3001/api/supply-totalAPY?userAddress=${account}`),
          fetch(`http://localhost:3001/api/sumCollateral?userAddress=${account}`)
        ]);

        const balance = await balanceRes.json();
        const apy = await apyRes.json();
        const collateral = await collateralRes.json();

        setSupplyStats({
          balance: balance.balance,
          apy: apy.totalAPY,
          collateral: collateral.totalCollateralUSD
        });
      } catch (err) {
        console.error("Failed to fetch supply stats:", err);
      }
    };

    fetchSupplyStats();
  }, [account]);

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
              <div className="info-box">Balance {supplyStats.balance}</div>
              <div className="info-box">APY {supplyStats.apy}</div>
              <div className="info-box">Collateral {supplyStats.collateral}</div>
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
