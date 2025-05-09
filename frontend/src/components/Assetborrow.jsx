import React from 'react';
import '../styles/Assetborrow.css';

import wethIcon from '../pictures/WETH.png';
import wbtcIcon from '../pictures/WBTC.png';
import usdcIcon from '../pictures/USDC.png';
import daiIcon from '../pictures/DAI.png';
import ghoIcon from '../pictures/GHO.png';

const tokenIcons = {
  WETH: wethIcon,
  WBTC: wbtcIcon,
  USDC: usdcIcon,
  DAI: daiIcon,
  GHO: ghoIcon,
};

const AssetBorrow = ({ onOpenBorrow }) => {
  const borrowAssetsData = [
    { name: 'DAI', value: '$900', apy: 4.25, collateral: 'No' },
    { name: 'USDC', value: '$2,300', apy: 3.15, collateral: 'No' },
    { name: 'WBTC', value: '$1,000', apy: 6.0, collateral: 'Yes' },
    { name: 'GHO', value: '$1,000', apy: 6.0, collateral: 'Yes' },
    { name: 'WETH', value: '$1,000', apy: 6.0, collateral: 'Yes' }
  ];

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
              <th>Can be collateral</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {borrowAssetsData.map((asset, index) => (
              <tr key={index}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <img
                      src={tokenIcons[asset.name]}
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
                <td>{asset.apy}%</td>
                <td>{asset.collateral}</td>
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
