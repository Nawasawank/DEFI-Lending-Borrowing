import React, { useEffect, useState } from 'react';
import '../styles/Assetborrow.css';

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

const AssetBorrow = ({ onOpenBorrow }) => {
  const [account, setAccount] = useState(null);
  const [borrowAssetsData, setBorrowAssetsData] = useState([]);
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
    const fetchBorrowAssets = async () => {
      if (!account) return;
      try {
        const res = await fetch(`http://localhost:3001/api/getBorrowOverview?userAddress=${account}`);
        const data = await res.json();

        const parsed = data.borrow.map(asset => ({
          name: asset.symbol,
          value: `$${parseFloat(asset.available).toFixed(2)}`,
          apy: asset.borrowAPY.replace('%', ''),
        }));

        setBorrowAssetsData(parsed);
      } catch (err) {
        console.error('Error fetching borrow overview:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchBorrowAssets();
  }, [account]);

  return (
    <div className="assetborrow-container">
      <div className="borrow-header">
        <h2 style={{ color: 'white', marginLeft: '20px' }}>Assets to borrow</h2>
      </div>
      <div className="borrow-content">
        <table className="ab">
          <thead>
            <tr>
              <th>Asset</th>
              <th>Available</th>
              <th>APY, variable</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 5 }).map((_, index) => (
                  <tr key={index}>
                    <td><div className="skeleton skeleton-text" style={{ width: '100px', height: '24px' }} /></td>
                    <td><div className="skeleton skeleton-text" style={{ width: '80px', height: '16px' }} /></td>
                    <td><div className="skeleton skeleton-text" style={{ width: '60px', height: '16px' }} /></td>
                    <td><div className="skeleton skeleton-text" style={{ width: '80px', height: '32px' }} /></td>
                  </tr>
                ))
              : borrowAssetsData.map((asset, index) => (
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
                    <td>{asset.apy}%</td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="ablink-button borrow-button"
                        onClick={() =>
                          onOpenBorrow({
                            name: asset.name,
                            apy: parseFloat(asset.apy),
                            available: parseFloat(asset.value.replace(/\$|,/g, '')),
                          })
                        }
                      >
                        Borrow
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

export default AssetBorrow;
