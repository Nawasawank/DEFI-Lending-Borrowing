const { MultiPriceContract } = require('../utils/web3');

const PriceController = {
    async getLatestPrice(req, res) {
        try {
          const symbol = req.params.symbol.toUpperCase();
          const price = await MultiPriceContract.methods.getLatestPrice(symbol).call();
    
          res.status(200).json({
            message: `Price for ${symbol}`,
            symbol,
            price: price.toString() // ✅ convert BigInt to string
          });
        } catch (err) {
          console.error('Error fetching price:', err);
          res.status(500).json({ error: 'Failed to fetch price' });
        }
      }
};

module.exports = PriceController;
