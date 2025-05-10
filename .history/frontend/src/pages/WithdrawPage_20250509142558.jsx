import React, { useState } from 'react';
import '../styles/WithdrawPage.css';

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

const WithdrawPage = ({ onClose, tokenName = 'USDC', available = 0.045246 }) => {
  const [amount, setAmount] = useState(10);
  const remainingSupply = Math.max(0, available - amount);

  return (
    <div className="withdrawpage-overlay">
      <div className="withdrawpage-content">
        <button className="close-button" onClick={onClose}>×</button>

        <h2 className="modal-title">Withdraw {tokenName}</h2>

        <div className="input-section">
          <label>Amount</label>
          <div className="input-box">
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
              />
            </div>
          </div>
          <div className="max-text">
            Available {available} <strong>Max</strong>
          </div>
        </div>

        <h4 className="overview-title">Transaction Overview</h4>
        <div className="overview-box">
          <div className="row">
            <span>Remaining Supply</span>
            <span>
              {remainingSupply.toFixed(2)} <strong>{tokenName}</strong>
            </span>
          </div>
        </div>

        <div className="sbutton-container">
          <button className="withdraw-button">Withdraw {tokenName}</button>
        </div>
      </div>
    </div>
  );
};

export default WithdrawPage;
