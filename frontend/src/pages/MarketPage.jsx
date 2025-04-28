import Header from "../components/Header";
import "../styles/Market.css";
import { ReactComponent as ExclamationMarkIcon } from "../pictures/exclamationmark.svg";
import { Link } from "react-router-dom";

function Market() {
  return (
    <div className="market-container">
      <Header />

      <div className="market-info-container">
        <div className="market-info">
          <p>Total Market Size</p>
          <p>0 $</p>
        </div>
        <div className="market-info">
          <p>Total Available</p>
          <p>0 $</p>
        </div>
        <div className="market-info">
          <p>Total Borrows</p>
          <p>0 $</p>
        </div>
      </div>

      <div className="table-wrapper">
        <table className="market-table">
          <thead>
            <tr>
              <th>Assets</th>
              <th>Total supplied</th>
              <th>Supply APY</th>
              <th>Total borrowed</th>
              <th>Borrow APY, variable</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <div className="asset">
                  <div className="asset-icon"></div>
                  <span>name</span>
                </div>
              </td>
              <td>0 M</td>
              <td>0 %</td>
              <td>0 M</td>
              <td>0 %</td>
              <td>
                <Link to="/marketdetail">
                  <button className="view-button">view</button>
                </Link>
              </td>
            </tr>

            <tr>
              <td>
                <div className="asset">
                  <div className="asset-icon"></div>
                  <span>name</span>
                </div>
              </td>
              <td>0 M</td>
              <td>0 %</td>
              <td>0 M</td>
              <td>0 %</td>
              <td>
                <Link to="/marketdetail">
                  <button className="view-button">view</button>
                </Link>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Market;
