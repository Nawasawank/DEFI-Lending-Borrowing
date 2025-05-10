import React, { useState } from 'react';
import '../styles/BorrowPage.css';
import { useNavigate } from 'react-router-dom';
import heartIcon from '../pictures/heart.png';
import wethIcon from '../pictures/WETH.png';
import wbtcIcon from '../pictures/WBTC.png';
import usdcIcon from '../pictures/USDC.png';
import daiIcon from '../pictures/DAI.png';
import ghoIcon from '../pictures/GHO.png';
import BorrowConfirmPage from './BorrowConfirmPage'; // ✅ import confirm page

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
  const [showConfirm, setShowConfirm] = useState(false); // ✅ for confirmation page
  const navigate = useNavigate();

  const handleBorrowClick = () => {
    if (amount <= 0 || amount > amountAvailable) {
      setHasError(true);
    } else {
      console.log(`Borrowing ${amount} ${tokenName}`);
      setHasError(false);
      setShowConfirm(true); // ✅ show confirmation
    }
  };

  const handleCloseConfirm = () => {
    setShowConfirm(false);
    onClose();
  };

  return (
    <div className="borrowpage-overlay">
      <div className="borrowpage-content">
        {showConfirm ? (
          <BorrowConfirmPage
            onClose={handleCloseConfirm}
            tokenName={tokenName}
            amount={amount}
          />
        ) : (
          <>
            <button className="close-button" onClick={onClose}>×</button>

            <h2 className="modal-title">Borrow {tokenName}</h2>

            <div className="input-section">
              <label>Amount</label>
              <div className="input-box" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  style={{ flex: 1, marginRight: '10px' }}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="token-name">{tokenName}</span>
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
                </div>
              </div>
              <div className="max-text">
                Available {amountAvailable} <strong>Max</strong>
              </div>
            </div>

            <h4 className="overview-title">Transaction Overview</h4>
            <div className="overview-box">
              <div className="row" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
                <span>Health factor</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {apy}%
                  <img
                    src={heartIcon}
                    alt="heart"
                    style={{
                      width: '16px',
                      verticalAlign: 'middle',
                    }}
                  />
                </span>
              </div>
              <div className="row">
                <span></span>
                <span className="enable-text">Liquidation at &lt;1.0</span>
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
          </>
        )}
      </div>
    </div>
  );
};

export default BorrowPage;
