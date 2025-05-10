import React from 'react';
import '../styles/DisplayIcons.css';  // Ensure you create this CSS file

const DisplayIcons = () => {
  return (
    <div className="icons-container">
      <div className="icon-group">
        <div className="icon-box">
          <span className="icon-label">Net Worth</span>
          <span className="icon-value">$ 0</span>
        </div>
        <div className="icon-box">
          <span className="icon-label">Net APY</span>
          <span className="icon-value">-</span>
        </div>
        <div className="icon-box">
          <span className="icon-label">Health factor</span>
          <span className="icon-value">$ 0.5</span>
        </div>
      </div>
      <button className="view-transaction-button">View Transaction</button>
    </div>
  );
};

export default DisplayIcons;
