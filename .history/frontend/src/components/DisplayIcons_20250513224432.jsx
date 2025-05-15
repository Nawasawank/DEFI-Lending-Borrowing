import React, { useState, useEffect } from 'react';
import '../styles/DisplayIcons.css';

const DisplayIcons = ({ onViewTransactionClick }) => {
  const [account, setAccount] = useState(null);
  const [netOverview, setNetOverview] = useState({
    netWorthUSD: '-',
    netAPY: '-',
    healthFactor: '-',
  });
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    const fetchStats = async () => {
      if (!account) return;
      try {
        const [netRes, healthRes] = await Promise.all([
          fetch(`http://localhost:3001/api/netOverview?userAddress=${account}`),
          fetch(`http://localhost:3001/api/health-factor?userAddress=${account}`),
        ]);

        const netData = await netRes.json();
        const healthData = await healthRes.json();

        setNetOverview({
          netWorthUSD: isFinite(netData.netWorthUSD) ? parseFloat(netData.netWorthUSD).toFixed(2) : '-',
          netAPY: isFinite(parseFloat(netData.netAPY)) ? parseFloat(netData.netAPY.replace('%', '')).toFixed(2) + '%' : '-',
          healthFactor: isFinite(healthData.healthFactor) ? parseFloat(healthData.healthFactor).toFixed(2) : '-',
        });
      } catch (err) {
        console.error("Failed to fetch net overview or health factor:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [account]);

  return (
    <div className="icons-container">
      <div className="icon-group">
        <div className="icon-box">
          <span className="icon-label">Net Worth</span>
          <span className="icon-value">
            {loading ? <div className="skeleton skeleton-text" style={{ width: '80px', height: '20px' }} /> : `$ ${netOverview.netWorthUSD}`}
          </span>
        </div>
        <div className="icon-box">
          <span className="icon-label">Net APY</span>
          <span className="icon-value">
            {loading ? <div className="skeleton skeleton-text" style={{ width: '60px', height: '20px' }} /> : netOverview.netAPY}
          </span>
        </div>
        <div className="icon-box">
          <span className="icon-label">Health factor</span>
          <span className="icon-value">
            {loading ? <div className="skeleton skeleton-text" style={{ width: '50px', height: '20px' }} /> : netOverview.healthFactor}
          </span>
        </div>
      </div>
      <button className="view-transaction-button" onClick={onViewTransactionClick}>
        View Transaction
      </button>
    </div>
  );
};

export default DisplayIcons;
