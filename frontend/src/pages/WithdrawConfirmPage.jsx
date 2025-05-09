import React from 'react';
import '../styles/WithdrawConfirmPage.css';
import Check from '../pictures/Check.png'; // ✅ Make sure the path is correct

const WithdrawConfirmPage = ({ onClose, tokenName, amount }) => {
  return (
    <div className="withdraw-confirm-overlay">
      <div className="withdraw-confirm-content">

        <div className="checkmark-circle">
          <img src={Check} alt="Check" className="checkmark-icon" />
        </div>

        <h2 className="confirm-title">Withdrawal Successful</h2>

        <p className="confirm-description">
          You withdrew {amount ? amount.toFixed(2) : '...'} {tokenName}
        </p>

        <button className="confirm-button" onClick={onClose}>
          Ok, Close
        </button>
      </div>
    </div>
  );
};

export default WithdrawConfirmPage;
