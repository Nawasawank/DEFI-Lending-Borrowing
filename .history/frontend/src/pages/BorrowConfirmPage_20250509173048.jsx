import React from 'react';
import '../styles/SupplyConfirmPage.css'; // You can reuse the same CSS
import Check from '../pictures/Check.png';

const BorrowConfirmPage = ({ onClose, tokenName, amount }) => {
  return (
    <div className="confirm-overlay">
      <div className="confirm-content">

        <div className="checkmark-circle">
          <img src={Check} alt="Check" className="checkmark-icon" />
        </div>

        <h2 className="confirm-title">Borrow complete!</h2>

        <p className="confirm-description">
          You Borrowed {amount ? amount.toFixed(2) : '...'} {tokenName}
        </p>

        <button className="confirm-button" onClick={onClose}>
          Ok, Close
        </button>
      </div>
    </div>
  );
};

export default BorrowConfirmPage;
