import React, { useState, useEffect } from 'react';
import '../styles/WithdrawPage.css';
import WithdrawConfirmPage from './WithdrawConfirmPage';

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

const tokenAddresses = {
  WETH: process.env.REACT_APP_WETH_ADDRESS,
  WBTC: process.env.REACT_APP_WBTC_ADDRESS,
  USDC: process.env.REACT_APP_USDC_ADDRESS,
  DAI: process.env.REACT_APP_DAI_ADDRESS,
  GHO: process.env.REACT_APP_GHO_ADDRESS,
};

const WithdrawPage = ({ onClose, tokenName = 'USDC' }) => {
  const [amount, setAmount] = useState(10);
  const [showConfirm, setShowConfirm] = useState(false);
  const [remainingSupply, setRemainingSupply] = useState(0);
  const [maxWithdraw, setMaxWithdraw] = useState(0);
  const [account, setAccount] = useState(null);
  const [hasError, setHasError] = useState(false);

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
    const fetchSupplies = async () => {
      if (!account || !tokenName) return;
      const assetAddress = tokenAddresses[tokenName];

      try {
        const resBalance = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/balance?userAddress=${account}&assetAddress=${assetAddress}`);
        const balanceData = await resBalance.json();
        if (balanceData.balance) {
          setRemainingSupply(parseFloat(balanceData.balance));
        }

        const resMax = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/MaxWithdraw?userAddress=${account}&assetAddress=${assetAddress}`);
        const maxData = await resMax.json();
        if (maxData.maxWithdraw) {
          setMaxWithdraw(parseFloat(maxData.maxWithdraw));
        }
      } catch (err) {
        console.error('Failed to fetch supply data:', err);
      }
    };
    fetchSupplies();
  }, [account, tokenName]);

const handleWithdraw = async () => {
  const assetAddress = tokenAddresses[tokenName];
  const parsedAmount = parseFloat(amount);

  if (parsedAmount > 0 && parsedAmount <= maxWithdraw) {
    try {
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/withdraw`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromAddress: account,
          assetAddress,
          amount: parsedAmount.toFixed(18), // ✅ Use this here
        }),
      });

      const result = await res.json();
      if (result.message === "Withdrawal successful") {
        setShowConfirm(true);
        setHasError(false);
      } else {
        setHasError(true);
      }
    } catch (err) {
      console.error("Withdrawal request failed:", err);
      setHasError(true);
    }
  } else {
    setHasError(true);
  }
};


  const handleCloseAll = () => {
    setShowConfirm(false);
    onClose();
    window.location.reload();
  };

  return (
    <div className="withdrawpage-overlay">
      <div className="withdrawpage-content">
        <button className="close-button" onClick={onClose}>×</button>

        {showConfirm ? (
          <WithdrawConfirmPage
            onClose={handleCloseAll}
            tokenName={tokenName}
            amount={amount}
          />
        ) : (
          <>
            <h2 className="modal-title">Withdraw {tokenName}</h2>

            <div className="input-section">
              <label>Amount</label>
              <div className="input-box">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => {
                    setAmount(Number(e.target.value));
                    setHasError(false);
                  }}
                  style={{ flex: 1, marginRight: '10px' }}
                />
                <div className="token-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="token-name">{tokenName}</span>
                  <img
                    src={tokenIcons[tokenName]}
                    alt={tokenName}
                    className="token-icon"
                  />
                </div>
              </div>
              <div className="max-text">
                Available {maxWithdraw.toFixed(18)} <strong>Max</strong>
              </div>
            </div>

            <h4 className="overview-title">Transaction Overview</h4>
            <div className="overview-box">
              <div className="row">
                <span>Remaining Supply</span>
                <span>
                  {Math.max(0, remainingSupply - amount).toFixed(2)} <strong>{tokenName}</strong>
                </span>
              </div>
            </div>

            <div className="sbutton-container">
              <button
                className={`withdraw-button ${hasError ? 'error shake' : ''}`}
                onClick={handleWithdraw}
              >
                {hasError ? 'Withdraw Error' : `Withdraw ${tokenName}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default WithdrawPage;
