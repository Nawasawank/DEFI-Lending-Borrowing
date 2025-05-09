import React from 'react';
import '../styles/Assetborrow.css';

const AssetBorrow = ({ onOpenBorrow }) => {
  const borrowAssetsData = [
    { name: 'DAI', value: '$900', apy: 4.25, collateral: 'No' },
    { name: 'USDT', value: '$2,300', apy: 3.15, collateral: 'No' },
    { name: 'WBTC', value: '$1,000', apy: 6.0, collateral: 'Yes' }
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
              <th></th> {/* Button column */}
            </tr>
          </thead>
          <tbody>
            {borrowAssetsData.map((asset, index) => (
              <tr key={index}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div className="asset-icon" />
                    <span>{asset.name}</span>
                  </div>
                </td>
                <td>{asset.value}</td>
                <td>{asset.apy}%</td>
                <td>{asset.collateral}</td>
                <td style={{ textAlign: 'right' }}>
                  <button
                    className="ablink-button borrow-button"
                    onClick={() => onOpenBorrow({
                      name: asset.name,
                      apy: asset.apy,
                      available: asset.value
                    })}
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
