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

const tokenAddresses = {
  WETH: "0x9894E21263A476034b7080a46a455d7D138F5FeE",
  WBTC: "0xB3FF8Cffe71dF679b167A9316D5FAd2155204181",
  USDC: "0x9757838BEcc9E318D5e6D287097Fc3F2b8aAda10",
  DAI: "0x08e6338c405fcE3E65090cCbb6193B809BeD38f5",
  GHO: "0xd7bBf20510A379F1E496558dfF163e45CFb96f1b",
};

const SupplyPage = ({ onClose, tokenName, amount }) => {
  const [showConfirm, setShowConfirm] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isInsufficient, setIsInsufficient] = useState(false);
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
      setIsInsufficient(false);
      return;
    }

    try {
      const res = await fetch("http://localhost:3001/api/deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromAddress: account,
          assetAddress: tokenAddresses[tokenName],
          amount: inputAmount.toString()
        }),
      });

      const result = await res.json();

      if (result.sufficient) {
        setShowConfirm(true);
        setHasError(false);
        setIsInsufficient(false);
      } else {
        setHasError(true);
        setIsInsufficient(true);
      }
    } catch (err) {
      console.error("Deposit request failed:", err);
      setHasError(true);
      setIsInsufficient(true);
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
                  onChange={(e) => {
                    setInputAmount(Number(e.target.value));
                    setHasError(false);
                    setIsInsufficient(false);
                  }}
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
                className={`supply-button ${hasError ? "error shake" : ""} ${isInsufficient ? "insufficient-button" : ""}`}
                onClick={handleSupplyClick}
              >
                {isInsufficient ? "Insufficient Token" : `Supply ${tokenName}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SupplyPage;
