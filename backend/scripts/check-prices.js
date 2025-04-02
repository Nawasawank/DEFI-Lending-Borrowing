const MultiPriceConsumer = artifacts.require("MultiPriceConsumer");

module.exports = async function (callback) {
  try {
    console.log("\n===== Real Chainlink Price Data =====");

    // Get the deployed contract
    const priceConsumer = await MultiPriceConsumer.deployed();
    console.log(`Using contract at: ${priceConsumer.address}`);

    // Tokens to check
    const tokens = ["ETH", "BTC", "USDC", "DAI", "GHO"];

    console.log("\nCurrent Prices with Timestamps:");
    console.log("---------------------------------");

    for (const symbol of tokens) {
      try {
        const description = await priceConsumer.getDescription(symbol);
        const decimals = await priceConsumer.getDecimals(symbol);

        const { price: rawPrice, updatedAt } = await priceConsumer.getLatestPriceAndTimestamp(symbol);
        const priceInUSD = await priceConsumer.getPriceInUSD(symbol);

        const formattedPrice = (priceInUSD / 100).toFixed(2);
        const dateStr = new Date(updatedAt * 1000).toISOString();

        console.log(`${symbol}: $${formattedPrice} (${description})`);
        console.log(`  Raw Oracle Value: ${rawPrice.toString()}`);
        console.log(`  Decimals: ${decimals}`);
        console.log(`  Last Updated At: ${dateStr}`);
        console.log("---------------------------------");
      } catch (error) {
        console.log(`${symbol}: Error fetching price - ${error.message}`);
        console.log("---------------------------------");
      }
    }

    callback();
  } catch (error) {
    console.error(`Error: ${error.message}`);
    callback(error);
  }
};
