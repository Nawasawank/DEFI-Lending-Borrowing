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
  WETH: "0x9894E21263A476034b7080a46a455d7D138F5FeE",
  WBTC: "0xB3FF8Cffe71dF679b167A9316D5FAd2155204181",
  USDC: "0x9757838BEcc9E318D5e6D287097Fc3F2b8aAda10",
  DAI: "0x08e6338c405fcE3E65090cCbb6193B809BeD38f5",
  GHO: "0xd7bBf20510A379F1E496558dfF163e45CFb96f1b",
};

const WithdrawPage = ({ onClose, tokenName = 'USDC' }) => {
  const [amount, setAmount] = useState(10);
  const [showConfirm, setShowConfirm] = useState(false);
  const [remainingSupply, setRemainingSupply] = useState(0);
  const [account, setAccount] = useState(null);

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
    const fetchRemainingSupply = async () => {
      if (!account || !tokenName) return;
      try {
        const assetAddress = tokenAddresses[tokenName];
        const res = await fetch(`http://localhost:3001/api/lender-collateral?userAddress=${account}&assetAddress=${assetAddress}`);
        const data = await res.json();
        if (data.balance) {
          setRemainingSupply(parseFloat(data.balance));
        }
      } catch (err) {
        console.error('Failed to fetch remaining supply:', err);
      }
    };
    fetchRemainingSupply();
  }, [account, tokenName]);

  const handleWithdraw = () => {
    if (amount > 0 && amount <= remainingSupply) {
      setShowConfirm(true);
    }
  };

  const handleCloseAll = () => {
    setShowConfirm(false);
    onClose(); // Close the full modal
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
                  onChange={(e) => setAmount(Number(e.target.value))}
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
                Available {remainingSupply.toFixed(4)} <strong>Max</strong>
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
              <button className="withdraw-button" onClick={handleWithdraw}>
                Withdraw {tokenName}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default WithdrawPage;
