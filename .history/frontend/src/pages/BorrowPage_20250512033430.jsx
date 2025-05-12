import React, { useState, useEffect } from 'react';
import '../styles/BorrowPage.css';
import { useNavigate } from 'react-router-dom';
import heartIcon from '../pictures/heart.png';
import wethIcon from '../pictures/weth.png';
import wbtcIcon from '../pictures/wbtc.png';
import usdcIcon from '../pictures/usdc.png';
import daiIcon from '../pictures/dai.png';
import ghoIcon from '../pictures/gho.svg';
import BorrowConfirmPage from './BorrowConfirmPage';

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

const BorrowPage = ({ onClose, tokenName, apy }) => {
  const [amount, setAmount] = useState(10);
  const [hasError, setHasError] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [maxBorrow, setMaxBorrow] = useState(0);
  const [healthFactor, setHealthFactor] = useState('-');
  const [account, setAccount] = useState(null);
  const navigate = useNavigate();

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
    const fetchMaxBorrow = async () => {
      if (!account || !tokenName) return;
      const assetAddress = tokenAddresses[tokenName];
      try {
        const res = await fetch(`http://localhost:3001/api/MaxBorrow?userAddress=${account}&assetAddress=${assetAddress}`);
        const data = await res.json();
        if (data.maxBorrow) {
          setMaxBorrow(parseFloat(data.maxBorrow));
        }
      } catch (err) {
        console.error('Failed to fetch max borrow:', err);
      }
    };
    fetchMaxBorrow();
  }, [account, tokenName]);

  useEffect(() => {
    const fetchHealthFactor = async () => {
      if (!account || !tokenName || amount <= 0) return;
      const assetAddress = tokenAddresses[tokenName];
      try {
        const res = await fetch(`http://localhost:3001/api/previewhealthfactorborrow?userAddress=${account}&assetAddress=${assetAddress}&borrowAmount=${amount}`);
        const data = await res.json();
        if (data.healthFactor) {
          setHealthFactor(parseFloat(data.healthFactor).toFixed(2));
        }
      } catch (err) {
        console.error('Failed to fetch health factor:', err);
      }
    };
    fetchHealthFactor();
  }, [account, tokenName, amount]);

  const handleBorrowClick = () => {
    if (amount <= 0 || amount > maxBorrow) {
      setHasError(true);
    } else {
      setHasError(false);
      setShowConfirm(true);
    }
  };

  const handleCloseConfirm = () => {
    setShowConfirm(false);
    onClose();
  };

  return (
    <div className="borrowpage-overlay">
      <div className="borrowpage-content">
        {showConfirm ? (
          <BorrowConfirmPage
            onClose={handleCloseConfirm}
            tokenName={tokenName}
            amount={amount}
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
                    setAmount(Number(e.target.value));
                    setHasError(false);
                  }}
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
                Available {maxBorrow.toFixed(4)} <strong>Max</strong>
              </div>
            </div>

            <h4 className="overview-title">Transaction Overview</h4>
            <div className="overview-box">
              <div className="row" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
                <span>Health factor</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {healthFactor}
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
                {hasError ? 'Exceed Max Availability' : `Borrow ${tokenName}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default BorrowPage;
