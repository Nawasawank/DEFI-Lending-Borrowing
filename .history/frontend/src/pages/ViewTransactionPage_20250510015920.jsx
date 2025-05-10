import React, { useEffect, useState } from 'react';
import '../styles/ViewTransactionPage.css';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';

const ViewTransaction = () => {
  const [history, setHistory] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [filters, setFilters] = useState({ type: '', token: '', amount: '', startDate: '', endDate: '' });
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
    const { type, token, amount, startDate, endDate } = filters;

    if (type) result = result.filter(tx => tx.type === type);
    if (token) result = result.filter(tx => tx.token.toLowerCase() === token.toLowerCase());
    if (amount) result = result.filter(tx => Number(tx.amount) >= Number(amount));
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

        <div className="filters-bar-row full-width-row">
          <select name="type" value={filters.type} onChange={handleFilterChange} className="filter-select">
            <option value="">All Types</option>
            <option value="Deposit">Deposit</option>
            <option value="Withdraw">Withdraw</option>
            <option value="Borrow">Borrow</option>
            <option value="Repay">Repay</option>
          </select>

          <select name="token" value={filters.token} onChange={handleFilterChange} className="filter-select">
            <option value="">All Tokens</option>
            <option value="WETH">WETH</option>
            <option value="WBTC">WBTC</option>
            <option value="USDC">USDC</option>
            <option value="DAI">DAI</option>
            <option value="GHO">GHO</option>
          </select>

          <input type="number" name="amount" placeholder="Min Amount" value={filters.amount} onChange={handleFilterChange} className="filter-input" />

          <input type="date" name="startDate" value={filters.startDate} onChange={handleFilterChange} className="filter-input" />
          <input type="date" name="endDate" value={filters.endDate} onChange={handleFilterChange} className="filter-input" />

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
