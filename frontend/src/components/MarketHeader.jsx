import React from "react";
import { useState, useEffect } from "react";
import "../styles/MarketHeader.css"; // Ensure the CSS path is correct
import ethereumIcon from "../pictures/ethereumIcon.png"; // Correctly importing the image
import wethIcon from "../pictures/WETH.png";
import wbtcIcon from "../pictures/WBTC.png";
import usdcIcon from "../pictures/USDC.png";
import daiIcon from "../pictures/DAI.png";
import ghoIcon from "../pictures/gho.svg";

function Header({ name, address }) {
  //--- Asset Icon Path ---//
  const assetIcons = {
    WETH: wethIcon,
    WBTC: wbtcIcon,
    USDC: usdcIcon,
    DAI: daiIcon,
    GHO: ghoIcon,
  };

  const [utilRate, setUtilRate] = useState(null);
  const [availableLiquidity, setAvailableLiquidity] = useState(null);
  useEffect(() => {
    //--- Fetch Utilization Rate ---//
    const fetchUtilRate = async () => {
      try {
        const response = await fetch(
          `http://localhost:3001/api/utilization-rate?assetAddress=${address}`
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

    //--- Fetch Available Liquidity ---//
    const fetchAvailLiquid = async () => {
      try {
        const response = await fetch(
          `http://localhost:3001/api/available-liquidity?assetAddress=${address}`
        );
        if (!response.ok) {
          throw new Error("Network response was not ok");
        }

        const avail = await response.json();
        setAvailableLiquidity(avail.availableLiquidity);
        console.log("Available Liquidity:", avail.availableLiquidity);
      } catch (error) {
        console.error("Fetch market error:", error);
      }
    };

    fetchUtilRate();
    fetchAvailLiquid();
  }, []);

  return (
    <header className="market-header">
      <div className="asset">
        <div className="asset-head">
          <img
            src={assetIcons[name]}
            alt={`${name} Icon`}
            className="asset-icon"
          />
          <p>{name}</p>
        </div>
        <div className="core-icon">
          <img src={ethereumIcon} alt="Ethereum Icon" className="eth-icon" />
          <p>Core Market</p>
        </div>
      </div>
      <div className="asset-info-container">
        <div className="asset-info">
          <p>Reserve Size</p>
          <p>0 $</p>
        </div>
        <div className="asset-info">
          <p>Available Liquidity</p>
          <p>{availableLiquidity}</p>
        </div>
        <div className="asset-info">
          <p>Utilization Rate</p>
          <p>{utilRate}</p>
        </div>
        <div className="asset-info">
          <p>Oracle Prize</p>
          <p>0 $</p>
        </div>
      </div>
    </header>
  );
}

export default Header;
