import React from 'react';
import '../styles/RepayConfirmPage.css';
import CheckIcon from '../pictures/Check.png'; // ✅ Replace with your actual checkmark image

const RepayConfirmPage = ({ onClose, tokenName, amount }) => {
  const formattedAmount = isNaN(amount) ? "..." : Number(amount).toFixed(2);

  return (
    <div className="repayconfirm-overlay">
      <div className="repayconfirm-content">
        <div className="checkmark-circle">
          <img src={CheckIcon} alt="Check" className="checkmark-icon" />
        </div>

        <h2 className="confirm-title">Repay Complete!</h2>
        <p className="confirm-description">
          You repaid {formattedAmount} {tokenName}
        </p>

        <button className="confirm-button" onClick={onClose}>
          Ok, Close
        </button>
      </div>
    </div>
  );
};

export default RepayConfirmPage;
