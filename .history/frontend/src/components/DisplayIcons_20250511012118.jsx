import React, { useState, useEffect } from 'react';
import '../styles/DisplayIcons.css';

const DisplayIcons = ({ onViewTransactionClick }) => {
  const [account, setAccount] = useState(null);
  const [netOverview, setNetOverview] = useState({
    netWorthUSD: null,
    netAPY: null,
  });

  // Connect to MetaMask and get user address
  useEffect(() => {
    const getAccount = async () => {
      if (window.ethereum) {
        try {
          const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
          setAccount(accounts[0]);
        } catch (error) {
          console.error("MetaMask connection error:", error);
        }
      }
    };
    getAccount();
  }, []);

  // Fetch netOverview from backend when account is available
  useEffect(() => {
    const fetchNetOverview = async () => {
      if (!account) return;
      try {
        const response = await fetch(`http://localhost:3001/api/netOverview?userAddress=${account}`);
        const data = await response.json();
        setNetOverview({
          netWorthUSD: data.netWorthUSD,
          netAPY: data.netAPY,
        });
      } catch (err) {
        console.error("Failed to fetch net overview:", err);
      }
    };

    fetchNetOverview();
  }, [account]);

  return (
    <div className="icons-container">
      <div className="icon-group">
        <div className="icon-box">
          <span className="icon-label">Net Worth</span>
          <span className="icon-value">$ {netOverview.netWorthUSD ?? '-'}</span>
        </div>
        <div className="icon-box">
          <span className="icon-label">Net APY</span>
          <span className="icon-value">{netOverview.netAPY ?? '-'}</span>
        </div>
        <div className="icon-box">
          <span className="icon-label">Health factor</span>
          <span className="icon-value">-</span>
        </div>
      </div>
      <button className="view-transaction-button" onClick={onViewTransactionClick}>
        View Transaction
      </button>
    </div>
  );
};

export default DisplayIcons;
