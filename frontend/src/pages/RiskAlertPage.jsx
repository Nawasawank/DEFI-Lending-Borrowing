import Header from "../components/Header";
import "../styles/RiskAlert.css";
import { ReactComponent as ExclamationMarkIcon } from "../pictures/exclamationmark.svg";
import { Link } from "react-router-dom";

function Risk() {
  return (
    <div className="risk-container">
      <Header />

      <div className="table-wrapper">
        <table className="risk-table">
          <thead>
            <tr>
              <th></th>
              <th>Assets</th>
              <th>Health Risk</th>
              <th></th>
            </tr>
          </thead>

          <tbody>
            <tr>
              <td></td>
              <td>
                <div className="asset">
                  <div className="asset-icon"></div>
                  <span>name</span>
                </div>
              </td>
              <td>0 %</td>
              <td>
                <button className="alert-button">
                  <ExclamationMarkIcon className="alert-icon" />
                </button>
              </td>
            </tr>

            <tr>
              <td></td>
              <td>
                <div className="asset">
                  <div className="asset-icon"></div>
                  <span>name</span>
                </div>
              </td>
              <td>0 %</td>
              <td>
                <button className="alert-button">
                  <ExclamationMarkIcon className="alert-icon" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Risk;
