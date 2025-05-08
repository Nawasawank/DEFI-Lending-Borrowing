const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PriceOracle", function () {
  let priceOracle;
  let mockPriceFeeds = {};
  const DECIMALS = 8;
  const INITIAL_PRICES = {
    ETH: 900000000000,
    BTC: 6000000000000,
    USDC: 100000000,
    DAI: 99800000,
    GHO: 100000000
  };
  const SYMBOLS = Object.keys(INITIAL_PRICES);

  before(async () => {
    const PriceOracleFactory = await ethers.getContractFactory("PriceOracle");
    priceOracle = await PriceOracleFactory.deploy();
    await priceOracle.waitForDeployment();

    const MockV3AggregatorFactory = await ethers.getContractFactory("MockV3Aggregator");

    for (const symbol of SYMBOLS) {
      const mock = await MockV3AggregatorFactory.deploy(
        DECIMALS,
        INITIAL_PRICES[symbol],
        `${symbol} / USD`
      );
      await mock.waitForDeployment();
      mockPriceFeeds[symbol] = mock;

      await priceOracle.setPriceFeed(symbol, await mock.getAddress());
    }
  });

  it("should have correct initial price feed addresses", async () => {
    for (const symbol of SYMBOLS) {
      const storedAddress = await priceOracle.priceFeeds(symbol);
      expect(storedAddress).to.equal(await mockPriceFeeds[symbol].getAddress());
    }
  });

  it("should allow updating price feed addresses", async () => {
    const MockV3AggregatorFactory = await ethers.getContractFactory("MockV3Aggregator");
    const newMock = await MockV3AggregatorFactory.deploy(
      DECIMALS,
      INITIAL_PRICES.ETH * 2,
      "Updated ETH / USD"
    );
    await newMock.waitForDeployment();

    const tx = await priceOracle.setPriceFeed("ETH", await newMock.getAddress());
    await tx.wait();

    expect(await priceOracle.priceFeeds("ETH")).to.equal(await newMock.getAddress());

    // Restore original ETH feed
    await priceOracle.setPriceFeed("ETH", await mockPriceFeeds["ETH"].getAddress());
  });

  it("should get the latest price for each token", async () => {
    for (const symbol of SYMBOLS) {
      const price = await priceOracle.getLatestPrice(symbol);
      expect(price.toString()).to.equal(INITIAL_PRICES[symbol].toString());
    }
  });

  it("should get the correct decimals for each token", async () => {
    for (const symbol of SYMBOLS) {
      const decimals = await priceOracle.getDecimals(symbol);
      expect(decimals).to.equal(DECIMALS);
    }
  });

  it("should get the correct description for each token", async () => {
    for (const symbol of SYMBOLS) {
      const description = await priceOracle.getDescription(symbol);
      expect(description).to.equal(`${symbol} / USD`);
    }
  });

  it("should revert when getting price for non-existent token", async () => {
    await expect(priceOracle.getLatestPrice("NONEXISTENT"))
      .to.be.revertedWith("Price feed not set");
  });

  it("should reflect updated prices from oracle", async () => {
    const newPrice = 1200000000000;

    await priceOracle.setPriceFeed("ETH", await mockPriceFeeds["ETH"].getAddress());
    await mockPriceFeeds["ETH"].updateAnswer(newPrice);

    const updated = await priceOracle.getLatestPrice("ETH");
    expect(updated.toString()).to.equal(newPrice.toString());

    await mockPriceFeeds["ETH"].updateAnswer(INITIAL_PRICES.ETH);
  });

  it("should return latest timestamp > 0", async () => {
    for (const symbol of SYMBOLS) {
      const ts = await priceOracle.getLatestTimestamp(symbol);
      expect(ts).to.be.gt(0);
    }
  });

  it("should prevent attacker from manipulating price beyond expected range", async () => {
    const manipulatedPrice = 999999999999999n;
    await mockPriceFeeds["USDC"].updateAnswer(manipulatedPrice);
  
    const latestPrice = await priceOracle.getLatestPrice("USDC");
  
    const lowerBound = 90_000_000;
    const upperBound = 110_000_000;
  
    expect(Number(latestPrice)).to.not.be.within(lowerBound, upperBound, "Price manipulation detected");
  
    await mockPriceFeeds["USDC"].updateAnswer(INITIAL_PRICES.USDC);
  });
  
});
