import React, { useEffect, useState } from 'react';
import '../styles/BorrowPage.css';
import { useNavigate } from 'react-router-dom';
import heartIcon from '../pictures/heart.png';
import wethIcon from '../pictures/weth.png';
import wbtcIcon from '../pictures/wbtc.png';
import usdcIcon from '../pictures/usdc.png';
import daiIcon from '../pictures/dai.png';
import ghoIcon from '../pictures/gho.svg';
import BorrowConfirmPage from '../pages/BorrowConfirmPage';

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

const BorrowPage = ({ onClose, tokenName, apy }) => {
  const [amount, setAmount] = useState("10");
  const [hasError, setHasError] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [maxBorrow, setMaxBorrow] = useState(null);
  const [healthFactor, setHealthFactor] = useState(null);
  const [account, setAccount] = useState(localStorage.getItem("account") || null);
  const [transactionHash, setTransactionHash] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (window.ethereum) {
      window.ethereum.on("accountsChanged", (accounts) => {
        if (accounts.length > 0) {
          const addr = accounts[0];
          localStorage.setItem("account", addr);
          setAccount(addr);
          window.location.reload();
        }
      });
    }
  }, []);

  useEffect(() => {
    const fetchMaxBorrow = async () => {
      if (!account || !tokenName) return;
      const assetAddress = tokenAddresses[tokenName];
      try {
        const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/MaxBorrow?userAddress=${account}&assetAddress=${assetAddress}`);
        const data = await res.json();
        if (!isNaN(data.maxBorrow)) {
          setMaxBorrow(parseFloat(data.maxBorrow));
        } else {
          setMaxBorrow(0);
        }
      } catch (err) {
        console.error('Failed to fetch max borrow:', err);
        setMaxBorrow(0);
      } finally {
        setLoading(false);
      }
    };
    fetchMaxBorrow();
  }, [account, tokenName]);

  useEffect(() => {
    const fetchHealthFactor = async () => {
      const numericAmount = parseFloat(amount);
      if (!account || !tokenName || numericAmount <= 0) return;
      const assetAddress = tokenAddresses[tokenName];
      try {
        const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/previewhealthfactorborrow?userAddress=${account}&assetAddress=${assetAddress}&borrowAmount=${numericAmount}`);
        const data = await res.json();
        if (!isNaN(data.healthFactor)) {
          setHealthFactor(parseFloat(data.healthFactor).toFixed(2));
        } else {
          setHealthFactor("-");
        }
      } catch (err) {
        console.error('Failed to fetch health factor:', err);
        setHealthFactor("-");
      }
    };
    fetchHealthFactor();
  }, [account, tokenName, amount]);

  const handleBorrowClick = async () => {
    const numericAmount = parseFloat(amount);
    if (numericAmount <= 0 || numericAmount > maxBorrow || isNaN(numericAmount)) {
      setHasError(true);
      return;
    }

    const assetAddress = tokenAddresses[tokenName];
    try {
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/borrow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromAddress: account,
          assetAddress,
          amount: numericAmount.toString(),
        }),
      });
      const result = await res.json();

      if (result.message === "Borrow successful") {
        setTransactionHash(result.transactionHash);
        setShowConfirm(true);
        setHasError(false);
      } else {
        setHasError(true);
      }
    } catch (err) {
      console.error("Borrow request failed:", err);
      setHasError(true);
    }
  };

  const handleCloseConfirm = () => {
    setShowConfirm(false);
    onClose();
    window.location.reload();
  };

  return (
    <div className="borrowpage-overlay">
      <div className="borrowpage-content">
        {showConfirm ? (
          <BorrowConfirmPage
            onClose={handleCloseConfirm}
            tokenName={tokenName}
            amount={amount}
            txHash={transactionHash}
          />
        ) : (
          <>
            <button className="close-button" onClick={onClose}>×</button>
            <h2 className="modal-title">Borrow {tokenName}</h2>

            <div className="input-section">
              <label>Amount</label>
              <div className="input-box" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    setHasError(false);
                  }}
                  step="any"
                  style={{ flex: 1, marginRight: '10px' }}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="token-name">{tokenName}</span>
                  <img
                    src={tokenIcons[tokenName]}
                    alt={tokenName}
                    style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: 'white' }}
                  />
                </div>
              </div>
              <div className="max-text">
                Available {loading || maxBorrow === null ? (
                  <div className="skeleton skeleton-text" style={{ width: '100px' }} />
                ) : (
                  maxBorrow.toFixed(4)
                )} <strong>Max</strong>
              </div>
            </div>

            <h4 className="overview-title">Transaction Overview</h4>
            <div className="overview-box">
              <div className="row" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
                <span>Health factor</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {healthFactor !== null ? healthFactor : <div className="skeleton skeleton-text" style={{ width: '40px', height: '18px' }} />} 
                  <img
                    src={heartIcon}
                    alt="heart"
                    style={{ width: '16px', verticalAlign: 'middle' }}
                  />
                </span>
              </div>
              <div className="row">
                <span></span>
                <span className="enable-text">Liquidation at &lt;1.0</span>
              </div>
            </div>

            <div className="sbutton-container">
              <button
                className={`borrowpa-button ${hasError ? 'error shake' : ''}`}
                onClick={handleBorrowClick}
              >
                {hasError ? 'Borrow Failed' : `Borrow ${tokenName}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default BorrowPage;
