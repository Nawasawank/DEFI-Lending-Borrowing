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

const Assetsupplies = () => {
  const [account, setAccount] = useState(null);
  const [assetList, setAssetList] = useState([]);

  useEffect(() => {
    const getAccount = async () => {
      if (window.ethereum) {
        try {
          const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
          setAccount(accounts[0]);
        } catch (err) {
          console.error("MetaMask error:", err);
        }
      }
    };
    getAccount();
  }, []);

  useEffect(() => {
    const fetchAssets = async () => {
      if (!account) return;
      try {
        const res = await fetch(`http://localhost:3001/api/getAssetOverview?userAddress=${account}`);
        const data = await res.json();
        setAssetList(data.map(item => item.symbol)); // Only store the symbols
      } catch (err) {
        console.error("Error fetching asset overview:", err);
      }
    };

    fetchAssets();
  }, [account]);

  return (
    <div className="assetsupply-container">
      <div className="supply-header">
        <h2 style={{ color: 'white', marginLeft: '20px' }}>Assets</h2>
      </div>
      <div className="supply-content">
        <table className="as">
          <thead>
            <tr>
              <th>Asset</th>
            </tr>
          </thead>
          <tbody>
            {assetList.map((symbol, index) => (
              <tr key={index}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <img
                      src={tokenIcons[symbol]}
                      alt={symbol}
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        backgroundColor: 'white',
                      }}
                    />
                    <span>{symbol}</span>
                  </div>
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
