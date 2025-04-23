const axios = require('axios');
const { web3, LendingPoolContract, FaucetABI, InterestModel } = require('../utils/web3.js');
const { getTokenContract } = require('../utils/tokenUtils.js');
const { ethers } = require("ethers");

const coingeckoMap = {
  WETH: "WETH",
  WBTC: "WBTC",
  USDC: "USDC",
  DAI:  "DAI",
  GHO:  "GHO"
};

async function fetchTokenPrices(symbols) {
  if (!symbols || symbols.length === 0) {
    return {};
  }

  try {
    const symbolParam = symbols.join(',').toUpperCase(); // CMC expects uppercase
    const url = `https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=${symbolParam}&convert=USD`;

    const response = await axios.get(url, {
      headers: {
        'X-CMC_PRO_API_KEY': process.env.CMC_API_KEY
      },
      timeout: 5000,
      validateStatus: (status) => status < 500 // reject only server errors
    });

    const data = response.data.data;
    const result = {};

    for (const symbol of symbols) {
      const entry = data[symbol.toUpperCase()];
      const price = entry?.quote?.USD?.price;
      if (typeof price === 'number') {
        result[symbol] = { usd: price };
      } else {
        console.warn(`⚠️ Price not found for ${symbol}`);
      }
    }

    return result;
  } catch (err) {
    console.error("❌ CoinMarketCap API error:", err.message);
    throw new Error("Error fetching prices from CoinMarketCap: " + err.message);
  }
}

async function getTokenPriceUSD(tokenAddress) {
  const tokenContract = getTokenContract(tokenAddress);
  const symbol = await tokenContract.methods.symbol().call();

  if (coingeckoMap[symbol]) {
    const prices = await fetchTokenPrices([coingeckoMap[symbol]]);
    return prices[coingeckoMap[symbol]]?.usd || 0;
  }

  return 0; // Default to 0 if price not found
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
  
  async function getTotalBorrowedUSD(userAddress) {
    const result = await LendingPoolContract.methods.getUserBorrow(userAddress).call();
    const tokenAddresses = result[0];
    const borrowedAmounts = result[1];
  
    let totalUSD = 0;
    const borrowedDetails = [];
  
    for (let i = 0; i < tokenAddresses.length; i++) {
      const token = tokenAddresses[i];
      const rawBorrowed = borrowedAmounts[i];
      if (rawBorrowed === "0") continue;
  
      const tokenContract = getTokenContract(token);
      const [symbol, decimals] = await Promise.all([
        tokenContract.methods.symbol().call(),
        tokenContract.methods.decimals().call()
      ]);
  
      const borrowed = parseFloat(ethers.formatUnits(rawBorrowed.toString(), decimals));
      if (borrowed > 0 && coingeckoMap[symbol]) {
        const prices = await fetchTokenPrices([coingeckoMap[symbol]]);
        const price = prices[coingeckoMap[symbol]]?.usd || 0;
        const valueUSD = borrowed * price;
  
        totalUSD += valueUSD;
        borrowedDetails.push({
          symbol,
          borrowed: borrowed.toFixed(4),
          priceUSD: price.toFixed(2),
          valueUSD: valueUSD.toFixed(2)
        });
      }
    }
  
    return {
      user: userAddress,
      totalBorrowedUSD: totalUSD.toFixed(2),
      borrowed: borrowedDetails
    };
  }
  
async function getTokenPricesForHealthFactor(supportedTokens) {
    const prices = [];
    for (const token of supportedTokens) {
        const priceUSD = await getTokenPriceUSD(token);
        prices.push(priceUSD * 1e18); // Convert to 18 decimals
    }
    return prices;
}

module.exports = {
  fetchTokenPrices,
  coingeckoMap,
  getTotalCollateralUSD,
  getTotalBorrowedUSD,
  getTokenPriceUSD, // Export the new function
  getTokenPricesForHealthFactor
};