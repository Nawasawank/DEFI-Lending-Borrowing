import React, { useEffect, useState } from "react";
import "../styles/ViewTransactionPage.css";
import Header from "../components/Header";

import wethIcon from "../pictures/weth.png";
import wbtcIcon from "../pictures/wbtc.png";
import usdcIcon from "../pictures/usdc.png";
import daiIcon from "../pictures/dai.png";
import ghoIcon from "../pictures/gho.svg";

const tokenIcons = {
  WETH: wethIcon,
  WBTC: wbtcIcon,
  USDC: usdcIcon,
  DAI: daiIcon,
  GHO: ghoIcon,
};

// Load and normalize token map from .env
let rawMap = process.env.REACT_APP_TOKEN_SYMBOL_MAP || "{}";
let tokenMap = {};
try {
  const parsed = JSON.parse(rawMap);
  for (const [address, symbol] of Object.entries(parsed)) {
    tokenMap[address.toLowerCase()] = symbol;
  }
} catch (err) {
  console.error("Failed to parse REACT_APP_TOKEN_SYMBOL_MAP:", err);
}

const ViewTransaction = () => {
  const [history, setHistory] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [filters, setFilters] = useState({
    type: "",
    token: "",
    amount: "",
    date: "",
  });
  const [account, setAccount] = useState(null);

  useEffect(() => {
    const getAccount = async () => {
      if (window.ethereum) {
        try {
          const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
          setAccount(accounts[0]);
        } catch (error) {
          console.error("MetaMask error:", error);
        }
      }
    };
    getAccount();
  }, []);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!account) return;
      try {
        const response = await fetch(`http://localhost:3001/api/history?userAddress=${account}`);
        const result = await response.json();
        const historyData = result.history || [];
        setHistory(historyData);
        setFiltered(historyData);
      } catch (error) {
        console.error("Error fetching history:", error);
      }
    };
    fetchHistory();
  }, [account]);

  const formatDate = (timestamp) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString();
  };

  const handleFilterChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  const applyFilters = () => {
    let result = [...history];
    const { type, token, amount, date } = filters;

    if (type) result = result.filter((tx) => tx.type === type);
    if (token)
      result = result.filter((tx) => {
        const symbol = tokenMap[tx.token?.toLowerCase()];
        return symbol?.toLowerCase() === token.toLowerCase();
      });
    if (amount)
      result = result.filter((tx) => Number(tx.amount) >= Number(amount));
    if (date) {
      const timestamp = new Date(date).getTime() / 1000;
      result = result.filter((tx) => tx.timestamp >= timestamp);
    }

    setFiltered(result);
  };

  return (
    <div className="view-container">
      <div className="view-main">
        <Header />

        <div className="transaction-content">
          <div className="transaction-filters">
            <div className="filters-row">
              <select
                name="type"
                value={filters.type}
                onChange={handleFilterChange}
                className="filter-select"
              >
                <option value="">All Types</option>
                <option value="Deposit">Deposit</option>
                <option value="Withdraw">Withdraw</option>
                <option value="Borrow">Borrow</option>
                <option value="Repay">Repay</option>
              </select>

              <select
                name="token"
                value={filters.token}
                onChange={handleFilterChange}
                className="filter-select"
              >
                <option value="">All Tokens</option>
                {Array.from(new Set(Object.values(tokenMap))).map((symbol) => (
                  <option key={symbol} value={symbol}>
                    {symbol}
                  </option>
                ))}
              </select>

              <input
                type="number"
                name="amount"
                placeholder="Amount"
                value={filters.amount}
                onChange={handleFilterChange}
                className="filter-input"
              />

              <input
                type="date"
                name="date"
                value={filters.date}
                onChange={handleFilterChange}
                className="filter-input"
              />

              <button onClick={applyFilters} className="filter-button">
                Apply
              </button>
            </div>
          </div>

          <table className="tx-table">
            <thead className="tx-table-header">
              <tr>
                <th>Asset</th>
                <th>Transaction Type</th>
                <th>Amount</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody className="tx-table-body">
              {filtered.map((tx, index) => {
                const lowerAddress = tx.token?.toLowerCase();
                const symbol = tokenMap[lowerAddress] || lowerAddress?.slice(0, 6) + "...";
                const icon = tokenIcons[symbol];

                return (
                  <tr key={index}>
                    <td style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      {icon && (
                        <img
                          src={icon}
                          alt={symbol}
                          style={{
                            width: "20px",
                            height: "20px",
                            borderRadius: "50%",
                            backgroundColor: "white",
                          }}
                        />
                      )}
                      {symbol}
                    </td>
                    <td>{tx.type}</td>
                    <td>{tx.amount}</td>
                    <td>{formatDate(tx.timestamp)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ViewTransaction;
