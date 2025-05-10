import React, { useState } from 'react';
import '../styles/RepayPage.css';

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

const RepayPage = ({
  onClose,
  tokenName = 'USDC',
  debt = 0.011,
  healthStart = 4.91,
  healthEnd = 225.55
}) => {
  const [amount, setAmount] = useState(10);

  return (
    <div className="repaypage-overlay">
      <div className="repaypage-content">
        <button className="close-button" onClick={onClose}>×</button>

        <h2 className="modal-title">Repay {tokenName}</h2>

        <div className="input-section">
          <label>Repay with</label>
          <div className="input-box" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              style={{ flex: 1, marginRight: '10px' }}
            />
            <div className="token-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="token-name">{tokenName}</span>
              <img
                src={tokenIcons[tokenName]}
                alt={tokenName}
                className="token-icon"
                style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: 'white' }}
              />
            </div>
          </div>
        </div>

        <h4 className="overview-title">Transaction Overview</h4>
        <div className="overview-box">
          <div className="row">
            <span>Remaining debt</span>
            <span>{debt} {tokenName} → &lt; 0.00001 {tokenName}</span>
          </div>
          <div className="row">
            <span>Health factor</span>
            <span className="health-green">{healthStart} → {healthEnd}M</span>
          </div>
        </div>

        <div className="sbutton-container">
          <button className="repay-button">
            Approve {tokenName} to continue
          </button>
        </div>
      </div>
    </div>
  );
};

export default RepayPage;
