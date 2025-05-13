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

const RepayPage = ({ onClose, tokenName = 'USDC', debt = 0.011 }) => {
  const [amount, setAmount] = useState(debt);
  const [showConfirm, setShowConfirm] = useState(false);
  const [healthStart, setHealthStart] = useState('-');
  const [healthEnd, setHealthEnd] = useState('-');
  const [remainingDebt, setRemainingDebt] = useState('-');
  const [account, setAccount] = useState(null);
  const [walletBalance, setWalletBalance] = useState(0);
  const [hasError, setHasError] = useState(false);

  const tokenAddresses = Object.keys(tokenMap).reduce((acc, address) => {
    const symbol = tokenMap[address];
    acc[symbol] = address;
    return acc;
  }, {});

  useEffect(() => {
    const getAccount = async () => {
      if (window.ethereum) {
        try {
          const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
          setAccount(accounts[0]);
        } catch (error) {
          console.error('MetaMask error:', error);
        }
      }
    };
    getAccount();
  }, []);

  useEffect(() => {
    const fetchWalletBalance = async () => {
      if (!account || !tokenName) return;
      try {
        const res = await fetch(`http://localhost:3001/api/wallet-balance?userAddress=${account}`);
        const data = await res.json();
        const match = data.balances.find(
          (item) => item.symbol.toUpperCase() === tokenName.toUpperCase()
        );
        if (match) {
          setWalletBalance(parseFloat(match.balance));
        }
      } catch (err) {
        console.error('Failed to fetch wallet balance:', err);
      }
    };
    fetchWalletBalance();
  }, [account, tokenName]);

  useEffect(() => {
    const fetchHealthFactor = async () => {
      if (!account) return;
      try {
        const res = await fetch(`http://localhost:3001/api/health-factor?userAddress=${account}`);
        const data = await res.json();
        if (data.healthFactor) {
          setHealthStart(parseFloat(data.healthFactor).toFixed(2));
        }
      } catch (err) {
        console.error('Failed to fetch current health factor:', err);
      }
    };
    fetchHealthFactor();
  }, [account]);

  useEffect(() => {
    const fetchPreviewHealthFactor = async () => {
      if (!account || !tokenName || amount <= 0) return;
      const assetAddress = tokenAddresses[tokenName];
      try {
        const res = await fetch(`http://localhost:3001/api/previewhealthfactorrepay?userAddress=${account}&assetAddress=${assetAddress}&repayAmount=${amount}`);
        const data = await res.json();
        if (data.healthFactor) {
          setHealthEnd(parseFloat(data.healthFactor).toFixed(2));
        }
      } catch (err) {
        console.error('Failed to fetch health factor after repay:', err);
      }
    };
    fetchPreviewHealthFactor();
  }, [account, tokenName, amount]);

  useEffect(() => {
    const fetchRemainingDebt = async () => {
      if (!account || !tokenName || amount <= 0) return;
      const assetAddress = tokenAddresses[tokenName];
      try {
        const res = await fetch(`http://localhost:3001/api/previewRemaingDebt?userAddress=${account}&assetAddress=${assetAddress}&repayAmount=${amount}`);
        const data = await res.json();
        if (data.remainingDebt) {
          setRemainingDebt(parseFloat(data.remainingDebt).toFixed(6));
        }
      } catch (err) {
        console.error('Failed to fetch remaining debt:', err);
      }
    };
    fetchRemainingDebt();
  }, [account, tokenName, amount]);

  const handleRepayClick = async () => {
    if (amount <= 0 || amount > debt || amount > walletBalance) {
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
          amount,
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
          <RepayConfirmPage
            onClose={handleCloseAll}
            tokenName={tokenName}
            amount={amount}
          />
        ) : (
          <>
            <h2 className="modal-title">Repay {tokenName}</h2>

            <div className="input-section">
              <label>Repay with</label>
              <div className="input-box" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
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
              <div className="row">
                <span>Remaining debt</span>
                <span>{debt} {tokenName} → {remainingDebt} {tokenName}</span>
              </div>
              <div className="row">
                <span>Health factor</span>
                <span className="health-green">{healthStart} → {healthEnd}</span>
              </div>
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
