import React from 'react';
import '../styles/RepayConfirmPage.css';
import CheckIcon from '../pictures/Check.png'; // ✅ Replace with your actual checkmark image

const RepayConfirmPage = ({ onClose, tokenName, amount }) => {
  return (
    <div className="repayconfirm-overlay">
      <div className="repayconfirm-content">
        <div className="checkmark-circle">
          <img src={CheckIcon} alt="Check" className="checkmark-icon" />
        </div>

        <h2 className="confirm-title">All done!</h2>
        <p className="confirm-description">
          You repaid {amount?.toFixed(2)} {tokenName}
        </p>

        <button className="confirm-button" onClick={onClose}>
          Ok, Close
        </button>
      </div>
    </div>
  );
};

export default RepayConfirmPage;
