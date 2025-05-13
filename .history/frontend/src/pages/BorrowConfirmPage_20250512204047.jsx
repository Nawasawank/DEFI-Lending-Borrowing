import React from 'react';
import '../styles/SupplyConfirmPage.css'; // Reusing same CSS for confirmation
import Check from '../pictures/Check.png';

const BorrowConfirmPage = ({ onClose, tokenName, amount }) => {
  const formattedAmount = amount ? parseFloat(amount).toFixed(2) : '...';

  return (
    <div className="confirm-overlay">
      <div className="confirm-content">
        <div className="checkmark-circle">
          <img src={Check} alt="Check" className="checkmark-icon" />
        </div>

        <h2 className="confirm-title">Borrow complete!</h2>

        <p className="confirm-description">
          You Borrowed {formattedAmount} {tokenName}
        </p>

        <button className="confirm-button" onClick={onClose}>
          Ok, Close
        </button>
      </div>
    </div>
  );
};

export default BorrowConfirmPage;
