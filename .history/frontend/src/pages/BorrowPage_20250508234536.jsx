import React, { useState } from 'react';
import '../styles/BorrowPage.css'; // Reuse existing styles
import { useNavigate } from 'react-router-dom';
import heartIcon from '../pictures/heart.png'; // ✅ Import your heart icon

const BorrowPage = ({ onClose, tokenName, apy, amountAvailable }) => {
  // Mock the values temporarily to avoid no-undef errors
  const [amount, setAmount] = useState(10); // Initialize with a default value
  const [hasError, setHasError] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const navigate = useNavigate();

  const handleBorrowClick = () => {
    setAmount(amount); // Mock the setAmount function to update the amount
    setHasError(false); // Mock for error handling logic
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
              onChange={(e) => setAmount(e.target.value)} // This will work with the mock
            />
            <span className="token-name">{tokenName}</span>
            <span className="max-text">Available {amountAvailable} <strong>Max</strong></span>
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
                  verticalAlign: 'right',
                  marginRight: '6px'
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
