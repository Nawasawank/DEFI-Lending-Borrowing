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

const rawTokenMap = JSON.parse(process.env.REACT_APP_TOKEN_SYMBOL_MAP || "{}");
const tokenMap = Object.fromEntries(
  Object.entries(rawTokenMap).map(([addr, symbol]) => [addr.toLowerCase(), symbol])
);

const ViewTransaction = () => {
  const [history, setHistory] = useState([]);
  const [filters, setFilters] = useState({ type: "", date: "" });
  const [account, setAccount] = useState(null);

  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);

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
    if (account) fetchHistory();
  }, [account, filters.type, filters.date, page]);

  const fetchHistory = async () => {
    const queryParams = new URLSearchParams();
    queryParams.append("userAddress", account);
    queryParams.append("page", page);
    queryParams.append("limit", limit);
    if (filters.type) queryParams.append("type", filters.type);

    try {
      const response = await fetch(`http://localhost:3001/api/history?${queryParams.toString()}`);
      const result = await response.json();

      let data = result.history || [];

      // frontend date filtering (if used)
      if (filters.date) {
        const selectedDay = new Date(filters.date);
        selectedDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(selectedDay);
        endOfDay.setHours(23, 59, 59, 999);

        data = data.filter((tx) => {
          const txDate = new Date(tx.timestamp * 1000);
          return txDate >= selectedDay && txDate <= endOfDay;
        });
      }

      setHistory(data);
      const total = result.total || 0;
      setTotalPages(Math.ceil(total / limit) || 1);
    } catch (err) {
      console.error("Error fetching paginated history:", err);
    }
  };

  const handleFilterChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
    setPage(1); // reset page when filter changes
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp * 1000);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  return (
    <div className="view-container">
      <div className="view-main">
        <Header />

        <div className="transaction-content">
          <div className="transaction-filters">
            <div className="filters-row" style={{ display: "flex", gap: "10px", alignItems: "center" }}>
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

              <input
                type="date"
                name="date"
                value={filters.date}
                onChange={handleFilterChange}
                className="filter-input"
              />
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
              {history.map((tx, index) => {
                const lowerAddress = tx.token?.toLowerCase();
                const symbol = tokenMap[lowerAddress] ?? lowerAddress?.slice(0, 6) + "...";
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
                            objectFit: "contain",
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

          {/* Pagination Controls */}
          <div style={{ display: "flex", justifyContent: "center", marginTop: "16px", gap: "12px" }}>
            <button
              onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
              disabled={page === 1}
              className="filter-button"
            >
              Previous
            </button>
            <span>Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={page === totalPages}
              className="filter-button"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ViewTransaction;
