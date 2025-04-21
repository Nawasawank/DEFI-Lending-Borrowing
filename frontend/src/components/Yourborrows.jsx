import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/Yourborrows.css';  // Ensure this CSS path is correct

function Yourborrows() {
    const borrows = {
        balance: '$20.00',
        apy: '3.45%',
        totalDebt: '$30.00',
        liabilities: [
            { id: 1, debt: '15', apy: '4.5', name: 'Liability 1' , type:'1'},
            { id: 2, debt: '20', apy: '2.5', name: 'Liability 2', type:'1' }
        ]
    };

    return (
        <div className="activity-containerb">
            <div className="borrows">
                <div className="borrows-header">
                    <h2>Your Borrows</h2>
                    <div className="info-sectionb">
                        <div className="info-boxb">Balance {borrows.balance}</div>
                        <div className="info-boxb">APY {borrows.apy}</div>
                        <div className="info-boxb">Total Debt {borrows.totalDebt}</div>
                    </div>
                </div>
                <table className="b">
                    <thead>
                        <tr>
                            <th>Assets</th>
                            <th>Debt</th>
                            <th>APY</th>
                            <th>APY type</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody className="b">
                        {borrows.liabilities.map(liability => (
                            <tr key={liability.id}>
                                <td>
                                    <div className="asset-iconb"></div> {/* Updated to include the icon */}
                                    {liability.name}
                                </td>
                                <td>{liability.debt}</td>
                                <td>{liability.apy}%</td>
                                <td>{liability.type}</td>
                                <td>
                                    <div className="button-containerb">
                                        <Link to="/switch" className="link-buttonb Switch-buttonb">Switch</Link>
                                        <Link to="/repay" className="link-buttonb Repay-buttonb">Repay</Link>
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

export default Yourborrows;
