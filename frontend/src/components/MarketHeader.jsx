import React from "react";
import "../styles/MarketHeader.css"; // Ensure the CSS path is correct
import ethereumIcon from "../pictures/ethereumIcon.png"; // Correctly importing the image

function Header() {
  return (
    <header className="market-header">
      <div className="asset">
        <div className="asset-head">
          <div className="asset-icon"></div>
          <p>Name</p>
        </div>
        <div className="core-icon">
          <img src={ethereumIcon} alt="Ethereum Icon" className="eth-icon" />
          <p>Core Market</p>
        </div>
      </div>
      <div className="asset-info-container">
        <div className="asset-info">
          <p>Reserve Size</p>
          <p>0 $</p>
        </div>
        <div className="asset-info">
          <p>Available Liquidity</p>
          <p>0 $</p>
        </div>
        <div className="asset-info">
          <p>Utilization Rate</p>
          <p>0 %</p>
        </div>
        <div className="asset-info">
          <p>Oracle Prize</p>
          <p>0 $</p>
        </div>
      </div>
    </header>
  );
}

export default Header;
