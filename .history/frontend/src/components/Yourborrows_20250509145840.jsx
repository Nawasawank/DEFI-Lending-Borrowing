import React from 'react';
import '../styles/Yourborrows.css';  // Ensure this CSS path is correct

// ✅ Token icons
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

function Yourborrows() {
  const borrows = {
    balance: '$20.00',
    apy: '3.45%',
    totalDebt: '$30.00',
    liabilities: [
      { id: 1, debt: 3.2, apy: '2.90', name: 'WETH', type: 'Variable' },
      { id: 2, debt: 0.5, apy: '3.50', name: 'WBTC', type: 'Stable' },
      { id: 3, debt: 120, apy: '2.00', name: 'USDC', type: 'Variable' },
      { id: 4, debt: 80, apy: '2.15', name: 'DAI', type: 'Variable' },
      { id: 5, debt: 150, apy: '3.80', name: 'GHO', type: 'Stable' },
    ]
  };

  return (
    <div className="activity-containerb">
      <div className="borrows">
        <div className="borrows-header">
          <h2>Your Borrows</h2>
          <div className="info-sectionb">
            <div className="info-boxb">Balance {borrows.balance}</div>
            <div className="info-boxb">APY {borrows.apy}</div>
            <div className="info-boxb">Total Debt {borrows.totalDebt}</div>
          </div>
        </div>
        <table className="b">
          <thead>
            <tr>
              <th>Assets</th>
              <th>Debt</th>
              <th>APY</th>
              <th>APY type</th>
              <th></th>
            </tr>
          </thead>
          <tbody className="b">
            {borrows.liabilities.map(liability => (
              <tr key={liability.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <img
                      src={tokenIcons[liability.name]}
                      alt={liability.name}
                      style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: 'white' }}
                    />
                    <span>{liability.name}</span>
                  </div>
                </td>
                <td>{liability.debt}</td>
                <td>{liability.apy}%</td>
                <td>{liability.type}</td>
                <td style={{ textAlign: 'right' }}>
                  <button className="link-buttonb Repay-buttonb">Repay</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Yourborrows;
