import React, { useState, useEffect } from 'react';
import '../styles/RepayPage.css';
import RepayConfirmPage from './RepayConfirmPage';

import wethIcon from '../pictures/weth.png';
import wbtcIcon from '../pictures/wbtc.png';
import usdcIcon from '../pictures/usdc.png';
import daiIcon from '../pictures/dai.png';
import ghoIcon from '../pictures/gho.svg';

const tokenIcons = {
  WETH: wethIcon,
  WBTC: wbtcIcon,
  USDC: usdcIcon,
  DAI: daiIcon,
  GHO: ghoIcon,
};

const tokenMap = JSON.parse(process.env.REACT_APP_TOKEN_SYMBOL_MAP || '{}');

const safeToFixed = (value, digits = 2, fallback = '-') => {
  const num = parseFloat(value);
  return isNaN(num) ? fallback : num.toFixed(digits);
};

const RepayPage = ({ onClose, tokenName = 'USDC', debt = 0.011 }) => {
  const [amount, setAmount] = useState(() => debt?.toString() || '');
  const [showConfirm, setShowConfirm] = useState(false);
  const [healthStart, setHealthStart] = useState('-');
  const [healthEnd, setHealthEnd] = useState('-');
  const [remainingDebt, setRemainingDebt] = useState('-');
  const [account, setAccount] = useState(localStorage.getItem("account") || null);
  const [walletBalance, setWalletBalance] = useState(0);
  const [hasError, setHasError] = useState(false);
  const [loading, setLoading] = useState(true);

  const tokenAddresses = Object.keys(tokenMap).reduce((acc, address) => {
    const symbol = tokenMap[address];
    acc[symbol] = address;
    return acc;
  }, {});

  useEffect(() => {
    if (window.ethereum) {
      window.ethereum.on("accountsChanged", (accounts) => {
        if (accounts.length > 0) {
          const addr = accounts[0];
          setAccount(addr);
          localStorage.setItem("account", addr);
          window.location.reload();
        } else {
          setAccount(null);
          localStorage.removeItem("account");
        }
      });
    }
  }, []);

  useEffect(() => {
    const fetchAll = async () => {
      const parsedAmount = parseFloat(amount);
      if (!account || !tokenName || isNaN(parsedAmount)) return;
      setLoading(true);
      const assetAddress = tokenAddresses[tokenName];
      try {
        const [balanceRes, healthRes, previewHealthRes, previewDebtRes] = await Promise.all([
          fetch(`http://localhost:3001/api/wallet-balance?userAddress=${account}`),
          fetch(`http://localhost:3001/api/health-factor?userAddress=${account}`),
          fetch(`http://localhost:3001/api/previewhealthfactorrepay?userAddress=${account}&assetAddress=${assetAddress}&repayAmount=${parsedAmount}`),
          fetch(`http://localhost:3001/api/previewRemaingDebt?userAddress=${account}&assetAddress=${assetAddress}&repayAmount=${parsedAmount}`)
        ]);

        const balanceData = await balanceRes.json();
        const match = balanceData.balances.find((item) => item.symbol.toUpperCase() === tokenName.toUpperCase());
        if (match) setWalletBalance(parseFloat(match.balance));

        const healthData = await healthRes.json();
        setHealthStart(safeToFixed(healthData.healthFactor));

        const previewHealthData = await previewHealthRes.json();
        setHealthEnd(safeToFixed(previewHealthData.healthFactor));

        const previewDebtData = await previewDebtRes.json();
        setRemainingDebt(safeToFixed(previewDebtData.remainingDebt, 6));
      } catch (err) {
        console.error('Failed to fetch repay page data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [account, tokenName, amount]);

  const handleRepayClick = async () => {
    const parsedAmount = parseFloat(amount);
    if (
      isNaN(parsedAmount) ||
      parsedAmount <= 0 ||
      parsedAmount > parseFloat(remainingDebt) ||
      parsedAmount > walletBalance
    ) {
      setHasError(true);
      setTimeout(() => setHasError(false), 1200);
      return;
    }

    try {
      const assetAddress = tokenAddresses[tokenName];
      const res = await fetch("http://localhost:3001/api/repay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromAddress: account,
          assetAddress,
          amount: parsedAmount,
        }),
      });

      const result = await res.json();
      if (res.ok && result.message === "Repayment successful") {
        setShowConfirm(true);
      } else {
        alert("Repayment failed: " + (result.error || "Unknown error"));
      }
    } catch (err) {
      console.error("Repayment request failed:", err);
      alert("Unexpected error occurred while repaying");
    }
  };

  const handleCloseAll = () => {
    setShowConfirm(false);
    onClose();
    window.location.reload();
  };

  return (
    <div className="repaypage-overlay">
      <div className="repaypage-content">
        <button className="close-button" onClick={onClose}>×</button>

        {showConfirm ? (
          <RepayConfirmPage onClose={handleCloseAll} tokenName={tokenName} amount={amount} />
        ) : (
          <>
            <h2 className="modal-title">Repay {tokenName}</h2>

            <div className="input-section">
              <label>Repay with</label>
              <div className="input-box" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  style={{ flex: 1, marginRight: '10px' }}
                />
                <div className="token-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="token-name">{tokenName}</span>
                  <img
                    src={tokenIcons[tokenName]}
                    alt={tokenName}
                    className="token-icon"
                    style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: 'white' }}
                  />
                </div>
              </div>
            </div>

            <h4 className="overview-title">Transaction Overview</h4>
            <div className="overview-box">
              {loading ? (
                <>
                  <div className="row">
                    <span>Remaining debt</span>
                    <div className="skeleton shimmer" style={{ width: '140px', height: '16px' }}></div>
                  </div>
                  <div className="row">
                    <span>Health factor</span>
                    <div className="skeleton shimmer" style={{ width: '100px', height: '16px' }}></div>
                  </div>
                </>
              ) : (
                <>
                  <div className="row">
                    <span>Remaining debt</span>
                    <span>{debt} {tokenName} → {remainingDebt} {tokenName}</span>
                  </div>
                  <div className="row">
                    <span>Health factor</span>
                    <span className="health-green">{healthStart} → {healthEnd}</span>
                  </div>
                </>
              )}
            </div>

            <div className="sbutton-container">
              <button
                className={`repay-button ${hasError ? 'error shake' : ''}`}
                onClick={handleRepayClick}
              >
                {hasError ? 'Repay Error' : `Approve ${tokenName} to continue`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default RepayPage;
