import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import '../styles/Yoursupplies.css';  // Make sure the CSS file is correctly linked

function Yoursupplies() {
    // Example data with placeholders
    const [supplies, setSupplies] = useState({
        balance: '$10.00',
        apy: '2.71%',
        collateral: '$10.00',
        assets: [
            { id: 1, walletBalance: '5', apy: '5', Collateral: true },
            { id: 2, walletBalance: '10', apy: '3.5', Collateral: false },
        ]
    });

    // Function to toggle checkbox
    const toggleCollateral = (id) => {
        const updatedAssets = supplies.assets.map(asset => {
            if (asset.id === id) {
                return { ...asset, Collateral: !asset.Collateral };
            }
            return asset;
        });
        setSupplies(prev => ({ ...prev, assets: updatedAssets }));
    };

    return (
        <div className="activity-container">
            <div className="supplies">
                <div className="supplies-header">
                    <h2>Your Supplies</h2>
                    <div className="info-section">
                        <div className="info-box">Balance {supplies.balance}</div>
                        <div className="info-box">APY {supplies.apy}</div>
                        <div className="info-box">Collateral {supplies.collateral}</div>
                    </div>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>Assets</th>
                            <th>Wallet balance</th>
                            <th>APY</th>
                            <th>Collateral</th>
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
                                    <input 
                                        type="checkbox" 
                                        checked={asset.canBeCollateral} 
                                        onChange={() => toggleCollateral(asset.id)}
                                    />
                                </td>
                                <td>
                                     <div className="button-container">
                                         <Link to="/switch" className="link-button Switch-button">Switch</Link>
                                         <Link to="/withdraw" className="link-button Withdraw-button">Withdraw</Link>
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
