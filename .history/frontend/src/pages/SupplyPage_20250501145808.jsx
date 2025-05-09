import React, { useState } from 'react';
import '../styles/SupplyPage.css';
import SupplyConfirmPage from './SupplyConfirmPage'; // ✅ Import the component, not the CSS
import { useNavigate } from 'react-router-dom';

// Optional asset icon map (not used currently)
// import daiIcon from '../assets/dai.png';
// import usdcIcon from '../assets/usdc.png';
// import ethIcon from '../assets/eth.png';
// const assetIcons = {
//   DAI: daiIcon,
//   USDC: usdcIcon,
//   ETH: ethIcon,
// };

const SupplyPage = ({ onClose, tokenName, apy, amount, asset }) => {
  // const icon = assetIcons[asset] || daiIcon;

  const [showConfirm, setShowConfirm] = useState(false); // controls popup visibility
  const [hasError, setHasError] = useState(false); // controls error state

  const handleSupplyClick = () => {
    setShowConfirm(true); // this will trigger showing <SupplyConfirmPage />
  };


  const handleCloseToDashboard = () => {
    navigate('/dashboard');
  };

  return (
    <div className="supplypage-overlay">
      <div className="supplypage-content">
        {showConfirm ? (
          <SupplyConfirmPage
            onClose={handleCloseToDashboard}
            tokenName={tokenName}
            amount={amount}
          />
        ) : (
          // ✅ CASE 2: If showConfirm is false, show the default supply form
          <>
            <button className="close-button" onClick={onClose}>×</button>

            <h2 className="modal-title">Supply {tokenName}</h2>

            <div className="input-section">
              <label>Amount</label>
              <div className="input-box">
                <input type="number" value={amount} readOnly />
                {/* icon placeholder */}
                {/* <div className="input-icon">
                  <img src={icon} alt={asset} className="asset-icon" />
                </div> */}
                <span className="token-name">{tokenName}</span>
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
              {/* Show red + shake if hasError is true */}
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