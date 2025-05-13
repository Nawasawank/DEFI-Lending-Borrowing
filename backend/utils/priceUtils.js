const axios = require('axios');
const { LendingPoolContract } = require('../utils/web3.js');
const { getTokenContract } = require('../utils/tokenUtils.js');
const { ethers } = require("ethers");

const coingeckoMap = {
  WETH: "WETH",
  WBTC: "WBTC",
  USDC: "USDC",
  DAI:  "DAI",
  GHO:  "GHO"
};

// Fetch prices for multiple tokens from CoinMarketCap
async function fetchTokenPrices(symbols) {
  if (!symbols || symbols.length === 0) return {};

  try {
    const uniqueSymbols = [...new Set(symbols.map(s => s.toUpperCase()))];
    const url = `https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=${uniqueSymbols.join(',')}&convert=USD`;

    const response = await axios.get(url, {
      headers: { 'X-CMC_PRO_API_KEY': process.env.CMC_API_KEY },
      timeout: 5000,
      validateStatus: (status) => status < 500
    });

    const data = response.data.data;
    const result = {};

    for (const symbol of uniqueSymbols) {
      const price = data[symbol]?.quote?.USD?.price;
      if (typeof price === 'number') {
        result[symbol] = { usd: price };
      }
    }

    return result;
  } catch (err) {
    console.error("CoinMarketCap API error:", err.message);
    return {};
  }
}

// Map token address → symbol and fetch all prices once
async function getTokenSymbolMap(tokenAddresses) {
  const symbolMap = {};
  for (const token of tokenAddresses) {
    const tokenContract = getTokenContract(token);
    const symbol = await tokenContract.methods.symbol().call();
    symbolMap[token] = symbol;
  }
  return symbolMap;
}

// Calculate total collateral in USD
async function getTotalCollateralUSD(userAddress) {
  const result = await LendingPoolContract.methods.getUserCollateral(userAddress).call();
  const tokenAddresses = result[0];
  const balances = result[1];

  const symbolMap = await getTokenSymbolMap(tokenAddresses);
  const symbols = Object.values(symbolMap).map(sym => coingeckoMap[sym]).filter(Boolean);
  const priceMap = await fetchTokenPrices(symbols);

  let totalUSD = 0;
  const collateralDetails = [];

  for (let i = 0; i < tokenAddresses.length; i++) {
    const token = tokenAddresses[i];
    const rawBalance = balances[i];
    if (rawBalance === "0") continue;

    const symbol = symbolMap[token];
    const tokenContract = getTokenContract(token);
    const decimals = await tokenContract.methods.decimals().call();

    const balance = parseFloat(ethers.formatUnits(rawBalance.toString(), decimals));
    const price = priceMap[coingeckoMap[symbol]]?.usd || 0;
    const valueUSD = balance * price;

    totalUSD += valueUSD;
    collateralDetails.push({
      symbol,
      balance: balance.toFixed(4),
      priceUSD: price.toFixed(2),
      valueUSD: valueUSD.toFixed(2)
    });
  }

  return {
    user: userAddress,
    totalCollateralUSD: totalUSD.toFixed(2),
    collateral: collateralDetails
  };
}

// Calculate total borrowed in USD
async function getTotalBorrowedUSD(userAddress) {
  const result = await LendingPoolContract.methods.getUserBorrow(userAddress).call();
  const tokenAddresses = result[0];
  const borrowedAmounts = result[1];

  const symbolMap = await getTokenSymbolMap(tokenAddresses);
  const symbols = Object.values(symbolMap).map(sym => coingeckoMap[sym]).filter(Boolean);
  const priceMap = await fetchTokenPrices(symbols);

  let totalUSD = 0;
  const borrowedDetails = [];

  for (let i = 0; i < tokenAddresses.length; i++) {
    const token = tokenAddresses[i];
    const rawBorrowed = borrowedAmounts[i];
    if (rawBorrowed === "0") continue;

    const symbol = symbolMap[token];
    const tokenContract = getTokenContract(token);
    const decimals = await tokenContract.methods.decimals().call();

    const borrowed = parseFloat(ethers.formatUnits(rawBorrowed.toString(), decimals));
    const price = priceMap[coingeckoMap[symbol]]?.usd || 0;
    const valueUSD = borrowed * price;

    totalUSD += valueUSD;
    borrowedDetails.push({
      symbol,
      borrowed: borrowed.toFixed(4),
      priceUSD: price.toFixed(2),
      valueUSD: valueUSD.toFixed(2)
    });
  }

  return {
    user: userAddress,
    totalBorrowedUSD: totalUSD.toFixed(2),
    borrowed: borrowedDetails
  };
}

// Get prices formatted for smart contract use (in 18 decimals)
async function getTokenPricesForHealthFactor(supportedTokens) {
  const symbolMap = await getTokenSymbolMap(supportedTokens);
  const symbols = Object.values(symbolMap).map(sym => coingeckoMap[sym]).filter(Boolean);
  const priceMap = await fetchTokenPrices(symbols);

  const prices = supportedTokens.map(token => {
    const sym = symbolMap[token];
    const price = priceMap[coingeckoMap[sym]]?.usd || 0;
    return price * 1e18; // return as raw number in 18 decimals
  });

  return prices;
}

// For single-token lookups
async function getTokenPriceUSD(tokenAddress) {
  const tokenContract = getTokenContract(tokenAddress);
  const symbol = await tokenContract.methods.symbol().call();

  if (coingeckoMap[symbol]) {
    const prices = await fetchTokenPrices([coingeckoMap[symbol]]);
    return prices[coingeckoMap[symbol]]?.usd || 0;
  }

  return 0;
}

module.exports = {
  fetchTokenPrices,
  coingeckoMap,
  getTotalCollateralUSD,
  getTotalBorrowedUSD,
  getTokenPriceUSD,
  getTokenPricesForHealthFactor
};
