import React from "react";
import "../styles/MarketDetail.css";
import MarketHeader from "../components/MarketHeader";
import walletIcon from "../pictures/walletIcon.svg";

function MarketDetail() {
  return (
    <div className="marketdetail-container">
      <MarketHeader />

      {/* Detail Info */}
      <div className="detail-container">
        <div className="detail-info">
          <h1>Reserve status & configuration</h1>

          {/* Supply */}
          <div className="info-container">
            <div className="info-upper">
              <p className="bold">Supply Info</p>
              <div className="upper-summary">
                <p>Total supplied</p>
                <p className="bold">0 M of 0 M</p>
                <p>$0 of $0</p>
              </div>
              <div className="upper-summary">
                <p>APY, Variable</p>
                <p className="bold">0 %</p>
              </div>
            </div>
            <p className="bold">Collateral usage</p>
            <div className="info-lower">
              <div className="info-card">
                <p>Max LTV</p>
                <p className="bold">0 %</p>
              </div>
              <div className="info-card">
                <p>Liquidation threshold</p>
                <p className="bold">0 %</p>
              </div>
              <div className="info-card">
                <p>Liquidation penalty</p>
                <p className="bold">0 %</p>
              </div>
            </div>
          </div>

          {/* Borrow */}
          <div className="info-container">
            <div className="info-upper">
              <p className="bold">Borrow Info</p>
              <div className="upper-summary">
                <p>Total supplied</p>
                <p className="bold">0 M of 0 M</p>
                <p>$0 of $0</p>
              </div>
              <div className="upper-summary">
                <p>APY, Variable</p>
                <p className="bold">0 %</p>
              </div>
              <div className="upper-summary">
                <p>Borrow cap</p>
                <p className="bold">0 M</p>
                <p>$0 of $0</p>
              </div>
            </div>
            <p className="bold">Collector Info</p>
            <div className="info-lower">
              <div className="info-card">
                <p>Reserve factor</p>
                <p className="bold">??</p>
              </div>
            </div>
          </div>

          {/* Interest Rate */}
          <div className="last-info-container">
            <div className="info-upper">
              <p className="bold">Interest rate model</p>
              <div className="upper-summary">
                <p>Utilization Rate</p>
                <p className="bold">0 %</p>
              </div>
            </div>
          </div>
        </div>

        {/* Your Info */}
        <div className="your-info">
          <h1>Your Info</h1>
          <div className="wallet-container">
            <img
              className="info-wallet-icon"
              src={walletIcon}
              alt="Wallet Icon"
            />
            <div className="wallet-info">
              <p>wallet balance</p>
              <p>0 WETH</p>
            </div>
          </div>
          <div className="supply-borrow">
            <div className="sb-detail">
              <p>Available to supply</p>
              <p className="bold">0 WETH</p>
              <p>$0</p>
            </div>
            <button className="sb-button">Supply</button>
          </div>
          <div className="supply-borrow">
            <div className="sb-detail">
              <p>Available to borrow</p>
              <p className="bold">0 WETH</p>
              <p>$0</p>
            </div>
            <button className="sb-button">Borrow</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MarketDetail;
