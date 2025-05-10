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

// Optional: mock APY and availability per token
const tokenData = {
  WETH: { apy: 3.2, available: 100 },
  WBTC: { apy: 4.1, available: 50 },
  USDC: { apy: 2.5, available: 300 },
  DAI: { apy: 2.71, available: 900 },
  GHO: { apy: 3.8, available: 120 },
};

const BorrowPage = ({ onClose }) => {
  const [selectedToken, setSelectedToken] = useState('DAI');
  const [amount, setAmount] = useState(10);
  const [hasError, setHasError] = useState(false);
  const navigate = useNavigate();

  const handleBorrowClick = () => {
    if (amount <= 0 || amount > tokenData[selectedToken].available) {
      setHasError(true);
    } else {
      console.log(`Borrowing ${amount} ${selectedToken}`);
      setHasError(false);
    }
  };

  return (
    <div className="borrowpage-overlay">
      <div className="borrowpage-content">
        <button className="close-button" onClick={onClose}>×</button>

        <h2 className="modal-title">Borrow {selectedToken}</h2>

        <div className="input-section">
          <label>Select Token</label>
          <select
            className="token-dropdown"
            value={selectedToken}
            onChange={(e) => setSelectedToken(e.target.value)}
          >
            {Object.keys(tokenData).map((token) => (
              <option key={token} value={token}>
                {token}
              </option>
            ))}
          </select>

          <label>Amount</label>
          <div className="input-box" style={{ justifyContent: 'space-between' }}>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              style={{ flex: 1, marginRight: '10px' }}
            />
            <img
              src={tokenIcons[selectedToken]}
              alt={selectedToken}
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                backgroundColor: 'white',
              }}
            />
          </div>
          <div className="max-text">
            Available {tokenData[selectedToken].available} <strong>Max</strong>
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
              {tokenData[selectedToken].apy}% <br />
              <span className="enable-text">Liquidation at &lt;1.0</span>
            </span>
          </div>
        </div>

        <div className="sbutton-container">
          <button
            className={`borrowpa-button ${hasError ? 'error shake' : ''}`}
            onClick={handleBorrowClick}
          >
            Borrow {selectedToken}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BorrowPage;
