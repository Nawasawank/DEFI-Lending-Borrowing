// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract PriceOracle is Ownable {
    mapping(string => address) public priceFeeds;
    mapping(string => int) public lastKnownPrices;

    event PriceFeedUpdated(string symbol, address feedAddress);
    event PriceLookup(string symbol, int price, uint timestamp);
    event FallbackUsed(string symbol, int fallbackPrice);

    constructor() Ownable(msg.sender) {
        // Initialize with known reliable Chainlink feeds
        priceFeeds["ETH"] = 0x694AA1769357215DE4FAC081bf1f309aDC325306;
        priceFeeds["BTC"] = 0x1b44F3514812d835EB1BDB0acB33d3fA3351Ee43;
        priceFeeds["USDC"] = 0xA2F78ab2355fe2f984D808B5CeE7FD0A93D5270E;
        priceFeeds["DAI"] = 0x14866185B1962B63C3Ea9E03Bc1da838bab34C19;
        priceFeeds["GHO"] = 0x635A86F9fdD16Ff09A0701C305D3a845F1758b8E;
    }

    // Restrict price feed update to the contract owner
    function setPriceFeed(string memory symbol, address feedAddress) public onlyOwner {
        require(feedAddress != address(0), "Invalid address");
        priceFeeds[symbol] = feedAddress;
        emit PriceFeedUpdated(symbol, feedAddress);
    }

    // Core method: Safe price retrieval with validation and fallback
    function getSafePrice(string memory symbol) public returns (int) {
        require(priceFeeds[symbol] != address(0), "Price feed not set");

        (, int price,, uint timeStamp,) = AggregatorV3Interface(priceFeeds[symbol]).latestRoundData();
        
        // Check for data freshness (max 1 hour old)
        if (block.timestamp - timeStamp > 1 hours || price <= 0 || price > 1_000_000 * 1e8) {
            emit FallbackUsed(symbol, lastKnownPrices[symbol]);
            return lastKnownPrices[symbol];
        } else {
            lastKnownPrices[symbol] = price;
            emit PriceLookup(symbol, price, timeStamp);
            return price;
        }
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

    function getPriceInUSD(string memory symbol) public returns (uint) {
        int rawPrice = getSafePrice(symbol);
        require(rawPrice > 0, "Invalid price");
        uint8 decimals = getDecimals(symbol);
        return uint(rawPrice) / (10 ** (decimals - 2)); // scale to cents
    }

    function getLatestTimestamp(string memory symbol) public view returns (uint) {
        require(priceFeeds[symbol] != address(0), "Price feed not set");
        (, , , uint timeStamp,) = AggregatorV3Interface(priceFeeds[symbol]).latestRoundData();
        return timeStamp;
    }

    function getLatestPriceAndTimestamp(string memory symbol) public view returns (int price, uint updatedAt) {
        require(priceFeeds[symbol] != address(0), "Price feed not set");
        (, int latestPrice,, uint timeStamp,) = AggregatorV3Interface(priceFeeds[symbol]).latestRoundData();
        return (latestPrice, timeStamp);
    }
}
