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

        const parsed = {};
        data.forEach(token => {
          parsed[token.address.toLowerCase()] = {
            symbol: token.symbol,
            icon: tokenSymbols[token.symbol.toUpperCase()] || null,
          };
        });
        setTokenMetadata(parsed);
      } catch (err) {
        console.error("Metadata fetch error:", err);
      }
    };
    fetchMetadata();
  }, []);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!account || Object.keys(tokenMetadata).length === 0) return;
      try {
        const res = await fetch(`http://localhost:3001/api/history?userAddress=${account}`);
        const json = await res.json();

        const enriched = (json.history || []).map(tx => {
          const meta = tokenMetadata[tx.token?.toLowerCase()] || {};
          return {
            ...tx,
            symbol: meta.symbol || tx.token,
            icon: meta.icon,
          };
        });

        setHistory(enriched);
        setFiltered(enriched);
      } catch (err) {
        console.error("History fetch error:", err);
      }
    };
    fetchHistory();
  }, [account, tokenMetadata]);

  const formatDate = ts => new Date(ts * 1000).toLocaleDateString();

  const handleFilterChange = e =>
    setFilters({ ...filters, [e.target.name]: e.target.value });

  const applyFilters = () => {
    let result = [...history];
    const { type, token, amount, date } = filters;

    if (type) result = result.filter(tx => tx.type === type);
    if (token) result = result.filter(tx => tx.symbol?.toLowerCase() === token.toLowerCase());
    if (amount) result = result.filter(tx => Number(tx.amount) >= Number(amount));
    if (date) {
      const ts = new Date(date).getTime() / 1000;
      result = result.filter(tx => tx.timestamp >= ts);
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
              <select name="type" value={filters.type} onChange={handleFilterChange} className="filter-select">
                <option value="">All Types</option>
                <option value="Deposit">Deposit</option>
                <option value="Withdraw">Withdraw</option>
                <option value="Borrow">Borrow</option>
                <option value="Repay">Repay</option>
              </select>
              <select name="token" value={filters.token} onChange={handleFilterChange} className="filter-select">
                <option value="">All Tokens</option>
                {Object.values(tokenMetadata).map((meta, idx) => (
                  <option key={idx} value={meta.symbol}>{meta.symbol}</option>
                ))}
              </select>
              <input type="number" name="amount" placeholder="Amount" value={filters.amount} onChange={handleFilterChange} className="filter-input" />
              <input type="date" name="date" value={filters.date} onChange={handleFilterChange} className="filter-input" />
              <button onClick={applyFilters} className="filter-button">Apply</button>
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
              {filtered.map((tx, i) => (
                <tr key={i}>
                  <td style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    {tx.icon ? (
                      <img src={tx.icon} alt={tx.symbol} style={{ width: "20px", height: "20px", borderRadius: "50%", backgroundColor: "white" }} />
                    ) : (
                      <span style={{ width: "20px" }}>[?]</span>
                    )}
                    {tx.symbol}
                  </td>
                  <td>{tx.type}</td>
                  <td>{tx.amount}</td>
                  <td>{formatDate(tx.timestamp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ViewTransaction;
