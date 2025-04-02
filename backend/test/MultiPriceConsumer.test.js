// const MultiPriceConsumer = artifacts.require("MultiPriceConsumer");
const MockV3Aggregator = artifacts.require("MockV3Aggregator");
const MultiPriceConsumer = artifacts.require("MultiPriceConsumer");

contract("MultiPriceConsumer", accounts => {
  const [owner, user1, user2] = accounts;
  let multiPriceConsumer;
  let ethMockPriceFeed;
  let wbtcMockPriceFeed;
  let usdcMockPriceFeed;
  let usdtMockPriceFeed;
  let daiMockPriceFeed;
  
  // Common test values
  const DECIMALS = 8;
  const ETH_PRICE = 450000000000;   // $4,500 with 8 decimals
  const WBTC_PRICE = 6000000000000; // $60,000 with 8 decimals
  const USDC_PRICE = 100000000;     // $1.00 with 8 decimals
  const USDT_PRICE = 100000000;     // $1.00 with 8 decimals
  const DAI_PRICE = 99800000;       // $0.998 with 8 decimals

  before(async () => {
    // Deploy MultiPriceConsumer
    multiPriceConsumer = await MultiPriceConsumer.new();
    
    // Deploy mock price feeds for each token
    ethMockPriceFeed = await MockV3Aggregator.new(DECIMALS, ETH_PRICE, "ETH / USD");
    wbtcMockPriceFeed = await MockV3Aggregator.new(DECIMALS, WBTC_PRICE, "WBTC / USD");
    usdcMockPriceFeed = await MockV3Aggregator.new(DECIMALS, USDC_PRICE, "USDC / USD");
    usdtMockPriceFeed = await MockV3Aggregator.new(DECIMALS, USDT_PRICE, "USDT / USD");
    daiMockPriceFeed = await MockV3Aggregator.new(DECIMALS, DAI_PRICE, "DAI / USD");
    
    // Set price feeds in the consumer
    await multiPriceConsumer.setPriceFeed("ETH", ethMockPriceFeed.address);
    await multiPriceConsumer.setPriceFeed("WBTC", wbtcMockPriceFeed.address);
    await multiPriceConsumer.setPriceFeed("USDC", usdcMockPriceFeed.address);
    await multiPriceConsumer.setPriceFeed("USDT", usdtMockPriceFeed.address);
    await multiPriceConsumer.setPriceFeed("DAI", daiMockPriceFeed.address);
  });

  describe("Price Feed Setup", () => {
    it("should correctly store price feed addresses", async () => {
      const ethFeedAddress = await multiPriceConsumer.priceFeeds("ETH");
      const wbtcFeedAddress = await multiPriceConsumer.priceFeeds("WBTC");
      const usdcFeedAddress = await multiPriceConsumer.priceFeeds("USDC");
      const usdtFeedAddress = await multiPriceConsumer.priceFeeds("USDT");
      const daiFeedAddress = await multiPriceConsumer.priceFeeds("DAI");
      
      assert.equal(ethFeedAddress, ethMockPriceFeed.address, "ETH price feed address not stored correctly");
      assert.equal(wbtcFeedAddress, wbtcMockPriceFeed.address, "WBTC price feed address not stored correctly");
      assert.equal(usdcFeedAddress, usdcMockPriceFeed.address, "USDC price feed address not stored correctly");
      assert.equal(usdtFeedAddress, usdtMockPriceFeed.address, "USDT price feed address not stored correctly");
      assert.equal(daiFeedAddress, daiMockPriceFeed.address, "DAI price feed address not stored correctly");
    });
    
    it("should emit PriceFeedUpdated event when setting a price feed", async () => {
      const newMockFeed = await MockV3Aggregator.new(DECIMALS, ETH_PRICE, "NEW / USD");
      
      const tx = await multiPriceConsumer.setPriceFeed("NEW", newMockFeed.address);
      
      // Check for the event
      assert.equal(tx.logs[0].event, "PriceFeedUpdated", "PriceFeedUpdated event was not emitted");
      assert.equal(tx.logs[0].args.symbol, "NEW", "Symbol in event is incorrect");
      assert.equal(tx.logs[0].args.feedAddress, newMockFeed.address, "Feed address in event is incorrect");
    });
    
    it("should allow updating an existing price feed", async () => {
      const updatedMockFeed = await MockV3Aggregator.new(DECIMALS, ETH_PRICE * 2, "ETH / USD");
      
      await multiPriceConsumer.setPriceFeed("ETH", updatedMockFeed.address);
      const storedAddress = await multiPriceConsumer.priceFeeds("ETH");
      
      assert.equal(storedAddress, updatedMockFeed.address, "ETH price feed address not updated correctly");
    });
  });

  describe("Price Data Retrieval", () => {
    before(async () => {
      // Reset ETH price feed to the original one
      await multiPriceConsumer.setPriceFeed("ETH", ethMockPriceFeed.address);
    });
    
    it("should get the latest price for each token", async () => {
      const ethPrice = await multiPriceConsumer.getLatestPrice("ETH");
      const wbtcPrice = await multiPriceConsumer.getLatestPrice("WBTC");
      const usdcPrice = await multiPriceConsumer.getLatestPrice("USDC");
      const usdtPrice = await multiPriceConsumer.getLatestPrice("USDT");
      const daiPrice = await multiPriceConsumer.getLatestPrice("DAI");
      
      assert.equal(ethPrice.toString(), ETH_PRICE.toString(), "ETH price is incorrect");
      assert.equal(wbtcPrice.toString(), WBTC_PRICE.toString(), "WBTC price is incorrect");
      assert.equal(usdcPrice.toString(), USDC_PRICE.toString(), "USDC price is incorrect");
      assert.equal(usdtPrice.toString(), USDT_PRICE.toString(), "USDT price is incorrect");
      assert.equal(daiPrice.toString(), DAI_PRICE.toString(), "DAI price is incorrect");
    });
    
    it("should get the correct decimals for each token", async () => {
      const ethDecimals = await multiPriceConsumer.getDecimals("ETH");
      const wbtcDecimals = await multiPriceConsumer.getDecimals("WBTC");
      const usdcDecimals = await multiPriceConsumer.getDecimals("USDC");
      
      assert.equal(ethDecimals.toString(), DECIMALS.toString(), "ETH decimals is incorrect");
      assert.equal(wbtcDecimals.toString(), DECIMALS.toString(), "WBTC decimals is incorrect");
      assert.equal(usdcDecimals.toString(), DECIMALS.toString(), "USDC decimals is incorrect");
    });
    
    it("should get the correct description for each token", async () => {
      const ethDescription = await multiPriceConsumer.getDescription("ETH");
      const wbtcDescription = await multiPriceConsumer.getDescription("WBTC");
      const usdcDescription = await multiPriceConsumer.getDescription("USDC");
      
      assert.equal(ethDescription, "ETH / USD", "ETH description is incorrect");
      assert.equal(wbtcDescription, "WBTC / USD", "WBTC description is incorrect");
      assert.equal(usdcDescription, "USDC / USD", "USDC description is incorrect");
    });
    
    it("should calculate correct USD prices with 2 decimal places", async () => {
      const ethUsdPrice = await multiPriceConsumer.getPriceInUSD("ETH");
      const wbtcUsdPrice = await multiPriceConsumer.getPriceInUSD("WBTC");
      const usdcUsdPrice = await multiPriceConsumer.getPriceInUSD("USDC");
      const daiUsdPrice = await multiPriceConsumer.getPriceInUSD("DAI");
      
      const expectedEthPrice = ETH_PRICE / (10 ** (DECIMALS - 2));
      const expectedWbtcPrice = WBTC_PRICE / (10 ** (DECIMALS - 2));
      const expectedUsdcPrice = USDC_PRICE / (10 ** (DECIMALS - 2));
      const expectedDaiPrice = DAI_PRICE / (10 ** (DECIMALS - 2));
      
      assert.equal(ethUsdPrice.toString(), expectedEthPrice.toString(), "ETH USD price is incorrect");
      assert.equal(wbtcUsdPrice.toString(), expectedWbtcPrice.toString(), "WBTC USD price is incorrect");
      assert.equal(usdcUsdPrice.toString(), expectedUsdcPrice.toString(), "USDC USD price is incorrect");
      assert.equal(daiUsdPrice.toString(), expectedDaiPrice.toString(), "DAI USD price is incorrect");
      
      // Human-readable price checks (these are commented out and just for reference)
      // ETH: $4,500.00
      // WBTC: $60,000.00
      // USDC: $1.00
      // DAI: $0.99
      console.log(`ETH price: $${(ethUsdPrice / 100).toFixed(2)}`);
      console.log(`WBTC price: $${(wbtcUsdPrice / 100).toFixed(2)}`);
      console.log(`USDC price: $${(usdcUsdPrice / 100).toFixed(2)}`);
      console.log(`DAI price: $${(daiUsdPrice / 100).toFixed(2)}`);
    });
  });

  describe("Error Handling", () => {
    it("should revert when getting price for non-existent token", async () => {
      try {
        await multiPriceConsumer.getLatestPrice("NON_EXISTENT");
        assert.fail("Expected to revert but it didn't");
      } catch (error) {
        assert(error.message.includes("Price feed not set"), 
               `Expected "Price feed not set" but got: ${error.message}`);
      }
    });
    
    it("should revert when getting decimals for non-existent token", async () => {
      try {
        await multiPriceConsumer.getDecimals("NON_EXISTENT");
        assert.fail("Expected to revert but it didn't");
      } catch (error) {
        assert(error.message.includes("Price feed not set"), 
               `Expected "Price feed not set" but got: ${error.message}`);
      }
    });
    
    it("should revert when getting description for non-existent token", async () => {
      try {
        await multiPriceConsumer.getDescription("NON_EXISTENT");
        assert.fail("Expected to revert but it didn't");
      } catch (error) {
        assert(error.message.includes("Price feed not set"), 
               `Expected "Price feed not set" but got: ${error.message}`);
      }
    });
    
    it("should revert when getting USD price for non-existent token", async () => {
      try {
        await multiPriceConsumer.getPriceInUSD("NON_EXISTENT");
        assert.fail("Expected to revert but it didn't");
      } catch (error) {
        assert(error.message.includes("Price feed not set"), 
               `Expected "Price feed not set" but got: ${error.message}`);
      }
    });
  });

  describe("Price Updates", () => {
    it("should reflect price updates from the oracle", async () => {
      // Update ETH price in the mock
      const NEW_ETH_PRICE = 480000000000; // $4,800 with 8 decimals
      await ethMockPriceFeed.updateAnswer(NEW_ETH_PRICE);
      
      // Get updated price
      const updatedPrice = await multiPriceConsumer.getLatestPrice("ETH");
      assert.equal(updatedPrice.toString(), NEW_ETH_PRICE.toString(), "Updated ETH price not reflected");
      
      // Check USD conversion
      const updatedUsdPrice = await multiPriceConsumer.getPriceInUSD("ETH");
      const expectedUpdatedUsdPrice = NEW_ETH_PRICE / (10 ** (DECIMALS - 2));
      assert.equal(updatedUsdPrice.toString(), expectedUpdatedUsdPrice.toString(), "Updated ETH USD price is incorrect");
    });
    
    it("should handle multiple price updates", async () => {
      // Update all token prices
      await ethMockPriceFeed.updateAnswer(500000000000);  // $5,000
      await wbtcMockPriceFeed.updateAnswer(6500000000000); // $65,000
      await usdcMockPriceFeed.updateAnswer(99900000);     // $0.999
      await daiMockPriceFeed.updateAnswer(101000000);     // $1.01
      
      // Check ETH
      const ethPrice = await multiPriceConsumer.getLatestPrice("ETH");
      assert.equal(ethPrice.toString(), "500000000000", "ETH price update not reflected");
      
      // Check WBTC
      const wbtcPrice = await multiPriceConsumer.getLatestPrice("WBTC");
      assert.equal(wbtcPrice.toString(), "6500000000000", "WBTC price update not reflected");
      
      // Check USDC
      const usdcPrice = await multiPriceConsumer.getLatestPrice("USDC");
      assert.equal(usdcPrice.toString(), "99900000", "USDC price update not reflected");
      
      // Check DAI
      const daiPrice = await multiPriceConsumer.getLatestPrice("DAI");
      assert.equal(daiPrice.toString(), "101000000", "DAI price update not reflected");
    });
  });

  describe("Token Price Comparison", () => {
    it("should show correct relative prices between tokens", async () => {
      // Reset to clean values for this test
      await ethMockPriceFeed.updateAnswer(450000000000);   // $4,500
      await wbtcMockPriceFeed.updateAnswer(6000000000000); // $60,000
      await usdcMockPriceFeed.updateAnswer(100000000);     // $1.00
      await daiMockPriceFeed.updateAnswer(100000000);      // $1.00
      
      const ethUsdPrice = await multiPriceConsumer.getPriceInUSD("ETH");
      const wbtcUsdPrice = await multiPriceConsumer.getPriceInUSD("WBTC");
      const usdcUsdPrice = await multiPriceConsumer.getPriceInUSD("USDC");
      const daiUsdPrice = await multiPriceConsumer.getPriceInUSD("DAI");
      
      // ETH to WBTC ratio (1 WBTC should be worth 13.33... ETH)
      const ethToWbtcRatio = wbtcUsdPrice.toNumber() / ethUsdPrice.toNumber();
      assert.approximately(ethToWbtcRatio, 13.33, 0.01, "ETH to WBTC ratio is incorrect");
      
      // 1 ETH should be worth 4500 USDC
      const ethToUsdcRatio = ethUsdPrice.toNumber() / usdcUsdPrice.toNumber();
      assert.approximately(ethToUsdcRatio, 4500, 1, "ETH to USDC ratio is incorrect");
      
      // USDC and DAI should be approximately equal
      const usdcToDaiRatio = usdcUsdPrice.toNumber() / daiUsdPrice.toNumber();
      assert.approximately(usdcToDaiRatio, 1, 0.01, "USDC to DAI ratio is incorrect");
    });
  });
  
  // The following tests demonstrate common use cases
  describe("Use Cases", () => {
    it("should calculate how much ETH can be purchased with a given USD amount", async () => {
      // Using the formula: ETH amount = USD amount / ETH price in USD
      const usdAmount = 10000; // $10,000
      const ethUsdPrice = await multiPriceConsumer.getPriceInUSD("ETH");
      const ethAmount = (usdAmount * 100) / ethUsdPrice.toNumber(); // Multiply by 100 because price has 2 decimals
      
      // Expected amount of ETH for $10,000 when ETH is $4,500
      const expectedEthAmount = 10000 / 4500;
      
      assert.approximately(ethAmount, expectedEthAmount, 0.001, "ETH calculation is incorrect");
      console.log(`$${usdAmount} can buy approximately ${ethAmount.toFixed(4)} ETH at current prices`);
    });
    
    it("should calculate conversion between WBTC and ETH based on USD prices", async () => {
      // Using the formula: WBTC amount = ETH amount * (ETH price / WBTC price)
      const ethAmount = 10; // 10 ETH
      const ethUsdPrice = await multiPriceConsumer.getPriceInUSD("ETH");
      const wbtcUsdPrice = await multiPriceConsumer.getPriceInUSD("WBTC");
      
      // Convert 10 ETH to WBTC
      const wbtcAmount = ethAmount * (ethUsdPrice.toNumber() / wbtcUsdPrice.toNumber());
      
      // Expected result: 10 ETH * ($4,500 / $60,000) = 0.75 WBTC
      assert.approximately(wbtcAmount, 0.75, 0.01, "ETH to WBTC conversion is incorrect");
      console.log(`${ethAmount} ETH is worth approximately ${wbtcAmount.toFixed(4)} WBTC at current prices`);
    });
  });
});