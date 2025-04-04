const { PriceOracleContract } = require('../utils/web3');

const PriceController = {
  async getAllLatestPrices(req, res) {
    try {
      const symbols = ['ETH', 'BTC', 'USDC', 'DAI', 'GHO'];

      const results = {};
      for (const symbol of symbols) {
        const price = await PriceOracleContract.methods.getLatestPrice(symbol).call();
        results[symbol] = price.toString();
      }

      res.status(200).json({
        message: 'All prices fetched successfully',
        prices: results
      });
    } catch (err) {
      console.error('Error fetching all prices:', err);
      res.status(500).json({ error: 'Failed to fetch all prices' });
    }
  },
};

module.exports = PriceController;
