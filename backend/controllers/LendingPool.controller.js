require('dotenv').config();
const { ethers } = require("ethers");
const { web3, LendingPoolContract, TokenABI, FaucetABI,InterestModel } = require('../utils/web3.js');
const { isAddress } = require('web3-validator');

const faucetMap = {
  "0x4c2E62C5CA71831C890319C408cBf7175fFd5e4C": "0x7E49Eb0dAE89235a13a46a1536D46cBcD312FAA1", // WETH
  "0x81e6E6809F07e5689171325d9dF8e479AD5aBA8a": "0xADb888AB2D7acBAed215B0f8C46Fba628576A9D2", // WBTC
  "0x42E990Dd43De1e6aD4aC791071184A96f0842025": "0xC531e1B9BBc4390179FC902FF1E020a077784F3B", // USDC
  "0xC4fE726aeBEa29257e30c4746Aa93EEd8489971e": "0xEFEA93928b50E01f3392C18A8972f9370F7b611f", // DAI
  "0x40dE9BDc40Fbf0617744dE293019b8bdD2d3782C": "0x5C0163Dc47173ed0f660302d54e9A2019484B608"  // GHO
};



function getTokenContract(assetAddress) {
  return new web3.eth.Contract(TokenABI.abi, assetAddress);
}
const DEFAULT_DECIMALS = 18;

const LendingController = {
  async deposit(req, res) {
    try {
      const { fromAddress, assetAddress, amount } = req.body;

      if (!isAddress(fromAddress) || !isAddress(assetAddress))
        return res.status(400).json({ error: 'Invalid address' });
      if (isNaN(amount) || Number(amount) <= 0)
        return res.status(400).json({ error: 'Invalid amount' });

      const amountInSmallestUnit = ethers.parseUnits(amount.toString(), DEFAULT_DECIMALS).toString();
      const tokenContract = getTokenContract(assetAddress);
      let tokenBalance = await tokenContract.methods.balanceOf(fromAddress).call();
      console.log("This is toekn balance: ", tokenBalance);
      
      const hasEnoughTokens = BigInt(tokenBalance) >= BigInt(amountInSmallestUnit);
      const canUseFaucet = !hasEnoughTokens && faucetMap[assetAddress] && BigInt(tokenBalance) === 0n;
      
      if (canUseFaucet) {
        try {
          const faucetContract = new web3.eth.Contract(FaucetABI.abi, faucetMap[assetAddress]);
          const gasEstimate = await faucetContract.methods.claimTokens().estimateGas({ from: fromAddress });
          await faucetContract.methods.claimTokens().send({ 
            from: fromAddress,
            gas: Math.ceil(Number(gasEstimate) * 1.5)
          });
          
          tokenBalance = await tokenContract.methods.balanceOf(fromAddress).call();
        } catch (faucetErr) {
          return res.status(500).json({ 
            error: 'Faucet claim failed', 
            details: faucetErr.message,
            suggestion: "The faucet may be empty or you may have already claimed tokens"
          });
        }
      }

      if (BigInt(tokenBalance) < BigInt(amountInSmallestUnit))
        return res.status(400).json({ 
          error: 'Insufficient balance', 
          available: ethers.formatUnits(tokenBalance, DEFAULT_DECIMALS),
          required: amount,
          sufficient: false
        });

      const allowance = await tokenContract.methods
        .allowance(fromAddress, LendingPoolContract.options.address)
        .call();

      if (BigInt(allowance) < BigInt(amountInSmallestUnit)) {
        try {
          const gasEstimate = await tokenContract.methods
            .approve(LendingPoolContract.options.address, amountInSmallestUnit)
            .estimateGas({ from: fromAddress });
          
          await tokenContract.methods
            .approve(LendingPoolContract.options.address, amountInSmallestUnit)
            .send({ from: fromAddress, gas: Math.ceil(Number(gasEstimate) * 1.5) });
        } catch (approveErr) {
          return res.status(500).json({ 
            error: 'Approval failed', 
            details: approveErr.message
          });
        }
      }
      
      try {
        const gasEstimate = await LendingPoolContract.methods
          .deposit(assetAddress, amountInSmallestUnit)
          .estimateGas({ from: fromAddress });
        
        const depositTx = await LendingPoolContract.methods
          .deposit(assetAddress, amountInSmallestUnit)
          .send({ from: fromAddress, gas: Math.ceil(Number(gasEstimate) * 1.5) });
        
        return res.status(200).json({
          message: 'Deposit successful',
          transactionHash: depositTx.transactionHash,
          amount,
          token: assetAddress,
          sufficient: true
        });
      } catch (depositErr) {
        return res.status(500).json({ 
          error: 'Deposit failed', 
          details: depositErr.message 
        });
      }
    } catch (err) {
      return res.status(500).json({ error: 'Process failed', details: err.message });
    }
  },

  async getLenderBalance(req, res) {
    try {
      const { userAddress, assetAddress } = req.body;

      if (!isAddress(userAddress) || !isAddress(assetAddress))
        return res.status(400).json({ error: 'Invalid address' });

      const balance = await LendingPoolContract.methods
        .balanceOf(assetAddress, userAddress)
        .call();

      return res.status(200).json({
        user: userAddress,
        asset: assetAddress,
        balance: ethers.formatUnits(balance, DEFAULT_DECIMALS),
        sufficient: BigInt(balance) > 0
      });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to fetch balance', details: err.message });
    }
  },
  async getAssetConfig(req, res) {
    try {
      const { assetAddress } = req.query;
  
      if (!isAddress(assetAddress))
        return res.status(400).json({ error: 'Invalid token address' });
  
      const [
        supplyCap,
        borrowCap,
        maxLTV,
        liquidationThreshold,
        liquidationPenalty
      ] = await Promise.all([
        LendingPoolContract.methods.supplyCap(assetAddress).call(),
        LendingPoolContract.methods.borrowCap(assetAddress).call(),
        LendingPoolContract.methods.maxLTV(assetAddress).call(),
        LendingPoolContract.methods.liquidationThreshold(assetAddress).call(),
        LendingPoolContract.methods.liquidationPenalty(assetAddress).call()
      ]);
  
      return res.status(200).json({
        asset: assetAddress,
        config: {
          supplyCap: ethers.formatUnits(supplyCap, DEFAULT_DECIMALS),
          borrowCap: ethers.formatUnits(borrowCap, DEFAULT_DECIMALS),
          maxLTV: (Number(maxLTV) / 1000).toFixed(2) + '%',
          liquidationThreshold: (Number(liquidationThreshold) / 1000).toFixed(2) + '%',
          liquidationPenalty: (Number(liquidationPenalty) / 1000).toFixed(2) + '%'
        }
      });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to fetch asset config', details: err.message });
    }
  },
  async withdraw(req, res) {
    try {
      const { fromAddress, assetAddress, amount } = req.body;

      if (!isAddress(fromAddress) || !isAddress(assetAddress))
        return res.status(400).json({ error: 'Invalid address' });

      if (isNaN(amount) || Number(amount) <= 0)
        return res.status(400).json({ error: 'Invalid amount' });

      const amountInSmallestUnit = ethers.parseUnits(amount.toString(), DEFAULT_DECIMALS).toString();

      const currentBalance = await LendingPoolContract.methods
        .balanceOf(assetAddress, fromAddress)
        .call();

      if (BigInt(currentBalance) < BigInt(amountInSmallestUnit)) {
        return res.status(400).json({
          error: 'Insufficient LendingPool balance',
          available: ethers.formatUnits(currentBalance, DEFAULT_DECIMALS),
          required: amount
        });
      }
      const gasEstimate = await LendingPoolContract.methods
        .withdraw(assetAddress, amountInSmallestUnit)
        .estimateGas({ from: fromAddress });

      const tx = await LendingPoolContract.methods
        .withdraw(assetAddress, amountInSmallestUnit)
        .send({ from: fromAddress, gas: Math.ceil(Number(gasEstimate) * 1.5)});

      return res.status(200).json({
        message: 'Withdrawal successful',
        transactionHash: tx.transactionHash,
        withdrawnAmount: amount,
        asset: assetAddress
      });

    } catch (err) {
      return res.status(500).json({ error: 'Withdrawal failed', details: err.message });
    }
  },
  
  async getTotalSupplied(req, res) {
    const { assetAddress } = req.query;

    if (!isAddress(assetAddress)) {
      return res.status(400).json({ error: "Invalid token address" });
    }
  
    try {
      const [tokenState, supplyCap] = await Promise.all([
        LendingPoolContract.methods.tokenState(assetAddress).call(),
        LendingPoolContract.methods.supplyCap(assetAddress).call()
      ]);
  
      const totalSupplied = ethers.formatUnits(tokenState.totalDeposits, DEFAULT_DECIMALS);
      const maxSupply = ethers.formatUnits(supplyCap, DEFAULT_DECIMALS);
  
      const supplied = parseFloat(totalSupplied);
      const cap = parseFloat(maxSupply);
      const utilization = cap === 0 ? 0 : (supplied / cap) * 100;
  
      return res.status(200).json({
        asset: assetAddress,
        reserve: {
          supplied: supplied.toFixed(2) + "M",
          maxSupply: cap.toFixed(2) + "M",
          utilizationRate: utilization.toFixed(2) + "%"
        }
      });
    } catch (err) {
      return res.status(500).json({
        error: "Failed to fetch reserve status",
        details: err.message
      });
    }
  },
  async getUtilizationRate(req, res) {
    try {
      const { asset } = req.query;
  
      if (!isAddress(asset)) {
        return res.status(400).json({ error: 'Invalid asset address' });
      }
  
      // Call the method from LendingPool now instead of InterestModel
      const rate = await LendingPoolContract.methods.getUtilization(asset).call();
      const rateNum = Number(rate); // basis points
  
      return res.status(200).json({
        asset,
        utilizationRate: (rateNum / 100).toFixed(2) + '%', // e.g. 37.56%
        rawBasisPoints: rate.toString() // raw number like 3756
      });
  
    } catch (err) {
      return res.status(500).json({
        error: 'Failed to fetch utilization rate',
        details: err.message
      });
    }
  },
  async getAvailableLiquidity(req, res) {
    try {
      const { assetAddress } = req.query;
  
      if (!isAddress(assetAddress)) {
        return res.status(400).json({ error: 'Invalid token address' });
      }
  
      const tokenState = await LendingPoolContract.methods.tokenState(assetAddress).call();
      const totalDeposits = BigInt(tokenState.totalDeposits);
      const totalBorrows = BigInt(tokenState.totalBorrows);
  
      const available = totalDeposits > totalBorrows ? (totalDeposits - totalBorrows) : 0n;
  
      return res.status(200).json({
        asset: assetAddress,
        availableLiquidity: ethers.formatUnits(available.toString(), DEFAULT_DECIMALS),
        raw: available.toString()
      });
  
    } catch (err) {
      return res.status(500).json({
        error: 'Failed to fetch available liquidity',
        details: err.message
      });
    }
  },
  async getUserTokenBalances(req, res) {
    try {
      const { userAddress } = req.query;
  
      if (!isAddress(userAddress)) {
        return res.status(400).json({ error: "Invalid user address" });
      }
  
      const results = [];
  
      for (const [tokenAddress, _faucet] of Object.entries(faucetMap)) {
        const tokenContract = getTokenContract(tokenAddress);
        const [symbol, decimals, balance] = await Promise.all([
          tokenContract.methods.symbol().call(),
          tokenContract.methods.decimals().call(),
          tokenContract.methods.balanceOf(userAddress).call()
        ]);
  
        results.push({
          symbol,
          tokenAddress,
          balance: ethers.formatUnits(balance.toString(), Number(decimals)),
          raw: balance.toString(),
          decimals: Number(decimals)
        });
        
      }
  
      return res.status(200).json({
        user: userAddress,
        balances: results
      });
  
    } catch (err) {
      return res.status(500).json({
        error: "Failed to fetch token balances",
        details: err.message
      });
    }
  },
  // async getTotalCollateralSupplied(req, res) {
  //   const { userAddress } = req.query;

  //   // Validate user address
  //   if (!isAddress(userAddress)) {
  //     return res.status(400).json({ error: "Invalid user address" });
  //   }

  //   try {
  //     let supportedTokens;
  //     // Try to get supported tokens from the contract if available
  //     try {
  //       supportedTokens = await LendingPoolContract.methods.getSupportedTokens().call();
  //     } catch (tokensErr) {
  //       console.warn("Could not fetch supported tokens, falling back to hardcoded list:", tokensErr.message);
  //       supportedTokens = fallbackSupportedTokens;
  //     }

  //     // Combine CoinGecko IDs for API query
  //     const coinGeckoIds = supportedTokens
  //       .map((token) => tokenToCoingeckoId[token])
  //       .filter((id) => !!id)
  //       .join(',');

  //     // Query CoinGecko for prices in USD
  //     const cgResponse = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coinGeckoIds}&vs_currencies=usd`);
  //     const prices = await cgResponse.json();

  //     let totalCollateralUSD = 0;
  //     const assetDetails = [];

  //     // Loop through each token in the supported list
  //     for (const token of supportedTokens) {
  //       try {
  //         // Get the user's supplied collateral for this token:
  //         // Calling the contract's balanceOf function. (Ensure this is a view function.)
  //         const rawBalance = await LendingPoolContract.methods.balanceOf(token, userAddress).call();
  //         // Format the token balance (assuming DEFAULT_DECIMALS; adjust if needed per asset)
  //         const balanceFormatted = ethers.utils.formatUnits(rawBalance, DEFAULT_DECIMALS);
  //         const balanceNumber = parseFloat(balanceFormatted);

  //         // Look up the CoinGecko ID for the token
  //         const cgId = tokenToCoingeckoId[token];
  //         if (!cgId || !prices[cgId] || !prices[cgId].usd) {
  //           console.warn(`Skipping token ${token} due to missing price data`);
  //           continue;
  //         }

  //         const priceUSD = prices[cgId].usd; // Price in USD for 1 unit of the token
  //         const collateralUSD = balanceNumber * priceUSD;
  //         totalCollateralUSD += collateralUSD;

  //         assetDetails.push({
  //           tokenAddress: token,
  //           symbol: '', // Optionally, fetch and add symbol info from the token contract if desired
  //           balance: balanceFormatted,
  //           priceUSD,
  //           collateralUSD: collateralUSD.toFixed(2),
  //           coingeckoId: cgId,
  //         });
  //       } catch (balanceErr) {
  //         console.warn(`Error fetching balance for token ${token}: ${balanceErr.message}`);
  //         // Continue to next token if one fails
  //       }
  //     }

  //     return res.status(200).json({
  //       user: userAddress,
  //       totalCollateralUSD: totalCollateralUSD.toFixed(2),
  //       assetDetails,
  //     });
  //   } catch (err) {
  //     console.error("Error details:", err);
  //     return res.status(500).json({
  //       error: "Failed to fetch total collateral supplied in USD",
  //       details: err.message
  //     });
  //   }
  // },
  async getSupplyAPY(req, res) {
    try {
      const { assetAddress } = req.query;
  
      if (!isAddress(assetAddress)) {
        return res.status(400).json({ error: 'Invalid token address' });
      }
  
      const utilization = await LendingPoolContract.methods.getUtilization(assetAddress).call();
      const supplyAPY = await InterestModel.methods.getSupplyAPY(assetAddress, utilization).call();
      
      const apyPercentage = (Number(supplyAPY) / 100).toFixed(2);
  
      return res.status(200).json({
        asset: assetAddress,
        supplyAPY: apyPercentage + '%',
        rawBasisPoints: supplyAPY.toString(),
        utilization: (Number(utilization) / 100).toFixed(2) + '%'
      });
    } catch (err) {
      return res.status(500).json({
        error: 'Failed to fetch supply APY',
        details: err.message
      });
    }
  },
  async getUserHistory(req, res) {
    const { userAddress } = req.query;
  
    if (!isAddress(userAddress)) {
      return res.status(400).json({ error: "Invalid user address" });
    }
  
    try {
      const depositEvents = await LendingPoolContract.getPastEvents("Deposit", {
        filter: { lender: userAddress },
        fromBlock: 0,
        toBlock: "latest",
      });
  
      const withdrawEvents = await LendingPoolContract.getPastEvents("Withdraw", {
        filter: { lender: userAddress },
        fromBlock: 0,
        toBlock: "latest",
      });
  
      const allEvents = [...depositEvents, ...withdrawEvents];
  
      const formatted = allEvents.map((e) => ({
        type: e.event,
        token: e.returnValues.token,
        amount: String(ethers.formatUnits(e.returnValues.amount.toString(), 18)),
        txHash: e.transactionHash,
        blockNumber: String(e.blockNumber), // Convert to string immediately
        timestamp: null,
      }));
  
      const provider = new ethers.JsonRpcProvider(process.env.PROVIDER_URL);
  
      for (const tx of formatted) {
        const block = await provider.getBlock(Number(tx.blockNumber)); 
        tx.timestamp = block.timestamp.toString();
      }
  
      // Sort using string comparison or convert back to numbers temporarily
      formatted.sort((a, b) => Number(b.blockNumber) - Number(a.blockNumber));
  
      return res.status(200).json({
        user: userAddress,
        history: formatted,
      });
  
    } catch (err) {
      return res.status(500).json({
        error: "Failed to fetch transaction history",
        details: err.message,
      });
    }
  },
  async getAPRHistory(req, res) {
    try {
      const { assetAddress, timeframe } = req.query;
  
      if (!isAddress(assetAddress)) {
        return res.status(400).json({ error: 'Invalid token address' });
      }
  
      let dataPoints;
      switch(timeframe) {
        case '1m': dataPoints = 30; break;  
        case '6m': dataPoints = 180; break; 
        case '1y': dataPoints = 365; break; 
        default: dataPoints = 30;          
      }
  
      const [timestamps, rates] = await LendingPoolContract.methods
        .getAPRHistory(assetAddress, dataPoints)
        .call();
  
      const historyData = [];
      let sum = 0;
  
      for (let i = 0; i < timestamps.length; i++) {
        const aprValue = Number(rates[i]) / 100;
        sum += aprValue;
  
        historyData.push({
          timestamp: Number(timestamps[i]) * 1000, 
          apr: aprValue
        });
      }
  
      const avgAPR = historyData.length > 0 ? sum / historyData.length : 0;
  
      const utilization = await LendingPoolContract.methods.getUtilization(assetAddress).call();
      const currentAPY = await InterestModel.methods.getSupplyAPY(assetAddress, utilization).call();
      const currentAPYPercentage = Number(currentAPY) / 100;
  
      return res.status(200).json({
        asset: assetAddress,
        timeframe,
        averageAPR: avgAPR.toFixed(2),
        currentAPR: currentAPYPercentage.toFixed(2),
        history: historyData,
        dataPoints: historyData.length
      });
  
    } catch (err) {
      return res.status(500).json({
        error: 'Failed to fetch APR history',
        details: err.message
      });
    }
  },
};

module.exports = LendingController;