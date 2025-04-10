import React from "react";
import Header from "../components/Header";
import "../styles/Market.css";

function Market() {
  return (
    <div className="container">
      <Header />
      <div className="market-info">
        <p>Total Market Size</p>
        <p>Total Available</p>
        <p>Total Borrows</p>
      </div>
    </div>
  );
}

export default Market;
