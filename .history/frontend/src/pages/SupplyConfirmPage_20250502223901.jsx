import React from 'react';
import '../styles/SupplyConfirmPage.css';
import Check from '../pictures/Check.png';

// NOTE: The `amount` prop here should come from the backend.
// This means the parent component (e.g., SupplyPage) must fetch the amount
// via an API and pass it to this component like so:
// <SupplyConfirmPage amount={fetchedAmount} ... />

const SupplyConfirmPage = ({ onClose, tokenName, amount }) => {
  return (
    <div className="confirm-overlay">
      <div className="confirm-content">

        <div className="checkmark-circle">
          <img src={Check} alt="Check" className="checkmark-icon" />
        </div>

        <h2 className="confirm-title">All done !</h2>

        {/* The `amount` here is expected to be fetched from backend before this page is shown */}
        <p className="confirm-description">
            You Supplied {amount ? amount.toFixed(2) : '...'} {tokenName}
        </p>


        <button className="confirm-button" onClick={onClose}>
          Ok, Close
        </button>
      </div>
    </div>
  );
};

export default SupplyConfirmPage;
