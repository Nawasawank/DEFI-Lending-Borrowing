import React, { useState } from "react";
import { Link } from "react-router-dom";
import "../styles/Sidebar.css";
import { ReactComponent as xIcon } from "../pictures/xIcon.svg";

// Import PNG icons
import homeIcon from "../pictures/homeIcon.png";
import marketIcon from "../pictures/marketIcon.png";
import alertIcon from "../pictures/alertIcon.png";
import userIcon from "../pictures/userIcon.png";
import switchIcon from "../pictures/switchIcon.png";

const Sidebar = () => {
  const [showUserOverlay, setShowUserOverlay] = useState(false);
  const toggleUserOverlay = () => {
    setShowUserOverlay(!showUserOverlay);
  };

  return (
    <div className="sidebar-container">
      <div className="sidebar">
        <ul>
          <Link to="/">
            <li>
              <img src={homeIcon} alt="Dashboard" className="w-6 h-6" />
              Dashboard
            </li>
          </Link>
          <Link to="/market">
            <li>
              <img src={marketIcon} alt="Market" className="w-6 h-6" />
              Market
            </li>
          </Link>
          <Link to="/risk-alert">
            <li>
              <img src={alertIcon} alt="Risk Alert" className="w-6 h-6" />
              Risk Alert
            </li>
          </Link>
          <li className="account-title">Account Page</li>
          <Link to="/user">
            <li className="user-box" onClick={toggleUserOverlay}>
              <img src={userIcon} alt="User" className="w-8 h-8 rounded-full" />
              <span>User xxxx</span>
            </li>
          </Link>
          <Link to="/switch-token">
            <li className="switch-box">
              <img
                src={switchIcon}
                alt="Switch Token"
                style={{ width: "27px", height: "27px" }}
              />
              <span>Switch Token</span>
            </li>
          </Link>
        </ul>
      </div>

      {/* User Overlay */}
      {showUserOverlay && (
        <div className="overlay-container">
          <div className="overlay-content">
            <div className="close-container" onClick={toggleUserOverlay}>
              <button className="close-button">
                <xIcon className="close-icon" />
              </button>
            </div>
            <div className="user-pic">
              <p>user pic</p>
            </div>
            <div className="user-info">
              <h2>User Name</h2>
              <p>-- eth</p>
            </div>
            <button className="disconnect-button">Disconnect</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sidebar;
