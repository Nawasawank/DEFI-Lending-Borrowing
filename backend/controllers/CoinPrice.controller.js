const axios = require('axios');

const CoinController = {
  async getPrices(req, res) {
    try {
      const url = 'https://api.coingecko.com/api/v3/simple/price?ids=ethereum,bitcoin,usd-coin,dai,gho&vs_currencies=usd';
      const response = await axios.get(url);

      const prices = {
        ETH: response.data.ethereum.usd,
        BTC: response.data.bitcoin.usd,
        USDC: response.data['usd-coin'].usd,
        DAI: response.data.dai.usd,
        GHO: response.data.gho.usd
      };

      res.status(200).json({
        message: 'Live coin prices (USD)',
        prices
      });
    } catch (error) {
      console.error(`Failed to fetch coin prices: ${error.message}`);
      res.status(500).json({ error: 'Failed to fetch coin prices' });
    }

  },
  
};

module.exports = CoinController;
