import React, { useEffect, useState } from 'react';
import '../styles/Assetborrow.css';

import wethIcon from '../pictures/weth.png';
import wbtcIcon from '../pictures/wbtc.png';
import usdcIcon from '../pictures/usdc.png';
daiIcon from '../pictures/dai.png';
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
  const [borrowStatusMap, setBorrowStatusMap] = useState({});
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
    const fetchData = async () => {
      if (!account) return;
      try {
        const [borrowRes, statusRes] = await Promise.all([
          fetch(`http://localhost:3001/api/getBorrowOverview?userAddress=${account}`),
          fetch(`http://localhost:3001/api/check-status?userAddress=${account}`),
        ]);

        const borrowData = await borrowRes.json();
        const statusData = await statusRes.json();

        const parsed = borrowData.borrow.map(asset => ({
          name: asset.symbol,
          value: `$${parseFloat(asset.available).toFixed(2)}`,
          apy: asset.borrowAPY.replace('%', ''),
          tokenAddress: asset.tokenAddress.toLowerCase()
        }));

        const statusMap = {};
        statusData.forEach(entry => {
          statusMap[entry.asset.toLowerCase()] = entry.isBorrowFull;
        });

        setBorrowAssetsData(parsed);
        setBorrowStatusMap(statusMap);
      } catch (err) {
        console.error('Error fetching borrow data or status:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
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
              : borrowAssetsData.map((asset, index) => {
                  const isBorrowFull = borrowStatusMap[asset.tokenAddress];
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
                      <td>{asset.apy}%</td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className={`ablink-button borrow-button ${isBorrowFull ? 'error shake' : ''}`}
                          onClick={() =>
                            onOpenBorrow({
                              name: asset.name,
                              apy: parseFloat(asset.apy),
                              available: parseFloat(asset.value.replace(/\$|,/g, '')),
                            })
                          }
                          disabled={isBorrowFull}
                        >
                          {isBorrowFull ? 'Full' : 'Borrow'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AssetBorrow;
