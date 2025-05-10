import React from 'react';
import '../styles/Assetsupplies.css';

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

const Assetsupplies = ({ onOpenSupply }) => {
  const assetsData = [
    { name: 'WETH', value: '$1,200', apy: '3.45%', collateral: 'Yes' },
    { name: 'WBTC', value: '$2,300', apy: '4.15%', collateral: 'Yes' },
    { name: 'USDC', value: '$5,000', apy: '2.20%', collateral: 'Yes' },
    { name: 'DAI', value: '$900', apy: '2.71%', collateral: 'Yes' },
    { name: 'GHO', value: '$1,000', apy: '3.60%', collateral: 'No' }
  ];

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
