import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import makeBlockie from "ethereum-blockies-base64";
import "../styles/Sidebar.css";

// Import PNG icons
import homeIcon from "../pictures/homeIcon.png";
import marketIcon from "../pictures/marketIcon.png";
import alertIcon from "../pictures/alertIcon.png";
import switchIcon from "../pictures/switchIcon.png";
import settingIcon from "../pictures/settingIcon.png";

const Sidebar = () => {
  const [account, setAccount] = useState(null);
  const [blockieSrc, setBlockieSrc] = useState("");

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

        {/* Risk Alert */}
        <Link to="/risk">
          <li>
            <img src={alertIcon} alt="Risk Alert" className="w-6 h-6" />
            Risk Alert
          </li>
        </Link>

        {/* Account Section */}
        <li className="account-title">Account Page</li>

        {/* Profile Setting */}
        <li className="user-box">
          <Link to="/profile-settings" className="profile-setting-link">
            <img
              src={settingIcon}
              alt="Settings"
              style={{ width: "24px", height: "24px" }}
            />
            <span>Profile Setting</span>
          </Link>
        </li>

        {/* Switch Token */}
        <li className="switch-box">
          <Link to="/switch-token" className="switch-display">
            <img
              src={switchIcon}
              alt="Switch Token"
              style={{ width: "24px", height: "24px" }}
            />
            <span>Switch Token</span>
          </Link>
        </li>

        {/* MetaMask Connect Wallet */}
        <li className="metamask-box">
          {account ? (
            <div className="wallet-display">
              <img className="wallet-icon" src={blockieSrc} alt="wallet icon" />
              <span className="wallet-address">
                {account.slice(0, 6)}...{account.slice(-4)}
              </span>
            </div>
          ) : (
            <button onClick={connectWallet} className="metamask-connect-btn">
              Connect Wallet
            </button>
          )}
        </li>
      </ul>
    </div>
  );
};

export default Sidebar;
