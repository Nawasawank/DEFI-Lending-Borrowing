import React, { useEffect, useState } from 'react';
import '../styles/ViewTransactionPage.css';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';

const ViewTransaction = () => {
  const [history, setHistory] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [filters, setFilters] = useState({ type: '', token: '', minAmount: '', maxAmount: '', startDate: '', endDate: '' });
  const userAddress = '0xYourWalletAddress'; // Replace with real user address

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch(`/api/transactions?userAddress=${userAddress}`);
        const data = await res.json();
        setHistory(data.history);
        setFiltered(data.history);
      } catch (err) {
        console.error('Failed to fetch transaction history:', err);
      }
    };

    fetchHistory();
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
    const { type, token, minAmount, maxAmount, startDate, endDate } = filters;

    if (type) result = result.filter(tx => tx.type === type);
    if (token) result = result.filter(tx => tx.token.toLowerCase() === token.toLowerCase());
    if (minAmount) result = result.filter(tx => Number(tx.amount) >= Number(minAmount));
    if (maxAmount) result = result.filter(tx => Number(tx.amount) <= Number(maxAmount));
    if (startDate) {
      const startTimestamp = new Date(startDate).getTime() / 1000;
      result = result.filter(tx => tx.timestamp >= startTimestamp);
    }
    if (endDate) {
      const endTimestamp = new Date(endDate).getTime() / 1000;
      result = result.filter(tx => tx.timestamp <= endTimestamp);
    }

    setFiltered(result);
  };

  return (
    <div className="view-container">
      <Sidebar />
      <div className="view-main">
        <Header />

        <div className="transaction-header-top">
          <h2>Transaction History</h2>
        </div>

        <div className="filters-bar">
          <select name="type" value={filters.type} onChange={handleFilterChange} className="filter-select">
            <option value="">All Types</option>
            <option value="Deposit">Deposit</option>
            <option value="Withdraw">Withdraw</option>
            <option value="Borrow">Borrow</option>
            <option value="Repay">Repay</option>
          </select>

          <input type="text" name="token" placeholder="Token (e.g., DAI)" value={filters.token} onChange={handleFilterChange} className="filter-input" />

          <div className="range-group">
            <label>Amount</label>
            <div className="range-inputs">
              <input type="number" name="minAmount" placeholder="Min" value={filters.minAmount} onChange={handleFilterChange} className="filter-input" />
              <span className="range-separator">→</span>
              <input type="number" name="maxAmount" placeholder="Max" value={filters.maxAmount} onChange={handleFilterChange} className="filter-input" />
            </div>
          </div>

          <div className="range-group">
            <label>Date</label>
            <div className="range-inputs">
              <input type="date" name="startDate" value={filters.startDate} onChange={handleFilterChange} className="filter-input" />
              <span className="range-separator">→</span>
              <input type="date" name="endDate" value={filters.endDate} onChange={handleFilterChange} className="filter-input" />
            </div>
          </div>

          <button onClick={applyFilters} className="filter-button">Apply</button>
        </div>

        <table className="tx-table">
          <thead>
            <tr>
              <th>Assets</th>
              <th>Transaction Type</th>
              <th>Amount</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((tx, index) => (
              <tr key={index}>
                <td>{tx.token}</td>
                <td>{tx.type}</td>
                <td>{tx.amount}</td>
                <td>{formatDate(tx.timestamp)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ViewTransaction;
