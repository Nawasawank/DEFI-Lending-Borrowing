import React, { useState, useEffect } from "react";
import "../styles/SupplyPage.css";
import SupplyConfirmPage from "./SupplyConfirmPage";
import { useNavigate } from "react-router-dom";

import wethIcon from "../pictures/weth.png";
import wbtcIcon from "../pictures/wbtc.png";
import usdcIcon from "../pictures/usdc.png";
import daiIcon from "../pictures/dai.png";
import ghoIcon from "../pictures/gho.svg";

const tokenIcons = {
  WETH: wethIcon,
  WBTC: wbtcIcon,
  USDC: usdcIcon,
  DAI: daiIcon,
  GHO: ghoIcon,
};

const SupplyPage = ({ onClose, tokenName, amount }) => {
  const [showConfirm, setShowConfirm] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [inputAmount, setInputAmount] = useState(amount);
  const [apy, setApy] = useState("-");
  const [account, setAccount] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const getAccount = async () => {
      if (window.ethereum) {
        try {
          const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
          setAccount(accounts[0]);
        } catch (error) {
          console.error("MetaMask error:", error);
        }
      }
    };
    getAccount();
  }, []);

  useEffect(() => {
    const fetchApy = async () => {
      if (!account || !tokenName) return;
      try {
        const res = await fetch(`http://localhost:3001/api/getAssetOverview?userAddress=${account}`);
        const data = await res.json();
        const matched = data.assets.find(asset => asset.symbol === tokenName);
        if (matched) {
          setApy(matched.apy.replace("%", ""));
        }
      } catch (err) {
        console.error("Failed to fetch APY:", err);
      }
    };
    fetchApy();
  }, [account, tokenName]);

  const handleSupplyClick = async () => {
    if (inputAmount <= 0) {
      setHasError(true);
      return;
    }

    try {
      const res = await fetch("http://localhost:3001/api/deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userAddress: account,
          amount: inputAmount,
          tokenSymbol: tokenName,
        }),
      });

      const result = await res.json();

      if (result.sufficient) {
        setShowConfirm(true);
        setHasError(false);
      } else {
        setHasError(true);
      }
    } catch (err) {
      console.error("Deposit request failed:", err);
      setHasError(true);
    }
  };

  const handleCloseToDashboard = () => {
    onClose();
  };

  return (
    <div className="supplypage-overlay">
      <div className="supplypage-content">
        {showConfirm ? (
          <SupplyConfirmPage
            onClose={handleCloseToDashboard}
            tokenName={tokenName}
            amount={inputAmount}
          />
        ) : (
          <>
            <button className="close-button" onClick={onClose}>×</button>
            <h2 className="modal-title">Supply {tokenName}</h2>

            <div className="input-section">
              <label>Amount</label>
              <div className="input-box" style={{ justifyContent: "space-between", alignItems: "center" }}>
                <input
                  type="number"
                  value={inputAmount}
                  onChange={(e) => setInputAmount(Number(e.target.value))}
                  style={{ flex: 1, marginRight: "10px" }}
                />
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span className="token-name">{tokenName}</span>
                  <img
                    src={tokenIcons[tokenName]}
                    alt={tokenName}
                    style={{ width: "24px", height: "24px", borderRadius: "50%", backgroundColor: "white" }}
                  />
                </div>
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

            <div className="sbutton-container">
              <button
                className={`supply-button ${hasError ? "error shake" : ""}`}
                onClick={handleSupplyClick}
              >
                Supply {tokenName}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SupplyPage;
