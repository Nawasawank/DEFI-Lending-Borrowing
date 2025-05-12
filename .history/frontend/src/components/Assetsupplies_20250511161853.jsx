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
        const response = await fetch(`http://localhost:3001/api/wallet-balance?userAddress=${account}`);
        const data = await response.json();

        const parsed = data.balances.map((item) => ({
          name: item.symbol,
          tokenAddress: item.tokenAddress,
          value: parseFloat(item.balance).toFixed(2),
          apy: '-',
          collateral: '-',
        }));

        setAssetsData(parsed);
      } catch (err) {
        console.error('Error fetching wallet balance:', err);
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

    fetchAssets();
    fetchAPYs();
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
                <td>{supplyAPYMap[asset.tokenAddress?.toLowerCase()] || '-'}</td>
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
