import React, { useEffect, useState } from "react";
import "../styles/ViewTransactionPage.css";
import Header from "../components/Header";

import wethIcon from "../pictures/weth.png";
import wbtcIcon from "../pictures/wbtc.png";
import usdcIcon from "../pictures/usdc.png";
import daiIcon from "../pictures/dai.png";
import ghoIcon from "../pictures/gho.svg";

const tokenSymbols = {
  WETH: wethIcon,
  WBTC: wbtcIcon,
  USDC: usdcIcon,
  DAI: daiIcon,
  GHO: ghoIcon,
};

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
  const [tokenMetadata, setTokenMetadata] = useState({});

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
    const fetchMetadata = async () => {
      try {
        const response = await fetch("http://localhost:3001/api/token-metadata");
        const data = await response.json();

        const parsedMetadata = {};
        for (const token of data) {
          const symbol = token.symbol.toUpperCase();
          parsedMetadata[token.address.toLowerCase()] = {
            symbol,
            icon: tokenSymbols[symbol] || null,
          };
        }
        setTokenMetadata(parsedMetadata);
      } catch (err) {
        console.error("Failed to fetch token metadata:", err);
      }
    };
    fetchMetadata();
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
      result = result.filter(
        (tx) => tokenMetadata[tx.token?.toLowerCase()]?.symbol.toLowerCase() === token.toLowerCase()
      );
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
                {Object.values(tokenMetadata).map((meta, idx) => (
                  <option key={idx} value={meta.symbol}>{meta.symbol}</option>
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
                const meta = tokenMetadata[tx.token?.toLowerCase()];
                const symbol = meta?.symbol || tx.token.slice(0, 6) + "...";
                const icon = meta?.icon;
                return (
                  <tr key={index}>
                    <td style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      {icon ? (
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
                      ) : (
                        <span style={{ width: "20px" }}>[?]</span>
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
