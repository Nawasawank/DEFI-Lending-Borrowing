import React, { useState, useEffect } from 'react';
import '../styles/WithdrawPage.css';
import WithdrawConfirmPage from './WithdrawConfirmPage'; // ✅ Import confirmation component

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
  WETH: "0xC611eaBDE31670c1938BA6ec14fdfb5665a4800d",
  WBTC: "0x745457C397322630F481fC7b4D247c83eD58BbcE",
  USDC: "0x3D3504DBdd14342aF0156b6d801BA7A612d6114B",
  DAI: "0x9De5FC8264EC5698eE8fAbb1e8f589EAc675820b",
  GHO: "0x4593BD7Ea584b33c8691d0d141679785bb619B50",
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
        const resBalance = await fetch(`http://localhost:3001/api/balance?userAddress=${account}&assetAddress=${assetAddress}`);
        const balanceData = await resBalance.json();
        if (balanceData.balance) {
          setRemainingSupply(parseFloat(balanceData.balance));
        }

        const resMax = await fetch(`http://localhost:3001/api/MaxWithdraw?userAddress=${account}&assetAddress=${assetAddress}`);
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
    if (amount > 0 && amount <= maxWithdraw) {
      try {
        const res = await fetch("http://localhost:3001/api/withdraw", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fromAddress: account,
            assetAddress,
            amount,
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
    window.location.reload(); // ✅ Auto reload after withdraw
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
                Available {maxWithdraw.toFixed(4)} <strong>Max</strong>
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
