const PriceOracle = artifacts.require("PriceOracle");
const MockV3Aggregator = artifacts.require("MockV3Aggregator");

contract("PriceOracle", accounts => {
  let PriceOracle;
  let mockPriceFeeds = {};
  
  // Test constants
  const DECIMALS = 8;
  const INITIAL_PRICES = {
    ETH: 900000000000,   // $9,000
    BTC: 6000000000000,  // $60,000
    USDC: 100000000,     // $1.00
    DAI: 99800000,       // $0.998
    GHO: 100000000       // $1.00
  };

  const SYMBOLS = Object.keys(INITIAL_PRICES);

  before(async () => {
    // Deploy MPriceOracle contract
    PriceOracle = await PriceOracle.new();

    // Deploy mock price feeds for each symbol
    for (const symbol of SYMBOLS) {
      mockPriceFeeds[symbol] = await MockV3Aggregator.new(
        DECIMALS, 
        INITIAL_PRICES[symbol], 
        `${symbol} / USD`
      );
    }

    // Set price feeds in the contract
    for (const symbol of SYMBOLS) {
      await PriceOracle.setPriceFeed(
        symbol, 
        mockPriceFeeds[symbol].address
      );
    }
  });

  describe("Contract Initialization", () => {
    it("should have correct initial price feed addresses", async () => {
      for (const symbol of SYMBOLS) {
        const storedAddress = await PriceOracle.priceFeeds(symbol);
        assert.equal(
          storedAddress, 
          mockPriceFeeds[symbol].address, 
          `${symbol} price feed address incorrect`
        );
      }
    });
  });

  describe("Price Feed Management", () => {
    it("should allow updating price feed addresses", async () => {
      const newMockFeed = await MockV3Aggregator.new(
        DECIMALS, 
        INITIAL_PRICES.ETH * 2, 
        "Updated ETH / USD"
      );

      const tx = await PriceOracle.setPriceFeed("ETH", newMockFeed.address);
      
      assert.equal(tx.logs[0].event, "PriceFeedUpdated", "Event not emitted");
      assert.equal(tx.logs[0].args.symbol, "ETH", "Symbol in event is incorrect");
      assert.equal(tx.logs[0].args.feedAddress, newMockFeed.address, "Feed address in event is incorrect");
    });
  });

  describe("Price Data Retrieval", () => {
    beforeEach(async () => {
      for (const symbol of SYMBOLS) {
        await PriceOracle.setPriceFeed(
          symbol, 
          mockPriceFeeds[symbol].address
        );
      }
    });

    it("should get the latest price for each token", async () => {
      for (const symbol of SYMBOLS) {
        const price = await PriceOracle.getLatestPrice(symbol);
        assert.equal(
          price.toString(), 
          INITIAL_PRICES[symbol].toString(), 
          `${symbol} price is incorrect`
        );
      }
    });

    it("should get the correct decimals for each token", async () => {
      for (const symbol of SYMBOLS) {
        const decimals = await PriceOracle.getDecimals(symbol);
        assert.equal(
          decimals.toString(), 
          DECIMALS.toString(), 
          `${symbol} decimals is incorrect`
        );
      }
    });

    it("should get the correct description for each token", async () => {
      for (const symbol of SYMBOLS) {
        const description = await PriceOracle.getDescription(symbol);
        assert.equal(
          description, 
          `${symbol} / USD`, 
          `${symbol} description is incorrect`
        );
      }
    });

    it("should calculate correct USD prices", async () => {
      for (const symbol of SYMBOLS) {
        const usdPrice = await PriceOracle.getPriceInUSD(symbol);
        const expectedPrice = Math.floor(INITIAL_PRICES[symbol] / (10 ** (DECIMALS - 2)));
        
        assert.equal(
          usdPrice.toString(), 
          expectedPrice.toString(), 
          `${symbol} USD price calculation is incorrect`
        );
      }
    });
  });

  describe("Error Handling", () => {
    it("should revert when getting price for non-existent token", async () => {
      try {
        await PriceOracle.getLatestPrice("NONEXISTENT");
        assert.fail("Expected revert not received");
      } catch (error) {
        assert(
          error.message.includes("Price feed not set"), 
          `Unexpected error: ${error.message}`
        );
      }
    });

    it("should revert when getting decimals for non-existent token", async () => {
      try {
        await PriceOracle.getDecimals("NONEXISTENT");
        assert.fail("Expected revert not received");
      } catch (error) {
        assert(
          error.message.includes("Price feed not set"), 
          `Unexpected error: ${error.message}`
        );
      }
    });
  });

  describe("Price Update Scenarios", () => {
    it("should reflect price updates from the oracle", async () => {
      const symbol = "ETH";
      const newPrice = 1200000000000; // $12,000

      // Update price in mock feed
      await mockPriceFeeds[symbol].updateAnswer(newPrice);

      // Ensure the price feed is set to the updated mock
      await PriceOracle.setPriceFeed(symbol, mockPriceFeeds[symbol].address);

      // Get updated price
      const updatedPrice = await PriceOracle.getLatestPrice(symbol);
      assert.equal(
        updatedPrice.toString(), 
        newPrice.toString(), 
        "Price update not reflected"
      );
    });
  });

  describe("Advanced Price Information", () => {
    it("should get latest timestamp", async () => {
      for (const symbol of SYMBOLS) {
        const timestamp = await PriceOracle.getLatestTimestamp(symbol);
        assert(timestamp > 0, `Timestamp for ${symbol} should be valid`);
      }
    });

    it("should get comprehensive price time info", async () => {
      const symbol = "ETH";
      // Update price to new value
      const newPrice = 1200000000000; // $12,000
      await mockPriceFeeds[symbol].updateAnswer(newPrice);
      await PriceOracle.setPriceFeed(symbol, mockPriceFeeds[symbol].address);

      const priceTimeInfo = await PriceOracle.getPriceTimeInfo(symbol);
      
      assert.equal(
        priceTimeInfo.price.toString(), 
        newPrice.toString(), 
        `${symbol} price is incorrect`
      );
      assert(priceTimeInfo.timeStamp > 0, `${symbol} timestamp should be valid`);
      assert(priceTimeInfo.timeElapsed >= 0, `${symbol} time elapsed should be non-negative`);
    });
  });
});