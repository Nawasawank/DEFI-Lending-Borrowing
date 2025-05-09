import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import makeBlockie from "ethereum-blockies-base64";
import "../styles/Sidebar.css";

// Import PNG icons
import homeIcon from "../pictures/homeIcon.png";
import marketIcon from "../pictures/marketIcon.png";
import liquidatorIcon from "../pictures/liquidatorIcon.png";
import walletIcon2 from "../pictures/walletIcon2.png";
import WETH from "../pictures/WETH.png";
import WBTC from "../pictures/WBTC.png";
import USDC from "../pictures/USDC.png";
import DAI from "../pictures/DAI.png";
import GHO from "../pictures/GHO.png";

const Sidebar = () => {
  const [account, setAccount] = useState(null);
  const [blockieSrc, setBlockieSrc] = useState("");
  const [showOverlay, setShowOverlay] = useState(false); // State for overlay
  const [selectedAsset, setSelectedAsset] = useState(null); // State for selected asset

  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        const accounts = await window.ethereum.request({
          method: "eth_requestAccounts",
        });
        setAccount(accounts[0]);
        setBlockieSrc(makeBlockie(accounts[0]));
      } catch (error) {
        console.error("Connection rejected:", error);
      }
    } else {
      alert(
        "MetaMask not detected. Please install it from https://metamask.io/"
      );
    }
  };

  useEffect(() => {
    if (window.ethereum && window.ethereum.selectedAddress) {
      const addr = window.ethereum.selectedAddress;
      setAccount(addr);
      setBlockieSrc(makeBlockie(addr));
    }

    if (window.ethereum) {
      window.ethereum.on("accountsChanged", (accounts) => {
        const addr = accounts[0];
        setAccount(addr);
        setBlockieSrc(makeBlockie(addr));
      });
    }
  }, []);

  const toggleOverlay = () => {
    if (showOverlay) {
      setSelectedAsset(null); // Reset selected asset when closing
    }
    setShowOverlay(!showOverlay); // Toggle overlay visibility
  };

  const handleAssetSelection = (asset) => {
    setSelectedAsset(asset); // Update the selected asset
  };

  return (
    <div className="sidebar">
      <ul>
        {/* Dashboard */}
        <Link to="/">
          <li>
            <img src={homeIcon} alt="Dashboard" className="w-6 h-6" />
            Dashboard
          </li>
        </Link>

        {/* Market */}
        <Link to="/market">
          <li>
            <img src={marketIcon} alt="Market" className="w-6 h-6" />
            Market
          </li>
        </Link>

        {/* Account Section */}
        <li className="account-title">Account Page</li>

        {/* Liquidator Box */}
        <li className="liquidator-box">
          <button onClick={toggleOverlay} className="liquidator-btn">
            <img
              src={liquidatorIcon}
              alt="Liquidator"
              style={{ width: "24px", height: "24px", marginRight: "10px" }}
            />
            Become a liquidator
          </button>
        </li>

        {/* MetaMask Connect Wallet */}
        <li className="metamask-box">
          {account ? (
            <div className="wallet-display">
              <img
                className="wallet-icon"
                src={walletIcon2}
                alt="wallet icon"
                style={{ marginRight: "10px" }}
              />
              <span className="wallet-address">
                {account.slice(0, 6)}...{account.slice(-4)}
              </span>
            </div>
          ) : (
            <button onClick={connectWallet} className="metamask-connect-btn">
              <img
                src={walletIcon2}
                alt="Wallet Icon"
                style={{
                  width: "20px",
                  height: "20px",
                  marginRight: "10px",
                }}
              />
              Connect Wallet
            </button>
          )}
        </li>
      </ul>

      {/* Overlay */}
      {showOverlay && (
        <div className="overlay">
          <div className="overlay-content">
            <button className="close-button" onClick={toggleOverlay}>
              ×
            </button>
            <h2 className="overlay-title">Please select your repay asset</h2>
            <div
              className={`asset-button ${
                selectedAsset === "WETH" ? "selected" : ""
              }`}
              onClick={() => handleAssetSelection("WETH")}
            >
              <img src={WETH} alt="WETH Icon" className="asset-icon" />
              <span className="asset-name">WETH</span>
            </div>
            <div
              className={`asset-button ${
                selectedAsset === "WBTC" ? "selected" : ""
              }`}
              onClick={() => handleAssetSelection("WBTC")}
            >
              <img src={WBTC} alt="WBTC Icon" className="asset-icon" />
              <span className="asset-name">WBTC</span>
            </div>
            <div
              className={`asset-button ${
                selectedAsset === "USDC" ? "selected" : ""
              }`}
              onClick={() => handleAssetSelection("USDC")}
            >
              <img src={USDC} alt="USDC Icon" className="asset-icon" />
              <span className="asset-name">USDC</span>
            </div>
            <div
              className={`asset-button ${
                selectedAsset === "DAI" ? "selected" : ""
              }`}
              onClick={() => handleAssetSelection("DAI")}
            >
              <img src={DAI} alt="DAI Icon" className="asset-icon" />
              <span className="asset-name">DAI</span>
            </div>
            <div
              className={`asset-button ${
                selectedAsset === "GHO" ? "selected" : ""
              }`}
              onClick={() => handleAssetSelection("GHO")}
            >
              <img src={GHO} alt="GHO Icon" className="asset-icon" />
              <span className="asset-name">GHO</span>
            </div>
            <button className="confirm-btn">Confirm</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sidebar;
