import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/Yoursupplies.css';  // Make sure the CSS file is correctly linked

function Yoursupplies() {
    // Example data with placeholders
    const supplies = {
        balance: '$10.00',
        apy: '2.71%',
        collateral: '$10.00',
        assets: [
            { id: 1, walletBalance: '5', apy: '5', name: 'Asset 1' }, // Added names for assets
            { id: 2, walletBalance: '10', apy: '3.5', name: 'Asset 2' }
        ]
    };

    return (
        <div className="activity-containers">
            <div className="supplies">
                <div className="supplies-header">
                    <h2>Your Supplies</h2><span className="supplies"></span>
                    <div className="info-section">
                        <div className="info-box">Balance {supplies.balance}</div>
                        <div className="info-box">APY {supplies.apy}</div>
                        <div className="info-box">Collateral {supplies.collateral}</div>
                    </div>
                </div>
                <table class="s">
                    <thead>
                        <tr>
                            <th>Assets</th>
                            <th>Wallet balance</th>
                            <th>APY</th>
                            <th></th> {/* Placeholder for buttons */}
                        </tr>
                    </thead>
                    <tbody>
                        {supplies.assets.map(asset => (
                            <tr key={asset.id}>
                                <td><div className="asset-icon"></div>{asset.name}</td>
                                <td>{asset.walletBalance}</td>
                                <td>{asset.apy}</td>
                                <td>
                                    <div className="sbutton-container">
                                        <Link to="/withdraw" className="slink-button sWithdraw-button">Withdraw</Link>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default Yoursupplies;
