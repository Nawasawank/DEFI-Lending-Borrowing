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

const ViewTransaction = () => {
  const [history, setHistory] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [filters, setFilters] = useState({
    type: "",
    token: "",
    amount: "",
    date: "",
  });
  const userAddress = "0xYourWalletAddress"; // Replace with real user address

  useEffect(() => {
    // Mock data for UI testing
    const mockData = [
      {
        type: "Deposit",
        token: "DAI",
        amount: "100.00",
        timestamp: Math.floor(Date.now() / 1000) - 86400 * 2,
      },
      {
        type: "Withdraw",
        token: "USDC",
        amount: "50.00",
        timestamp: Math.floor(Date.now() / 1000) - 86400 * 1,
      },
      {
        type: "Borrow",
        token: "WETH",
        amount: "1.25",
        timestamp: Math.floor(Date.now() / 1000),
      },
      {
        type: "Repay",
        token: "WBTC",
        amount: "0.005",
        timestamp: Math.floor(Date.now() / 1000) - 86400 * 5,
      },
    ];

    setHistory(mockData);
    setFiltered(mockData);
  }, []);

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
        (tx) => tx.token.toLowerCase() === token.toLowerCase()
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
                <option value="WETH">WETH</option>
                <option value="WBTC">WBTC</option>
                <option value="USDC">USDC</option>
                <option value="DAI">DAI</option>
                <option value="GHO">GHO</option>
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
                <th>Assets</th>
                <th>Transaction Type</th>
                <th>Amount</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody className="tx-table-body">
              {filtered.map((tx, index) => (
                <tr key={index}>
                  <td
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <img
                      src={tokenIcons[tx.token]}
                      alt={tx.token}
                      style={{
                        width: "20px",
                        height: "20px",
                        borderRadius: "50%",
                        backgroundColor: "white",
                      }}
                    />
                    {tx.token}
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
