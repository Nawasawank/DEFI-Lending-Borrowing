import React from "react";
import "../styles/SupplyPage.css";

const SupplyPage = ({ onClose }) => {
  return (
    <div className="supply-modal-overlay">
      <div className="supply-modal">
        <div className="supply-header">
          <span className="supply-title">Supply xxxx</span>
          <button className="close-button" onClick={onClose}>
            ×
          </button>
        </div>

        {/* Amount input section */}
        <div className="supply-section">
          <label>Amount</label>
          <div className="supply-input-box">
            <div className="amount-left">
              <input type="number" defaultValue="10" />
              <small>$ 10.00</small>
            </div>
            <div className="amount-right">
              <span className="token-toggle"></span>
              <span className="token-symbol">xxxx</span>
            </div>
          </div>
        </div>

        {/* Transaction Overview */}
        <div className="supply-section">
          <label className="transaction-title">Transaction Overview</label>
          <div className="overview-box">
            <div className="overview-row">
              <span>Supply APY</span>
              <span>2.71%</span>
            </div>
            <div className="overview-row">
              <span>Collateralization</span>
              <span className="enable-btn">Enable</span>
            </div>
          </div>
        </div>

        {/* Fee display */}
        <div className="fee-display">
          <span role="img" aria-label="gas">
            ⛽
          </span>{" "}
          $0.05
        </div>

        {/* Submit Button */}
        <button className="supply-submit-btn">Supply xxxx</button>
      </div>
    </div>
  );
};

export default SupplyPage;
