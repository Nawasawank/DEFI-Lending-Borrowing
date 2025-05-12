import React, { useState, useEffect } from 'react';
import '../styles/DisplayIcons.css';

const DisplayIcons = ({ onViewTransactionClick, userAddress }) => {
  const [netWorth, setNetWorth] = useState("0.00");
  const [netAPY, setNetAPY] = useState("0.00%");

  useEffect(() => {
    const fetchNetOverview = async () => {
      if (!userAddress) return;

      try {
        const response = await fetch(`http://localhost:3001/api/netOverview?userAddress=${userAddress}`);
        if (!response.ok) throw new Error("Failed to fetch data");

        const data = await response.json();
        setNetWorth(data.netWorthUSD || "0.00");
        setNetAPY(data.netAPY || "0.00%");
      } catch (error) {
        console.error("Failed to fetch net overview:", error);
        setNetWorth("0.00");
        setNetAPY("0.00%");
      }
    };

    fetchNetOverview();
  }, [userAddress]);

  return (
    <div className="icons-container">
      <div className="icon-group">
        <div className="icon-box">
          <span className="icon-label">Net Worth</span>
          <span className="icon-value">$ {netWorth}</span>
        </div>
        <div className="icon-box">
          <span className="icon-label">Net APY</span>
          <span className="icon-value">{netAPY}</span>
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
