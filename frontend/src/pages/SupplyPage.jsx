import React, { useState } from 'react';
import '../styles/SupplyPage.css';
import SupplyConfirmPage from './SupplyConfirmPage';
import { useNavigate } from 'react-router-dom';

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

const SupplyPage = ({ onClose, tokenName, apy, amount }) => {
  const [showConfirm, setShowConfirm] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [inputAmount, setInputAmount] = useState(amount);
  const navigate = useNavigate();

  const handleSupplyClick = () => {
    if (inputAmount <= 0) {
      setHasError(true);
    } else {
      setShowConfirm(true);
      setHasError(false);
    }
  };

  const handleCloseToDashboard = () => {
    onClose();
  };

  return (
    <div className="supplypage-overlay">
      <div className="supplypage-content">
        {showConfirm ? (
          <SupplyConfirmPage
            onClose={handleCloseToDashboard}
            tokenName={tokenName}
            amount={inputAmount}
          />
        ) : (
          <>
            <button className="close-button" onClick={onClose}>×</button>

            <h2 className="modal-title">Supply {tokenName}</h2>

            <div className="input-section">
              <label>Amount</label>
              <div className="input-box" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <input
                  type="number"
                  value={inputAmount}
                  onChange={(e) => setInputAmount(Number(e.target.value))}
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
            </div>

            <h4 className="overview-title">Transaction Overview</h4>
            <div className="overview-box">
              <div className="row">
                <span>Supply APY</span>
                <span>{apy}%</span>
              </div>
              <div className="row">
                <span>Collateralization</span>
                <span className="enable-text">Enable</span>
              </div>
            </div>

            <div className="sbutton-container">
              <button
                className={`supply-button ${hasError ? 'error shake' : ''}`}
                onClick={handleSupplyClick}
              >
                Supply {tokenName}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SupplyPage;
