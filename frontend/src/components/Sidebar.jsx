import React from "react";
import { Link } from "react-router-dom";
import "../styles/Sidebar.css";

// Import PNG icons
import homeIcon from "../pictures/homeIcon.png";
import marketIcon from "../pictures/marketIcon.png";
import alertIcon from "../pictures/alertIcon.png";
import userIcon from "../pictures/userIcon.png";
import switchIcon from "../pictures/switchIcon.png";

const Sidebar = () => {
  return (
    <div className="sidebar-container">
      <div className="sidebar">
        <ul>
          {/* Dashboard */}
          <li>
            <img src={homeIcon} alt="Dashboard" className="w-6 h-6" />
            <Link to="/dashboard">Dashboard</Link>
          </li>

          {/* Market */}
          <li>
            <img src={marketIcon} alt="Market" className="w-6 h-6" />
            <Link to="/market">Market</Link>
          </li>

          {/* Risk Alert */}
          <li>
            <img src={alertIcon} alt="Risk Alert" className="w-6 h-6" />
            <Link to="/risk-alert">Risk Alert</Link>
          </li>

          {/* Account Section */}
          <li className="account-title">Account Page</li>

          {/* User Info */}
          <li className="user-box">
            <img src={userIcon} alt="User" className="w-8 h-8 rounded-full" />
            <span>User xxxx</span>
          </li>

          {/* Switch Token */}
          <li>
            <Link to="/switch-token" className="switch-box">
              <img
                src={switchIcon}
                alt="Switch Token"
                style={{ width: "27px", height: "27px" }}
              />
              <span>Switch Token</span>
            </Link>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default Sidebar;
