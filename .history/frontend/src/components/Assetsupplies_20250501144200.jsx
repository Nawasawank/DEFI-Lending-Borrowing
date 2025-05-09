import React from 'react';
import '../styles/Assetsupplies.css';

const AssetSupplies = ({ onOpenSupply }) => {
  const assetsData = [
    { name: 'ETH', value: '$1,200', apy: '3.45%', collateral: 'Yes' },
    { name: 'USDC', value: '$5,000', apy: '2.20%', collateral: 'Yes' },
    { name: 'MATIC', value: '$800', apy: '5.10%', collateral: 'No' }
  ];

  return (
    <div className="asset-container">
      <div className="asset-header">
        <h2 style={{ color: 'white', marginLeft: '20px' }}>Assets to supply</h2>
      </div>
      <div className="asset-content">
        <table className="asset">
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
                    <div className="assetsupplies-icon" />
                    <span>{asset.name}</span>
                  </div>
                </td>
                <td>{asset.value}</td>
                <td>{asset.apy}</td>
                <td>{asset.collateral}</td>
                <td style={{ textAlign: 'right' }}>
                  <button
                    className="assetlink-button Supply-button"
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

export default AssetSupplies;
