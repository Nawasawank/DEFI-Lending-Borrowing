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
        const response = await fetch(`http://localhost:3001/api/getAssetOverview?userAddress=${account}`);
        const data = await response.json();

        const parsed = data.assets.map((item) => ({
          name: item.symbol,
          value: `$${item.walletBalance}`, // keep raw value, no decimal trimming
          apy: item.apy,
          collateral: item.canBeCollateral ? 'Yes' : 'No',
        }));

        setAssetsData(parsed);
        console.log("Parsed asset data:", parsed);
      } catch (err) {
        console.error('Error fetching asset overview:', err);
      }
    };

    fetchAssets();
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
            {assetsData.map((asset, index) => (
              <tr key={index}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <img
                      src={tokenIcons[asset.name] || ''}
                      alt={asset.name}
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        backgroundColor: 'white',
                      }}
                    />
                    <span>{asset.name}</span>
                  </div>
                </td>
                <td>{asset.value}</td>
                <td>{asset.apy}</td>
                <td>{asset.collateral}</td>
                <td style={{ textAlign: 'right' }}>
                  <button
                    className="aslink-button supplyy-button"
                    onClick={() => onOpenSupply(asset)}
                  >
                    Supply
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Assetsupplies;
