import React from "react";
import "../styles/SupplyPage.css";

  return (
    <div className="supply-modal-overlay">
      <div className="supply-modal">
        <div className="supply-header">
          <span className="supply-title">Supply xxxx</span>
          <button className="close-button" onClick={onClose}>
            ×
          </button>
        </div>

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
