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

  const tokenInfo = {
    WETH: { 
      address: "0x8972C2732c13f64Cc7F570A0aD94be1002523129", 
      coingecko: "ethereum" 
    },
    WBTC: { 
      address: "0xa602B1E1179A78f7b54B57c5e9d002aA5cfe9160", 
      coingecko: "bitcoin" 
    },
    USDC: { 
      address: "0x12f1908774f1D11386A49D580dE1016584F14681", 
      coingecko: "usd-coin" 
    },
    DAI: { 
      address: "0x11987301E37b02c541ED415eF49379B7090Ecc05", 
      coingecko: "dai" 
    },
    GHO: { 
      address: "0x355eB89581a9f7adA0798F5a2182065B12B8ED6B", 
      coingecko: "gho" 
    }
  };
  
  async function getTotalBorrowedUSD(symbol, assetAddress) {
    if (!coingeckoMap[symbol]) {
      throw new Error(`CoinGecko ID not found for symbol: ${symbol}`);
    }
  
    const tokenContract = getTokenContract(assetAddress);
    const [decimalsRaw, tokenState] = await Promise.all([
      tokenContract.methods.decimals().call(),
      LendingPoolContract.methods.tokenState(assetAddress).call()
    ]);
  
    const decimals = Number(decimalsRaw);
    const totalBorrows = ethers.formatUnits(tokenState.totalBorrows.toString(), decimals);
  
    const priceMap = await fetchTokenPrices([coingeckoMap[symbol]]);
    const price = priceMap[coingeckoMap[symbol]]?.usd || 0;
    const valueUSD = parseFloat(totalBorrows) * price;
  
    // console.log(`📊 Total Borrowed for ${symbol}:`);
    // console.log(`   → Token Amount: ${totalBorrows}`);
    // console.log(`   → Price (USD): $${price}`);
    // console.log(`   → Total Value (USD): $${valueUSD.toFixed(2)}`);
  
    return {
      totalBorrowedUSD: valueUSD.toFixed(2),
      borrowed: [{
        symbol,
        borrowed: parseFloat(totalBorrows).toFixed(4),
        priceUSD: price.toFixed(2),
        valueUSD: valueUSD.toFixed(2)
      }]
    };
  }
  
  
  
  
  
  
  
  

module.exports = {
  fetchTokenPrices,
  coingeckoMap,
  getTotalCollateralUSD,
  getTotalBorrowedUSD
};
