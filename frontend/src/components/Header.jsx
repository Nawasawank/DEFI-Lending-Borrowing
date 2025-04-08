import React from "react";
import "../styles/Header.css"; // Ensure the CSS path is correct
import ethereumIcon from "../pictures/ethereumIcon.png"; // Correctly importing the image

function Header() {
  return (
    <header className="core-header">
      <img src={ethereumIcon} alt="Ethereum Icon" className="ethereum-icon" />
      <div className="header-content">
        <h1 className="header-title">Core instance</h1>
        <p className="header-subtitle">
          Main Ethereum market with the largest selection of assets and yield
          options
        </p>
      </div>
    </header>
  );
}

export default Header;
