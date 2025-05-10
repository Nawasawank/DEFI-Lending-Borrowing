import React, { useEffect, useState } from 'react';
import '../styles/ViewTransaction.css';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';

const ViewTransaction = () => {
  const [history, setHistory] = useState([]);
  const userAddress = '0xYourWalletAddress'; // Replace this with real user address from props/context

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch(`/api/transactions?userAddress=${userAddress}`);
        const data = await res.json();
        setHistory(data.history);
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

  return (
    <div className="view-container">
      <Sidebar />
      <div className="view-main">
        <Header />
        <div className="transaction-header">
          <h2>Transaction History</h2>
          <input className="search-bar" placeholder="Search for previous transaction" />
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
            {history.map((tx, index) => (
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
