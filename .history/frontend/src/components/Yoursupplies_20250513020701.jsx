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
  const [supplyStats, setSupplyStats] = useState({ balance: '-', apy: '-', collateral: '-' });
  const [walletBalances, setWalletBalances] = useState([]);
  const [supplyAPYMap, setSupplyAPYMap] = useState({});
  const [loading, setLoading] = useState(true);

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
          fetch(`http://localhost:3001/api/all-collateral?userAddress=${account}`),
          fetch(`http://localhost:3001/api/supply-totalAPY?userAddress=${account}`),
          fetch(`http://localhost:3001/api/sumCollateral?userAddress=${account}`),
        ]);

        const balance = await balanceRes.json();
        const apy = await apyRes.json();
        const collateral = await collateralRes.json();

        setSupplyStats({
          balance: `$${parseFloat(balance.totalCollateralTokenSum).toFixed(2)}`,
          apy: `${parseFloat(apy.totalAPY).toFixed(2)}%`,
          collateral: `$${parseFloat(collateral.totalCollateralUSD).toFixed(2)}`,
        });
      } catch (err) {
        console.error("Failed to fetch supply stats:", err);
      }
    };

    const fetchWalletBalances = async () => {
      try {
        const res = await fetch(`http://localhost:3001/api/lender-collateral?userAddress=${account}`);
        const data = await res.json();
        const filtered = (data.collateral || []).filter(asset => parseFloat(asset.balance) > 0);
        setWalletBalances(filtered);
      } catch (err) {
        console.error("Failed to fetch wallet balances:", err);
      }
    };

    const fetchSupplyAPY = async () => {
      try {
        const res = await fetch(`http://localhost:3001/api/supply-apy`);
        const data = await res.json();
        const apyMap = {};
        data.forEach(entry => {
          apyMap[entry.asset.toLowerCase()] = parseFloat(entry.supplyAPY).toFixed(2);
        });
        setSupplyAPYMap(apyMap);
      } catch (err) {
        console.error("Failed to fetch supply APYs:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchSupplyStats();
    fetchWalletBalances();
    fetchSupplyAPY();
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
              {loading ? (
                <>
                  <div className="info-box skeleton shimmer" style={{ width: '80px', height: '20px' }}></div>
                  <div className="info-box skeleton shimmer" style={{ width: '60px', height: '20px' }}></div>
                  <div className="info-box skeleton shimmer" style={{ width: '100px', height: '20px' }}></div>
                </>
              ) : (
                <>
                  <div className="info-box">Balance {supplyStats.balance}</div>
                  <div className="info-box">APY {supplyStats.apy}</div>
                  <div className="info-box">Collateral {supplyStats.collateral}</div>
                </>
              )}
            </div>
          </div>

          <table className="s">
            <thead>
              <tr>
                <th>Assets</th>
                <th>Wallet balance</th>
                <th>Supply APY</th>
                <th></th>
              </tr>
            </thead>
            <tbody style={{ textAlign: 'left' }}>
              {loading
                ? Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i}>
                      <td><div className="skeleton shimmer" style={{ width: '100px', height: '20px' }} /></td>
                      <td><div className="skeleton shimmer" style={{ width: '80px', height: '20px' }} /></td>
                      <td><div className="skeleton shimmer" style={{ width: '60px', height: '20px' }} /></td>
                      <td><div className="skeleton shimmer" style={{ width: '60px', height: '30px' }} /></td>
                    </tr>
                  ))
                : walletBalances.map((asset, index) => (
                    <tr key={index}>
                      <td>
                        <div className="asset-cell" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '8px' }}>
                          <img className="asset-icons" src={tokenIcons[asset.symbol]} alt={asset.symbol} />
                          <span>{asset.symbol}</span>
                        </div>
                      </td>
                      <td>{parseFloat(asset.balance).toFixed(2)}</td>
                      <td>{supplyAPYMap[asset.tokenAddress?.toLowerCase()] ? `${supplyAPYMap[asset.tokenAddress.toLowerCase()]}%` : '-'}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button className="slink-button sWithdraw-button" onClick={() => handleOpenWithdraw(asset)}>
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
