import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Header from "../components/Header";
import "../styles/Market.css";
import wethIcon from "../pictures/weth.png";
import wbtcIcon from "../pictures/wbtc.png";
import usdcIcon from "../pictures/usdc.png";
import daiIcon from "../pictures/dai.png";
import ghoIcon from "../pictures/gho.png";

function Market() {
  //--- Fetch Market Detail ---//
  const [marketDetail, setMarketDetail] = useState(null);
  useEffect(() => {
    const fetchMarketData = async () => {
      try {
        const response = await fetch("http://localhost:3001/api/market");
        if (!response.ok) {
          throw new Error("Network response was not ok");
        }

        const market = await response.json();
        setMarketDetail(market);
        console.log("Market data:", market);
      } catch (error) {
        console.error("Fetch market error:", error);
      }
    };

    fetchMarketData();
  }, []);

  //--- Fetch Matket Asset ---//
  const [marketAssetsData, setMarketAssetData] = useState([]);
  useEffect(() => {
    const fetchMarketAssetsAndAPYs = async () => {
      try {
        // Fetch all assets
        const response = await fetch(
          "http://localhost:3001/api/all-total-supply-borrow"
        );
        if (!response.ok) {
          throw new Error("Failed to fetch market assets");
        }
        const assets = await response.json();

        // Fetch all supply-apy data
        const supplyResponse = await fetch(
          "http://localhost:3001/api/supply-apy"
        );
        if (!supplyResponse.ok) {
          throw new Error("Failed to fetch supply APYs");
        }
        const supplyData = await supplyResponse.json();

        // Fetch all borrow-apy data
        const borrowResponse = await fetch(
          "http://localhost:3001/api/borrow-apy"
        );
        if (!borrowResponse.ok) {
          throw new Error("Failed to fetch borrow APYs");
        }
        const borrowData = await borrowResponse.json();

        // Merge supplyAPY and borrowAPY into assets
        const mergedData = assets.map((asset) => {
          const matchingSupplyAPY = supplyData.find(
            (apy) => apy.asset === asset.assetAddress
          );
          const matchingBorrowAPY = borrowData.find(
            (apy) => apy.asset === asset.assetAddress
          );

          return {
            ...asset,
            supplyAPY: matchingSupplyAPY ? matchingSupplyAPY.supplyAPY : "N/A",
            borrowAPY: matchingBorrowAPY ? matchingBorrowAPY.borrowAPY : "N/A",
          };
        });

        setMarketAssetData(mergedData);
        console.log("Merged Market Asset Data:", mergedData);
      } catch (error) {
        console.error("Error fetching market assets or APYs:", error);
      }
    };

    fetchMarketAssetsAndAPYs();
  }, []);

  //--- Asset Icon Path ---//
  const assetIcons = {
    WETH: wethIcon,
    WBTC: wbtcIcon,
    USDC: usdcIcon,
    DAI: daiIcon,
    GHO: ghoIcon,
  };

  return (
    <div className="market-container">
      <Header />

      {/* Market Details */}
      <div className="market-info-container">
        <div className="market-info">
          <p>Total Market Size</p>
          <p>{marketDetail?.totalMarketSize}</p>
        </div>
        <div className="market-info">
          <p>Total Available</p>
          <p>{marketDetail?.totalAvailable}</p>
        </div>
        <div className="market-info">
          <p>Total Borrows</p>
          <p>{marketDetail?.totalBorrows}</p>
        </div>
      </div>

      {/* Market Table */}
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
            {marketAssetsData.map((asset, index) => (
              <tr key={index}>
                <td>
                  <div className="asset">
                    <img
                      src={assetIcons[asset.symbol]}
                      alt={`${asset.symbol} icon`}
                      className="asset-icon"
                    />
                    <span>{asset.symbol}</span>
                  </div>
                </td>
                <td>{asset.totalSupplied}</td>
                <td>{asset.supplyAPY}</td>
                <td>{asset.totalBorrowed}</td>
                <td>{asset.borrowAPY}</td>
                <td>
                  <Link
                    to={`/marketdetail?symbol=${asset.symbol}&assetAddress=${asset.assetAddress}`}
                  >
                    <button className="view-button">view</button>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Market;
