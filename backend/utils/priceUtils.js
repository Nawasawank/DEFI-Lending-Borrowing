const axios = require('axios');
const { web3, LendingPoolContract, FaucetABI, InterestModel } = require('../utils/web3.js');
const { getTokenContract } = require('../utils/tokenUtils.js');
const { ethers } = require("ethers");

const coingeckoMap = {
  WETH: "ethereum",
  WBTC: "bitcoin",
  USDC: "usd-coin",
  DAI:  "dai",
  GHO:  "gho"
};

async function fetchTokenPrices(ids) {
  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(',')}&vs_currencies=usd`;
    const response = await axios.get(url);
    return response.data;
  } catch (err) {
    throw new Error('Error fetching prices from CoinGecko: ' + err.message);
  }
}
async function getTotalCollateralUSD(userAddress) {
    const result = await LendingPoolContract.methods.getUserCollateral(userAddress).call();
    const tokenAddresses = result[0];
    const balances = result[1];
  
    let totalUSD = 0;
    const collateralDetails = [];
  
    for (let i = 0; i < tokenAddresses.length; i++) {
      const token = tokenAddresses[i];
      const rawBalance = balances[i];
  
      if (rawBalance === "0") continue;
  
      const tokenContract = getTokenContract(token);
      const [symbol, decimals] = await Promise.all([
        tokenContract.methods.symbol().call(),
        tokenContract.methods.decimals().call()
      ]);
  
      const balance = parseFloat(ethers.formatUnits(rawBalance.toString(), decimals));
      if (balance > 0 && coingeckoMap[symbol]) {
        const prices = await fetchTokenPrices([coingeckoMap[symbol]]);
        const price = prices[coingeckoMap[symbol]]?.usd || 0;
        const valueUSD = balance * price;
  
        totalUSD += valueUSD;
  
        collateralDetails.push({
          symbol,
          balance: balance.toFixed(4),
          priceUSD: price.toFixed(2),
          valueUSD: valueUSD.toFixed(2)
        });
      }
    }
  
    return {
      user: userAddress,
      totalCollateralUSD: totalUSD.toFixed(2),
      collateral: collateralDetails
    };
  }
  

module.exports = {
  fetchTokenPrices,
  coingeckoMap,
  getTotalCollateralUSD
};
