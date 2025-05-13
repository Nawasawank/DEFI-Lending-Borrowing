import React, { useState, useEffect } from 'react';
import '../styles/Yourborrows.css';
import RepayPage from '../pages/RepayPage';

import wethIcon from '../pictures/weth.png';
import wbtcIcon from '../pictures/wbtc.png';
import usdcIcon from '../pictures/usdc.png';
import daiIcon from '../pictures/dai.png';
import ghoIcon from '../pictures/gho.svg';

const tokenIcons = {
  WETH: wethIcon,
  WBTC: wbtcIcon,
  USDC: usdcIcon,
  DAI: daiIcon,
  GHO: ghoIcon,
};

function Yourborrows() {
  const [isRepayOpen, setIsRepayOpen] = useState(false);
  const [selectedLiability, setSelectedLiability] = useState(null);
  const [account, setAccount] = useState(null);
  const [borrowStats, setBorrowStats] = useState({ apy: '-', totalDebt: '-' });
  const [liabilities, setLiabilities] = useState([]);
  const [apyMap, setApyMap] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getAccount = async () => {
      if (window.ethereum) {
        try {
          const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
          setAccount(accounts[0]);
        } catch (error) {
          console.error("MetaMask error:", error);
        }
      }
    };
    getAccount();
  }, []);

  useEffect(() => {
    if (!account) return;

    const fetchData = async () => {
      try {
        const [sumBorrowRes, totalApyRes, debtRes, apyRes] = await Promise.all([
          fetch(`http://localhost:3001/api/sumBorrow?userAddress=${account}`),
          fetch(`http://localhost:3001/api/total-borrow-apy?userAddress=${account}`),
          fetch(`http://localhost:3001/api/borrower-debt?userAddress=${account}`),
          fetch('http://localhost:3001/api/borrow-apy')
        ]);

        const sumBorrowData = await sumBorrowRes.json();
        const totalApyData = await totalApyRes.json();
        const debtData = await debtRes.json();
        const apyData = await apyRes.json();

        setBorrowStats({
          totalDebt: `$${parseFloat(sumBorrowData.totalBorrowUSD).toFixed(2)}`,
          apy: `${parseFloat(totalApyData.totalBorrowAPY).toFixed(2)}%`
        });

        const filtered = debtData.debt.filter(item => parseFloat(item.balance) > 0);
        setLiabilities(filtered);

        const map = {};
        apyData.forEach(entry => {
          map[entry.asset.toLowerCase()] = entry.borrowAPY;
        });
        setApyMap(map);
      } catch (err) {
        console.error("Failed to fetch borrow data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [account]);

  const handleOpenRepay = (liability) => {
    setSelectedLiability(liability);
    setIsRepayOpen(true);
  };

  const handleCloseRepay = () => {
    setSelectedLiability(null);
    setIsRepayOpen(false);
  };

  return (
    <>
      <div className="activity-containerb">
        <div className="borrows">
          <div className="borrows-header">
            <h2>Your Borrows</h2>
            <div className="info-sectionb">
              <div className="info-boxb">APY {loading ? <div className="skeleton shimmer" style={{ width: '60px', height: '20px' }} /> : borrowStats.apy}</div>
              <div className="info-boxb">Total Debt {loading ? <div className="skeleton shimmer" style={{ width: '80px', height: '20px' }} /> : borrowStats.totalDebt}</div>
            </div>
          </div>
          <table className="by">
            <thead>
              <tr>
                <th>Assets</th>
                <th>Debt</th>
                <th>APY</th>
                <th></th>
              </tr>
            </thead>
            <tbody className="by">
              {loading
                ? Array(3).fill(0).map((_, i) => (
                    <tr key={i}>
                      <td><div className="skeleton shimmer" style={{ width: '100px', height: '20px' }} /></td>
                      <td><div className="skeleton shimmer" style={{ width: '60px', height: '20px' }} /></td>
                      <td><div className="skeleton shimmer" style={{ width: '50px', height: '20px' }} /></td>
                      <td><div className="skeleton shimmer" style={{ width: '80px', height: '30px', borderRadius: '6px' }} /></td>
                    </tr>
                  ))
                : liabilities.map((liability, index) => (
                    <tr key={index}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <img
                            src={tokenIcons[liability.symbol]}
                            alt={liability.symbol}
                            style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: 'white' }}
                          />
                          <span>{liability.symbol}</span>
                        </div>
                      </td>
                      <td>{parseFloat(liability.balance).toFixed(2)}</td>
                      <td>{apyMap[liability.tokenAddress?.toLowerCase()] || '-'}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="link-buttonb Repay-buttonb"
                          onClick={() => handleOpenRepay(liability)}
                        >
                          Repay
                        </button>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      </div>

      {isRepayOpen && selectedLiability && (
        <div className="repay-overlay">
          <div className="repay-modal">
            <RepayPage
              onClose={handleCloseRepay}
              tokenName={selectedLiability.symbol}
              debt={selectedLiability.balance}
              healthStart={4.91}
              healthEnd={225.55}
            />
          </div>
        </div>
      )}
    </>
  );
}

export default Yourborrows;
