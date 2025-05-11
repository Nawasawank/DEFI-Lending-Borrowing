import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import makeBlockie from "ethereum-blockies-base64";
import "../styles/Sidebar.css";

import homeIcon from "../pictures/homeIcon.png";
import marketIcon from "../pictures/marketIcon.png";
import liquidatorIcon from "../pictures/liquidatorIcon.png";
import walletIcon2 from "../pictures/walletIcon2.png";
import WETH from "../pictures/weth.png";
import WBTC from "../pictures/wbtc.png";
import USDC from "../pictures/usdc.png";
import DAI from "../pictures/dai.png";
import GHO from "../pictures/gho.svg";

const Sidebar = () => {
  const [account, setAccount] = useState(null);
  const [blockieSrc, setBlockieSrc] = useState("");
  const [showOverlay, setShowOverlay] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState(null);

  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        const accounts = await window.ethereum.request({
          method: "eth_requestAccounts",
        });
        setAccount(accounts[0]);
        setBlockieSrc(makeBlockie(accounts[0]));

        await fetchClaimToken(accounts[0]);
      } catch (error) {
        console.error("Connection rejected:", error);
      }
    } else {
      alert("MetaMask not detected. Please install it from https://metamask.io/");
    }
  };

  const fetchClaimToken = async (account) => {
    try {
      const response = await fetch(`http://localhost:3001/api/claimToken?userAddress=${account}`);
      const data = await response.json();

      if (response.ok) {
        const claimed = data.claimed?.length || 0;
        const skipped = data.skipped?.length || 0;

        alert(`✅ Claimed: ${claimed}, ⏭ Skipped: ${skipped}`);
        console.log("Claim Token Result:", data);
      } else {
        alert(`❌ Claim failed: ${data.error || "Unknown error"}`);
        console.error("Claim Token Error:", data);
      }
    } catch (error) {
      console.error("Fetch claim failed:", error);
      alert("❌ Failed to claim tokens. Please try again.");
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
        if (accounts.length > 0) {
          const addr = accounts[0];
          setAccount(addr);
          setBlockieSrc(makeBlockie(addr));
        } else {
          setAccount(null);
          setBlockieSrc("");
          console.log("Wallet disconnected");
        }
      });
    }
  }, []);

  const toggleOverlay = () => {
    if (showOverlay) setSelectedAsset(null);
    setShowOverlay(!showOverlay);
  };

  const handleAssetSelection = (asset) => setSelectedAsset(asset);

  const tokenAddressMap = {
    WETH: "0xa44554B8Ab5f4fB56FF71fF8c687b4D2962E1A23",
    WBTC: "0x6b68bBdD0aC6a46f20a2995C94eEF3686304396a",
    USDC: "0x8D657ce9F729dcCDB87f51df99Cc9ba6e004bF44",
    DAI: "0xB21C9aee8303c2923BFa169E771557832A651e2E",
    GHO: "0x1D807ef9107575B24ad7970454121d2e0A5259f1",
  };

  const confirmLiquidatorSetup = async () => {
    if (!account) return alert("Please connect your wallet first.");
    if (!selectedAsset) return alert("Please select an asset to proceed.");

    const tokenAddress = tokenAddressMap[selectedAsset];
    if (!tokenAddress) return alert("Invalid asset selection.");

    const payload = {
      liquidator: account,
      repayToken: tokenAddress,
    };

    try {
      const response = await fetch("http://localhost:3001/api/setup-liquidator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (response.ok) {
        alert("✅ Liquidator setup successful!");
        setShowOverlay(false);
      } else {
        alert(`❌ Error: ${result.error || "Unknown"}`);
      }
    } catch (error) {
      alert("❌ Failed to set up liquidator. Please try again.");
      console.error(error);
    }
  };

  return (
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

        <li className="account-title">Account Page</li>

        <li className="liquidator-box">
          <button onClick={toggleOverlay} className="liquidator-btn">
            <img src={liquidatorIcon} alt="Liquidator" style={{ width: "24px", height: "24px", marginRight: "10px" }} />
            Become a liquidator
          </button>
        </li>

        <li className="metamask-box">
          {account ? (
            <div className="wallet-display">
              <img className="wallet-icon" src={walletIcon2} alt="wallet icon" style={{ marginRight: "10px" }} />
              <span className="wallet-address">
                {account.slice(0, 6)}...{account.slice(-4)}
              </span>
            </div>
          ) : (
            <button onClick={connectWallet} className="metamask-connect-btn">
              <img src={walletIcon2} alt="Wallet Icon" style={{ width: "20px", height: "20px", marginRight: "10px" }} />
              Connect Wallet
            </button>
          )}
        </li>
      </ul>

      {showOverlay && (
        <div className="overlay">
          <div className="overlay-content">
            <button className="close-button" onClick={toggleOverlay}>×</button>
            <h2 className="overlay-title">Please select your repay asset</h2>
            {["WETH", "WBTC", "USDC", "DAI", "GHO"].map((asset) => (
              <div
                key={asset}
                className={`asset-button ${selectedAsset === asset ? "selected" : ""}`}
                onClick={() => handleAssetSelection(asset)}
              >
                <img src={{ WETH, WBTC, USDC, DAI, GHO }[asset]} alt={`${asset} Icon`} className="asset-icon" />
                <span className="asset-name">{asset}</span>
              </div>
            ))}
            <button className="confirm-btn" onClick={confirmLiquidatorSetup}>Confirm</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sidebar;
