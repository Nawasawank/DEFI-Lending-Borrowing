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
  WETH: process.env.REACT_APP_WETH_ADDRESS,
  WBTC: process.env.REACT_APP_WBTC_ADDRESS,
  USDC: process.env.REACT_APP_USDC_ADDRESS,
  DAI: process.env.REACT_APP_DAI_ADDRESS,
  GHO: process.env.REACT_APP_GHO_ADDRESS,
};

const SupplyPage = ({ onClose, tokenName, amount }) => {
  const [showConfirm, setShowConfirm] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isInsufficient, setIsInsufficient] = useState(false);
  const [inputAmount, setInputAmount] = useState(amount);
  const [apy, setApy] = useState("-");
  const [account, setAccount] = useState(null);
  const [walletBalance, setWalletBalance] = useState(0);
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
        const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/getAssetOverview?userAddress=${account}`);
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

  useEffect(() => {
    const fetchWalletBalance = async () => {
      if (!account || !tokenName) return;
      try {
        const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/wallet-balance?userAddress=${account}`);
        const data = await res.json();
        const match = data.balances.find(item => item.symbol.toUpperCase() === tokenName.toUpperCase());
        if (match) {
          setWalletBalance(parseFloat(match.balance));
        }
      } catch (err) {
        console.error("Failed to fetch wallet balance:", err);
      }
    };
    fetchWalletBalance();
  }, [account, tokenName]);

  const handleSupplyClick = async () => {
    if (inputAmount <= 0 || inputAmount > walletBalance) {
      setHasError(true);
      setIsInsufficient(inputAmount > walletBalance);
      return;
    }

    try {
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/deposit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromAddress: account,
          assetAddress: tokenAddresses[tokenName],
          amount: inputAmount,
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
    window.location.reload();
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
                  max={walletBalance}
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
              <div className="max-text">
                Wallet Balance: {walletBalance.toFixed(4)} {tokenName}
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
                {hasError
                  ? "Supply Failed"
                  : isInsufficient
                  ? "Insufficient Token"
                  : `Supply ${tokenName}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SupplyPage;
