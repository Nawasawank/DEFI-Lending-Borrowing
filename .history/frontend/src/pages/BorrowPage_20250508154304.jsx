import React, { useState } from 'react';
import '../styles/SupplyPage.css'; // Reuse existing styles
import { useNavigate } from 'react-router-dom';
import heartIcon from '../pictures/heart.png'; // ✅ Import your heart icon

const BorrowPage = ({ onClose, tokenName, apy, amountAvailable }) => {
  // eslint-disable-next-line no-unused-vars
  const [showConfirm, setShowConfirm] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [hasError, setHasError] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const navigate = useNavigate();

  const handleBorrowClick = () => {
    setShowConfirm(true); // Placeholder for confirmation logic
  };

  return (
    <div className="borrowpa-overlay">
      <div className="borrowpa-content">
        <button className="close-button" onClick={onClose}>×</button>

        <h2 className="modal-title">Borrow {tokenName}</h2>

        <div className="input-section">
          <label>Amount</label>
          <div className="input-box">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
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
                  verticalAlign: 'middle',
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
