import React, { useState } from 'react';
import '../styles/BorrowPage.css';
import { useNavigate } from 'react-router-dom';
import heartIcon from '../pictures/heart.png';
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

const BorrowPage = ({ onClose, tokenName, apy, amountAvailable }) => {
  const [amount, setAmount] = useState(10);
  const [hasError, setHasError] = useState(false);
  const navigate = useNavigate();

  const handleBorrowClick = () => {
    // Add actual borrow logic or validation here
    setHasError(false);
  };

  return (
    <div className="borrowpage-overlay">
      <div className="borrowpage-content">
        <button className="close-button" onClick={onClose}>×</button>

        <h2 className="modal-title">Borrow {tokenName}</h2>

        <div className="input-section">
          <label>Amount</label>
          <div className="input-box">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <img
                src={tokenIcons[tokenName]}
                alt={tokenName}
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  backgroundColor: 'white',
                }}
              />
              <span className="token-name">{tokenName}</span>
            </div>
          </div>
          <div className="max-text">
            Available {amountAvailable} <strong>Max</strong>
          </div>
        </div>

        <h4 className="overview-title">Transaction Overview</h4>
        <div className="overview-box">
          <div className="row">
            <span>Health factor</span>
            <span>
              <img
                src={heartIcon}
                alt="heart"
                style={{
                  width: '16px',
                  verticalAlign: 'middle',
                  marginRight: '6px',
                }}
              />
              {apy}% <br />
              <span className="enable-text">Liquidation at &lt;1.0</span>
            </span>
          </div>
        </div>

        <div className="sbutton-container">
          <button
            className={`borrowpa-button ${hasError ? 'error shake' : ''}`}
            onClick={handleBorrowClick}
          >
            Borrow {tokenName}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BorrowPage;
