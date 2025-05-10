import React, { useState } from 'react';
import '../styles/Yourborrows.css';

import RepayPage from '../pages/RepayPage'; // ✅ Import the RepayPage

// ✅ Token icons
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

function Yourborrows() {
  const [isRepayOpen, setIsRepayOpen] = useState(false);
  const [selectedLiability, setSelectedLiability] = useState(null);

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

  const handleOpenRepay = (liability) => {
    setSelectedLiability(liability);
    setIsRepayOpen(true);
  };

  const handleCloseRepay = () => {
    setSelectedLiability(null);
    setIsRepayOpen(false);
  };

  return (
    <>
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
                    <button
                      className="link-buttonb Repay-buttonb"
                      onClick={() => handleOpenRepay(liability)}
                    >
                      Repay
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isRepayOpen && selectedLiability && (
        <div className="repay-overlay">
          <div className="repay-modal">
            <RepayPage
              onClose={handleCloseRepay}
              tokenName={selectedLiability.name}
              debt={selectedLiability.debt}
              healthStart={4.91}
              healthEnd={225.55}
            />
          </div>
        </div>
      )}
    </>
  );
}

export default Yourborrows;
