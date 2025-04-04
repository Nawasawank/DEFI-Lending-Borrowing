// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

contract PriceOracle {
    mapping(string => address) public priceFeeds;
    
    event PriceFeedUpdated(string symbol, address feedAddress);
    
    constructor() {
        priceFeeds["ETH"] = 0x694AA1769357215DE4FAC081bf1f309aDC325306;  
        priceFeeds["BTC"] = 0x1b44F3514812d835EB1BDB0acB33d3fA3351Ee43;  
        priceFeeds["USDC"] = 0xA2F78ab2355fe2f984D808B5CeE7FD0A93D5270E; 
        priceFeeds["DAI"] = 0x14866185B1962B63C3Ea9E03Bc1da838bab34C19;  
        priceFeeds["GHO"] = 0x635A86F9fdD16Ff09A0701C305D3a845F1758b8E;  
    }

    function setPriceFeed(string memory symbol, address feedAddress) public  {
        priceFeeds[symbol] = feedAddress;
        emit PriceFeedUpdated(symbol, feedAddress);
    }

    function getLatestPrice(string memory symbol) public view returns (int) {
        require(priceFeeds[symbol] != address(0), "Price feed not set");
        (, int price,,,) = AggregatorV3Interface(priceFeeds[symbol]).latestRoundData();
        return price;
    }

    function getDecimals(string memory symbol) public view returns (uint8) {
        require(priceFeeds[symbol] != address(0), "Price feed not set");
        return AggregatorV3Interface(priceFeeds[symbol]).decimals();
    }

    function getDescription(string memory symbol) public view returns (string memory) {
        require(priceFeeds[symbol] != address(0), "Price feed not set");
        return AggregatorV3Interface(priceFeeds[symbol]).description();
    }

    function getPriceInUSD(string memory symbol) public view returns (uint) {
        require(priceFeeds[symbol] != address(0), "Price feed not set");
        int rawPrice = getLatestPrice(symbol);
        uint8 decimals = getDecimals(symbol);
        require(rawPrice > 0, "Negative price");
        return uint(rawPrice) / (10 ** (decimals - 2));
    }

    function getLatestTimestamp(string memory symbol) public view returns (uint) {
        require(priceFeeds[symbol] != address(0), "Price feed not set");
        (, , , uint timeStamp,) = AggregatorV3Interface(priceFeeds[symbol]).latestRoundData();
        return timeStamp;
    }

    function getLatestPriceAndTimestamp(string memory symbol) public view returns (
        int price,
        uint updatedAt
    ) {
        require(priceFeeds[symbol] != address(0), "Price feed not set");
        (, int latestPrice,, uint timeStamp,) = AggregatorV3Interface(priceFeeds[symbol]).latestRoundData();
        return (latestPrice, timeStamp);
    }
}
