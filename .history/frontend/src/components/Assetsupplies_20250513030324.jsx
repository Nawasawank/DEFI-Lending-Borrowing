import React, { useEffect, useState } from 'react';
import '../styles/Assetsupplies.css';

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

const Assetsupplies = ({ onOpenSupply }) => {
  const [account, setAccount] = useState(null);
  const [assetsData, setAssetsData] = useState([]);
  const [supplyAPYMap, setSupplyAPYMap] = useState({});
  const [collateralMap, setCollateralMap] = useState({});
  const [supplyStatusMap, setSupplyStatusMap] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getAccount = async () => {
      if (window.ethereum) {
        try {
          const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
          setAccount(accounts[0]);
        } catch (error) {
          console.error('MetaMask error:', error);
        }
      }
    };
    getAccount();
  }, []);

  useEffect(() => {
    const fetchAssets = async () => {
      if (!account) return;
      try {
        const resBalance = await fetch(`http://localhost:3001/api/wallet-balance?userAddress=${account}`);
        const dataBalance = await resBalance.json();

        const resOverview = await fetch(`http://localhost:3001/api/getAssetOverview?userAddress=${account}`);
        const dataOverview = await resOverview.json();

        const collateralMapTemp = {};
        dataOverview.assets.forEach(asset => {
          collateralMapTemp[asset.tokenAddress.toLowerCase()] = asset.canBeCollateral ? 'Yes' : 'No';
        });
        setCollateralMap(collateralMapTemp);

        const parsed = dataBalance.balances.map((item) => ({
          name: item.symbol,
          tokenAddress: item.tokenAddress,
          value: parseFloat(item.balance).toFixed(2),
          apy: '-',
          collateral: collateralMapTemp[item.tokenAddress.toLowerCase()] || '-',
        }));

        setAssetsData(parsed);
      } catch (err) {
        console.error('Error fetching wallet balance or asset overview:', err);
      } finally {
        setLoading(false);
      }
    };

    const fetchAPYs = async () => {
      try {
        const res = await fetch('http://localhost:3001/api/supply-apy');
        const data = await res.json();
        const apyMap = {};
        data.forEach(entry => {
          apyMap[entry.asset.toLowerCase()] = entry.supplyAPY;
        });
        setSupplyAPYMap(apyMap);
      } catch (err) {
        console.error('Error fetching supply APYs:', err);
      }
    };

    const fetchSupplyStatus = async () => {
      try {
        const res = await fetch(`http://localhost:3001/api/check-status?userAddress=${account}`);
        const data = await res.json();
        const statusMap = {};
        data.forEach(entry => {
          statusMap[entry.asset.toLowerCase()] = entry.isSupplyFull;
        });
        setSupplyStatusMap(statusMap);
      } catch (err) {
        console.error('Error fetching supply status:', err);
      }
    };

    fetchAssets();
    fetchAPYs();
    fetchSupplyStatus();
  }, [account]);

  return (
    <div className="assetsupply-container">
      <div className="supply-header">
        <h2 style={{ color: 'white', marginLeft: '20px' }}>Assets to supply</h2>
      </div>
      <div className="supply-content">
        <table className="as">
          <thead>
            <tr>
              <th>Asset</th>
              <th>Wallet balance</th>
              <th>APY</th>
              <th>Can be collateral</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, index) => (
                <tr key={index}>
                  <td><div className="skeleton skeleton-text" style={{ width: '100px' }} /></td>
                  <td><div className="skeleton skeleton-text" style={{ width: '80px' }} /></td>
                  <td><div className="skeleton skeleton-text" style={{ width: '60px' }} /></td>
                  <td><div className="skeleton skeleton-text" style={{ width: '60px' }} /></td>
                  <td><div className="skeleton skeleton-button" style={{ width: '70px', height: '30px' }} /></td>
                </tr>
              ))
            ) : (
              assetsData.map((asset, index) => {
                const isSupplyFull = supplyStatusMap[asset.tokenAddress?.toLowerCase()];
                return (
                  <tr key={index}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <img
                          src={tokenIcons[asset.name] || ''}
                          alt={asset.name}
                          style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: 'white' }}
                        />
                        <span>{asset.name}</span>
                      </div>
                    </td>
                    <td>{asset.value}</td>
                    <td>{supplyAPYMap[asset.tokenAddress?.toLowerCase()] || '-'}</td>
                    <td>{asset.collateral}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className={`aslink-button supplyy-button ${isSupplyFull ? 'error shake' : ''}`}
                        onClick={() => onOpenSupply(asset)}
                        disabled={isSupplyFull}
                      >
                        {isSupplyFull ? 'Full' : 'Supply'}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Assetsupplies;
