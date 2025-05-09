import React from "react";
import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import "../styles/MarketDetail.css";
import MarketHeader from "../components/MarketHeader";
import walletIcon from "../pictures/walletIcon.svg";

function MarketDetail() {
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const name = queryParams.get("symbol");
  const assetAddress = queryParams.get("assetAddress");

  const [assetConfig, setAssetConfig] = useState(null);
  const [utilRate, setUtilRate] = useState(null);
  const [marketAssetsData, setMarketAssetData] = useState([]);
  useEffect(() => {
    //--- Fetch Asset Supply-Borrow ---//
    const fetchAssetSupplyBorrow = async () => {
      try {
        const response = await fetch(
          `http://localhost:3001/api/total-supplied-borrowed?assetAddress=${assetAddress}`
        );
        if (!response.ok) {
          throw new Error("Network response was not ok");
        }

        const assets = await response.json();
        setMarketAssetData((prevData) => ({
          ...prevData,
          ...assets.reserve,
        }));

        console.log("Asset supply-borrow data:", assets.reserve);
      } catch (error) {
        console.error("Fetch market error:", error);
      }
    };

    //--- Fetch Asset APY ---//
    const fetchAssetAPYs = async () => {
      try {
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

        // Find matching asset address
        if (assetAddress) {
          const matchingSupplyAPY = supplyData.find(
            (apy) => apy.asset === assetAddress
          );
          const matchingBorrowAPY = borrowData.find(
            (apy) => apy.asset === assetAddress
          );

          setMarketAssetData((prevData) => ({
            ...prevData,
            supplyAPY: matchingSupplyAPY.supplyAPY,
            borrowAPY: matchingBorrowAPY.borrowAPY,
          }));

          console.log("Supply APY:", matchingSupplyAPY.supplyAPY);
          console.log("Borrow APY:", matchingBorrowAPY.borrowAPY);
        }
      } catch (error) {
        console.error("Error fetching market assets or APYs:", error);
      }
    };

    //--- Fetch Asset Config ---//
    const fetchAssetConfig = async () => {
      try {
        const response = await fetch(
          `http://localhost:3001/api/asset-config?assetAddress=${assetAddress}`
        );
        if (!response.ok) {
          throw new Error("Network response was not ok");
        }

        const config = await response.json();
        setAssetConfig(config.config);
        console.log("Asset Config:", config);
      } catch (error) {
        console.error("Fetch market error:", error);
      }
    };

    //--- Fetch Utilization Rate ---//
    const fetchUtilRate = async () => {
      try {
        const response = await fetch(
          `http://localhost:3001/api/utilization-rate?assetAddress=${assetAddress}`
        );
        if (!response.ok) {
          throw new Error("Network response was not ok");
        }

        const util = await response.json();
        setUtilRate(util.utilizationRate);
        console.log("Utilization Rate:", util.utilizationRate);
      } catch (error) {
        console.error("Fetch market error:", error);
      }
    };

    fetchAssetSupplyBorrow();
    fetchAssetAPYs();
    fetchAssetConfig();
    fetchUtilRate();
  }, []);

  return (
    <div className="marketdetail-container">
      <MarketHeader
        name={name}
        address={assetAddress}
        reserve={marketAssetsData.suppliedInUSD}
      />

      {/* Detail Info */}
      {assetConfig && marketAssetsData ? (
        <div className="detail-container">
          <div className="detail-info">
            <h1>Reserve status & configuration</h1>

            {/* Supply */}
            <div className="info-container">
              <div className="info-upper">
                <p className="bold">Supply Info</p>
                <div className="upper-summary">
                  <p>Total supplied</p>
                  <p className="bold">
                    {marketAssetsData.supplied} of {marketAssetsData.supplyCap}
                  </p>
                  <p>
                    {marketAssetsData.suppliedInUSD} of{" "}
                    {marketAssetsData.supplyCapInUSD}
                  </p>
                </div>
                <div className="upper-summary">
                  <p>APY, Variable</p>
                  <p className="bold">{marketAssetsData.supplyAPY}</p>
                </div>
              </div>
              <p className="bold">Collateral usage</p>
              <div className="info-lower">
                <div className="info-card">
                  <p>Max LTV</p>
                  <p className="bold">{assetConfig.maxLTV}</p>
                </div>
                <div className="info-card">
                  <p>Liquidation threshold</p>
                  <p className="bold">{assetConfig.liquidationThreshold}</p>
                </div>
                <div className="info-card">
                  <p>Liquidation penalty</p>
                  <p className="bold">{assetConfig.liquidationPenalty}</p>
                </div>
              </div>
            </div>

            {/* Borrow */}
            <div className="info-container">
              <div className="info-upper">
                <p className="bold">Borrow Info</p>
                <div className="upper-summary">
                  <p>Total supplied</p>
                  <p className="bold">
                    {marketAssetsData.borrowed} of {marketAssetsData.borrowCap}
                  </p>
                  <p>
                    {marketAssetsData.borrowedInUSD} of{" "}
                    {marketAssetsData.borrowCapInUSD}
                  </p>
                </div>
                <div className="upper-summary">
                  <p>APY, Variable</p>
                  <p className="bold">{marketAssetsData.borrowAPY}</p>
                </div>
                <div className="upper-summary">
                  <p>Borrow cap</p>
                  <p className="bold">{marketAssetsData.borrowCap}</p>
                  <p>{marketAssetsData.borrowCapInUSD}</p>
                </div>
              </div>
              <p className="bold">Collector Info</p>
              <div className="info-lower">
                <div className="info-card">
                  <p>Reserve factor</p>
                  <p className="bold">{assetConfig.reserveFactor}</p>
                </div>
              </div>
            </div>

            {/* Interest Rate */}
            <div className="last-info-container">
              <div className="info-upper">
                <p className="bold">Interest rate</p>
                <div className="upper-summary">
                  <p>Utilization Rate</p>
                  <p className="bold">{utilRate}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Your Info */}
          <div className="your-info">
            <h1>Your Info</h1>
            <div className="wallet-container">
              <img
                className="info-wallet-icon"
                src={walletIcon}
                alt="Wallet Icon"
              />
              <div className="wallet-info">
                <p>wallet balance</p>
                <p>0 WETH</p>
              </div>
            </div>
            <div className="supply-borrow">
              <div className="sb-detail">
                <p>Available to supply</p>
                <p className="bold">0 WETH</p>
                <p>$0</p>
              </div>
              <button className="sb-button">Supply</button>
            </div>
            <div className="supply-borrow">
              <div className="sb-detail">
                <p>Available to borrow</p>
                <p className="bold">0 WETH</p>
                <p>$0</p>
              </div>
              <button className="sb-button">Borrow</button>
            </div>
          </div>
        </div>
      ) : (
        <p>Loading ...</p>
      )}
    </div>
  );
}

export default MarketDetail;
