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

        const balanceData = await balanceRes.json();
        const apyData = await apyRes.json();
        const collateralData = await collateralRes.json();

        setSupplyStats({
          balance: balanceData.balance,
          apy: apyData.totalAPY,
          collateral: collateralData.totalCollateralUSD
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
        </div>
      </div>

      {isWithdrawOpen && selectedAsset && (
        <div className="withdraw-overlay">
          <div className="withdraw-modal">
            <WithdrawPage
              onClose={handleCloseWithdraw}
              tokenName={selectedAsset.symbol}
              available={selectedAsset.balance}
            />
          </div>
        </div>
      )}
    </>
  );
}

export default Yoursupplies;
