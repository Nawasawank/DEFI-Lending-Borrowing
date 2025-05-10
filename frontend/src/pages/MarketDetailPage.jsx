import React from "react";
import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import makeBlockie from "ethereum-blockies-base64";
import "../styles/MarketDetail.css";
import MarketHeader from "../components/MarketHeader";
import walletIcon from "../pictures/walletIcon.svg";
import SupplyPage from "../pages/SupplyPage";
import BorrowPage from "../pages/BorrowPage";

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

  //--- Check Wallet Connection ---//
  const [account, setAccount] = useState(null);
  const [blockieSrc, setBlockieSrc] = useState("");
  useEffect(() => {
    if (window.ethereum && window.ethereum.selectedAddress) {
      const addr = window.ethereum.selectedAddress;
      setAccount(addr);
      setBlockieSrc(makeBlockie(addr));
    }

    if (window.ethereum) {
      window.ethereum.on("accountsChanged", (accounts) => {
        if (accounts.length > 0) {
          // Wallet connected
          setAccount(accounts[0]);
          setBlockieSrc(makeBlockie(accounts[0]));
          console.log("Account: ", accounts[0]);
        } else {
          // Wallet disconnected
          setAccount(null);
          setBlockieSrc("");
        }
      });
    }
  }, []);

  //--- Fetch Wallet Balance ---//
  const [walletBalance, setWalletBalance] = useState(null);
  useEffect(() => {
    const fetchWalletBalance = async () => {
      if (account) {
        try {
          const response = await fetch(
            `http://localhost:3001/api/wallet-balance?userAddress=${account}`
          );
          if (!response.ok) {
            throw new Error("Network response was not ok");
          }
          const balance = await response.json();
          const matchingBalance = balance.balances.find(
            (balance) => balance.symbol === name
          );
          setWalletBalance(matchingBalance);

          console.log("Wallet Balance:", matchingBalance);
          console.log("Wallet Balance-balance:", matchingBalance.balance);
        } catch (error) {
          console.error("Fetch wallet balance error:", error);
        }
      }
    };

    const fetchMaxBorrow = async () => {
      if (account) {
        try {
          const response = await fetch(
            `http://localhost:3001/api/MaxBorrow?userAddress=${account}&assetAddress=${assetAddress}`
          );
          if (!response.ok) {
            throw new Error("Network response was not ok");
          }
          const borrow = await response.json();
          setWalletBalance((prevData) => ({
            ...(prevData || {}),
            maxBorrow: borrow.maxBorrow,
          }));
          console.log("Max Borrow:", borrow.maxBorrow);
        } catch (error) {
          console.error("Fetch max borrow error:", error);
        }
      }
    };

    fetchMaxBorrow();
    fetchWalletBalance();
  }, [account, name]);

  //--- Supply-Borrow Modal ---//
  const [isSupplyOpen, setIsSupplyOpen] = useState(false);
  const [isBorrowOpen, setIsBorrowOpen] = useState(false);
  const handleCloseSupply = () => {
    setIsSupplyOpen(false);
  };
  const handleCloseBorrow = () => {
    setIsBorrowOpen(false);
  };

  return (
    <>
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
                      {marketAssetsData.supplied} of{" "}
                      {marketAssetsData.supplyCap}
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
                      {marketAssetsData.borrowed} of{" "}
                      {marketAssetsData.borrowCap}
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
              {account ? (
                <div>
                  <div className="wallet-container">
                    <img
                      className="info-wallet-icon"
                      src={walletIcon}
                      alt="Wallet Icon"
                    />
                    <div className="wallet-info">
                      <p>wallet balance</p>
                      <p>
                        {walletBalance ? walletBalance.balance : 0} {name}
                      </p>
                    </div>
                  </div>
                  <div className="supply-borrow">
                    <div className="sb-detail">
                      <p>Available to supply</p>
                      <p className="bold">
                        {walletBalance ? walletBalance.balance : 0} {name}
                      </p>
                      <p>{walletBalance ? walletBalance.usdValue : 0}</p>
                    </div>
                    <button
                      className="sb-button"
                      onClick={() => setIsSupplyOpen(true)}
                    >
                      Supply
                    </button>
                  </div>
                  <div className="supply-borrow">
                    <div className="sb-detail">
                      <p>Available to borrow</p>
                      <p className="bold">
                        {walletBalance ? walletBalance.maxBorrow : 0} {name}
                      </p>
                      <p>$0</p>
                    </div>
                    <button
                      className="sb-button"
                      onClick={() => setIsBorrowOpen(true)}
                    >
                      Borrow
                    </button>
                  </div>
                </div>
              ) : (
                <p className="wallet-check">please connect your wallet</p>
              )}
            </div>
          </div>
        ) : (
          <p>Loading ...</p>
        )}
      </div>

      {/* Supply Modal */}
      {isSupplyOpen && (
        <div className="supply-overlay">
          <div className="supply-modal">
            <SupplyPage
              onClose={handleCloseSupply}
              tokenName={name}
              apy={marketAssetsData.supplyAPY}
              amount={0}
            />
          </div>
        </div>
      )}

      {/* Borrow Modal */}
      {isBorrowOpen && (
        <div className="borrow-overlay">
          <div className="borrow-modal">
            <BorrowPage
              onClose={handleCloseBorrow}
              tokenName={name}
              apy={marketAssetsData.borrowAPY}
              amountAvailable={marketAssetsData.borrowed}
            />
          </div>
        </div>
      )}
    </>
  );
}

export default MarketDetail;
