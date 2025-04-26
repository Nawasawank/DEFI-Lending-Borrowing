require('dotenv').config();
const { ethers } = require("ethers");
const { web3, LendingPoolContract, FaucetABI, InterestModel } = require('../utils/web3.js');
const { isAddress } = require('web3-validator');
const { getTokenContract } = require('../utils/tokenUtils.js');
const { fetchTokenPrices,coingeckoMap,getTotalCollateralUSD,getTotalBorrowedUSD, getTokenPricesForHealthFactor } = require('../utils/priceUtils.js');

const faucetMap = JSON.parse(process.env.FAUCET_MAP);
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
      const tokenBalance = await tokenContract.methods.balanceOf(fromAddress).call();
  
      if (BigInt(tokenBalance) < BigInt(amountInSmallestUnit)) {
        return res.status(400).json({ 
          error: 'Insufficient balance', 
          available: ethers.formatUnits(tokenBalance, DEFAULT_DECIMALS),
          required: amount,
          sufficient: false
        });
      }
  
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
      const { userAddress, assetAddress } = req.query;
      if (!isAddress(userAddress) || !isAddress(assetAddress)) {
        return res.status(400).json({ error: 'Invalid address' });
      }
  
      const accrueTx = await LendingPoolContract.methods.accrueInterest(assetAddress).send({ from: userAddress });
  
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
      return res.status(500).json({
        error: 'Failed to fetch balance',
        details: err.message
      });
    }
  },
  

  async getAssetConfig(req, res) {
    try {
      const { assetAddress } = req.query;
      if (!isAddress(assetAddress)) {
        return res.status(400).json({ error: 'Invalid token address' });
      }
  
      const [
        supplyCap,
        borrowCap,
        maxLTV,
        liquidationThreshold,
        liquidationPenalty,
        reserveFactor
      ] = await Promise.all([
        LendingPoolContract.methods.supplyCap(assetAddress).call(),
        LendingPoolContract.methods.borrowCap(assetAddress).call(),
        LendingPoolContract.methods.maxLTV(assetAddress).call(),
        LendingPoolContract.methods.liquidationThreshold(assetAddress).call(),
        LendingPoolContract.methods.liquidationPenalty(assetAddress).call(),
        InterestModel.methods.params(assetAddress).call() // <--- added here
      ]);
  
      return res.status(200).json({
        asset: assetAddress,
        config: {
          supplyCap: ethers.formatUnits(supplyCap, DEFAULT_DECIMALS),
          borrowCap: ethers.formatUnits(borrowCap, DEFAULT_DECIMALS),
          maxLTV: (Number(maxLTV) / 1000).toFixed(2) + '%',
          liquidationThreshold: (Number(liquidationThreshold) / 1000).toFixed(2) + '%',
          liquidationPenalty: (Number(liquidationPenalty) / 10).toFixed(2) + '%',
          reserveFactor: (Number(reserveFactor.reserveFactor) / 100).toFixed(2) + '%'
        }
      });
  
    } catch (err) {
      return res.status(500).json({
        error: 'Failed to fetch asset config',
        details: err.message
      });
    }
  },  

  async withdraw(req, res) {
    try {
      const { fromAddress, assetAddress, amount } = req.body;
  
      if (!isAddress(fromAddress) || !isAddress(assetAddress)) {
        return res.status(400).json({ error: 'Invalid address' });
      }
  
      if (isNaN(amount) || Number(amount) <= 0) {
        return res.status(400).json({ error: 'Invalid amount' });
      }
  
      const amountInSmallestUnit = ethers.parseUnits(amount.toString(), DEFAULT_DECIMALS);
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
  
      const tokenContract = getTokenContract(assetAddress);
      const [symbol, decimals, liquidationThresholdBP] = await Promise.all([
        tokenContract.methods.symbol().call(),
        tokenContract.methods.decimals().call(),
        LendingPoolContract.methods.liquidationThreshold(assetAddress).call()
      ]);
  
      const priceData = await fetchTokenPrices([coingeckoMap[symbol]]);
      const priceUSD = priceData[coingeckoMap[symbol]]?.usd;

      if (!priceUSD) {
        return res.status(500).json({ error: 'Unable to fetch price for token' });
      }
  
      const { totalCollateralUSD } = await getTotalCollateralUSD(fromAddress);
  
      const  { totalBorrowedUSD } = await getTotalBorrowedUSD(fromAddress); 
      // console.log(totalBorrowedUSD);
      
  
      let maxWithdrawAmount;
      if (totalBorrowedUSD === "0.00") {
        maxWithdrawAmount = Number(ethers.formatUnits(currentBalance, DEFAULT_DECIMALS));
      } else {
        const withdrawableUSD = totalCollateralUSD - totalBorrowedUSD;
        // console.log("withdrawable",withdrawableUSD);
        const effectivePrice = priceUSD * (Number(liquidationThresholdBP) / 10000);
        maxWithdrawAmount = withdrawableUSD / effectivePrice;
      }
  
      if (Number(amount) > maxWithdrawAmount) {
        return res.status(400).json({
          error: 'Requested amount exceeds safe withdrawal limit',
          maxWithdraw: maxWithdrawAmount.toFixed(6),
          priceUSD,
          liquidationThreshold: (Number(liquidationThresholdBP) / 10000).toFixed(2) + '%',
          safeToWithdrawAll: totalBorrowedUSD === 0
        });
      }
  
      const gasEstimate = await LendingPoolContract.methods
        .withdraw(assetAddress, amountInSmallestUnit.toString())
        .estimateGas({ from: fromAddress });
  
      const tx = await LendingPoolContract.methods
        .withdraw(assetAddress, amountInSmallestUnit.toString())
        .send({ from: fromAddress, gas: Math.ceil(Number(gasEstimate) * 1.5) });
  
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
      const tokenContract = getTokenContract(assetAddress);
      const [symbol, decimals] = await Promise.all([
        tokenContract.methods.symbol().call(),
        tokenContract.methods.decimals().call()
      ]);
  
      const [tokenState, supplyCap, prices] = await Promise.all([
        LendingPoolContract.methods.tokenState(assetAddress).call(),
        LendingPoolContract.methods.supplyCap(assetAddress).call(),
        fetchTokenPrices([coingeckoMap[symbol]])
      ]);
  
      const tokenPrice = prices[coingeckoMap[symbol]]?.usd || 0;
      const totalSupplied = ethers.formatUnits(tokenState.totalDeposits, decimals);
      const maxSupply = ethers.formatUnits(supplyCap, decimals);
      const suppliedInUSD = (parseFloat(totalSupplied) * tokenPrice).toFixed(2);
      const maxSupplyInUSD = (parseFloat(maxSupply) * tokenPrice).toFixed(2);
      const supplyPercent = ((parseFloat(totalSupplied) / parseFloat(maxSupply)) * 100).toFixed(2);
  
      return res.status(200).json({
        reserve: {
          supplied: `${parseFloat(totalSupplied).toFixed(2)} ${symbol}`,
          suppliedInUSD: `$${suppliedInUSD}`,
          maxSupply: `${parseFloat(maxSupply).toFixed(2)} ${symbol}`,
          maxSupplyInUSD: `$${maxSupplyInUSD}`,
          supplyPercent: `${supplyPercent}%`
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
      const { assetAddress } = req.query;
      if (!isAddress(assetAddress)) {
        return res.status(400).json({ error: 'Invalid asset address' });
      }
      const rate = await LendingPoolContract.methods.getUtilization(assetAddress).call();
      const rateNum = Number(rate);
      return res.status(200).json({
        assetAddress,
        utilizationRate: (rateNum / 100).toFixed(2) + '%',
        rawBasisPoints: rate.toString()
      });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to fetch utilization rate', details: err.message });
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
      return res.status(500).json({ error: 'Failed to fetch available liquidity', details: err.message });
    }
  },

  async getUserTokenBalances(req, res) {
    try {
      const { userAddress } = req.query;
      if (!isAddress(userAddress)) {
        return res.status(400).json({ error: "Invalid user address" });
      }
  
      const results = [];
      const symbols = [];
  
      // First loop: gather symbols for Coingecko price fetching
      for (const tokenAddress of Object.keys(faucetMap)) {
        const tokenContract = getTokenContract(tokenAddress);
        const symbol = await tokenContract.methods.symbol().call();
        symbols.push(coingeckoMap[symbol]);
      }
  
      const prices = await fetchTokenPrices(symbols);
  
      // Second loop: fetch token info and calculate USD values
      for (const tokenAddress of Object.keys(faucetMap)) {
        const tokenContract = getTokenContract(tokenAddress);
        const [symbol, decimals, balance] = await Promise.all([
          tokenContract.methods.symbol().call(),
          tokenContract.methods.decimals().call(),
          tokenContract.methods.balanceOf(userAddress).call()
        ]);
  
        const formattedBalance = ethers.formatUnits(balance.toString(), Number(decimals));
        const price = prices[coingeckoMap[symbol]]?.usd || 0;
        const usdValue = (parseFloat(formattedBalance) * price).toFixed(2);
  
        results.push({
          symbol,
          tokenAddress,
          balance: formattedBalance,
          raw: balance.toString(),
          decimals: Number(decimals),
          usdValue: `$${usdValue}`
        });
      }
  
      return res.status(200).json({
        user: userAddress,
        balances: results
      });
    } catch (err) {
      return res.status(500).json({ error: "Failed to fetch token balances", details: err.message });
    }
  },  

  async getSupplyAPY(req, res) {
    try {
      const supportedTokens = await LendingPoolContract.methods.getSupportedTokens().call();
  
      const results = [];
  
      for (const token of supportedTokens) {
        try {
          const utilization = await LendingPoolContract.methods.getUtilization(token).call();
          const supplyAPY = await InterestModel.methods.getSupplyAPY(token, utilization).call();
  
          results.push({
            asset: token,
            supplyAPY: (Number(supplyAPY) / 100).toFixed(2) + '%',
            rawBasisPoints: supplyAPY.toString(),
            utilization: (Number(utilization) / 100).toFixed(2) + '%'
          });
        } catch (innerErr) {
          console.error(`Failed to get APY for ${token}:`, innerErr.message);
          results.push({
            asset: token,
            error: "Failed to calculate APY",
            details: innerErr.message
          });
        }
      }
  
      return res.status(200).json(results);
    } catch (err) {
      console.error("Error in getAllSupplyAPYs:", err.message);
      return res.status(500).json({ error: "Failed to fetch supply APYs", details: err.message });
    }
  },

  async getUserHistory(req, res) {
    const { userAddress, page = 1, limit = 10, type, startDate, endDate } = req.query;
  
    if (!isAddress(userAddress)) {
      return res.status(400).json({ error: "Invalid user address" });
    }
  
    try {
      const [depositEvents, withdrawEvents, borrowEvents, repayEvents] = await Promise.all([
        LendingPoolContract.getPastEvents("Deposit", {
          filter: { lender: userAddress },
          fromBlock: 0,
          toBlock: "latest",
        }),
        LendingPoolContract.getPastEvents("Withdraw", {
          filter: { lender: userAddress },
          fromBlock: 0,
          toBlock: "latest",
        }),
        LendingPoolContract.getPastEvents("Borrow", {
          filter: { borrower: userAddress },
          fromBlock: 0,
          toBlock: "latest",
        }),
        LendingPoolContract.getPastEvents("Repay", {
          filter: { borrower: userAddress },
          fromBlock: 0,
          toBlock: "latest",
        }),
      ]);
  
      let allEvents = [...depositEvents, ...withdrawEvents, ...borrowEvents, ...repayEvents].map(e => ({
        type: e.event,
        token: e.returnValues.token,
        amount: ethers.formatUnits(e.returnValues.amount.toString(), DEFAULT_DECIMALS),
        txHash: e.transactionHash,
        blockNumber: Number(e.blockNumber),
        timestamp: null,
      }));
  
      const provider = new ethers.JsonRpcProvider(process.env.PROVIDER_URL);
      const uniqueBlockNumbers = [...new Set(allEvents.map(e => e.blockNumber))];
      const blockTimestamps = {};
  
      for (const blockNum of uniqueBlockNumbers) {
        const block = await provider.getBlock(blockNum);
        blockTimestamps[blockNum] = block.timestamp;
      }
  
      allEvents.forEach(e => {
        e.timestamp = blockTimestamps[e.blockNumber];
      });
  
      if (type) {
        const validTypes = ['Deposit', 'Withdraw', 'Borrow', 'Repay'];
        if (!validTypes.includes(type)) {
          return res.status(400).json({ error: `Invalid type: ${type}` });
        }
        allEvents = allEvents.filter(e => e.type === type);
      }
  
      if (startDate || endDate) {
        const start = startDate ? new Date(startDate).getTime() / 1000 : 0;
        const end = endDate ? new Date(endDate).getTime() / 1000 : Number.MAX_SAFE_INTEGER;
        allEvents = allEvents.filter(e => e.timestamp >= start && e.timestamp <= end);
      }
  
      allEvents.sort((a, b) => b.blockNumber - a.blockNumber);
  
      const startIndex = (page - 1) * limit;
      const paginated = allEvents.slice(startIndex, startIndex + Number(limit));
  
      return res.status(200).json({
        user: userAddress,
        page: Number(page),
        limit: Number(limit),
        total: allEvents.length,
        history: paginated,
      });
    } catch (err) {
      return res.status(500).json({ error: "Failed to fetch transaction history", details: err.message });
    }
  },  

async getLenderCollateral(req, res) {
  try {
    const { userAddress } = req.query;
    if (!isAddress(userAddress)) {
      return res.status(400).json({ error: 'Invalid address' });
    }

    const result = await LendingPoolContract.methods.getUserCollateral(userAddress).call();
    const tokenAddresses = result[0];
    const balances = result[1];
    const results = [];

    for (let i = 0; i < tokenAddresses.length; i++) {
      const tokenAddress = tokenAddresses[i];
      const rawBalance = balances[i];

      try {
        await LendingPoolContract.methods.accrueInterest(tokenAddress).send({ from: userAddress });
      } catch (accrueErr) {
        console.warn(`Failed to accrue interest for ${tokenAddress}:`, accrueErr.message);
        continue; 
      }

      const tokenContract = getTokenContract(tokenAddress);
      const [symbol, decimals, updatedBalance] = await Promise.all([
        tokenContract.methods.symbol().call(),
        tokenContract.methods.decimals().call(),
        LendingPoolContract.methods.balanceOf(tokenAddress, userAddress).call()
      ]);

      results.push({
        tokenAddress,
        symbol,
        balance: ethers.formatUnits(updatedBalance.toString(), decimals),
        raw: updatedBalance.toString()
      });
    }

    return res.status(200).json({
      user: userAddress,
      collateral: results
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch user collateral', details: err.message });
  }
},

  async SumAllCollateral(req, res) {
    try {
      const { userAddress } = req.query;
      if (!isAddress(userAddress)) {
        return res.status(400).json({ error: 'Invalid user address' });
      }

      const result = await LendingPoolContract.methods.getUserCollateral(userAddress).call();
      const tokenAddresses = result[0];
      const balances = result[1];
      let totalUSD = 0;
      const coinGeckoIDs = new Set();
      const details = [];

      for (let i = 0; i < tokenAddresses.length; i++) {
        const tokenAddress = tokenAddresses[i];
        const rawBalance = balances[i];
        if (rawBalance === "0") continue;
        const tokenContract = getTokenContract(tokenAddress);
        const [symbol, decimals] = await Promise.all([
          tokenContract.methods.symbol().call(),
          tokenContract.methods.decimals().call(),
        ]);
        const userBalance = parseFloat(
          ethers.formatUnits(rawBalance.toString(), Number(decimals))
        );
        if (userBalance > 0) {
          details.push({ tokenAddress, symbol, userBalance });
          const cgID = coingeckoMap[symbol];
          if (cgID) coinGeckoIDs.add(cgID);
        }
      }

      if (details.length === 0) {
        return res.status(200).json({
          user: userAddress,
          totalCollateralUSD: "0.00"
        });
      }

      const coinGeckoIDsArray = Array.from(coinGeckoIDs);
      const prices = await fetchTokenPrices(coinGeckoIDsArray);
      for (const token of details) {
        const cgID = coingeckoMap[token.symbol];
        const priceObj = prices[cgID];
        if (priceObj && typeof priceObj.usd === "number") {
          totalUSD += token.userBalance * priceObj.usd;
        }
      }
      return res.status(200).json({
        user: userAddress,
        totalCollateralUSD: totalUSD.toFixed(2)
      });
    } catch (err) {
      return res.status(500).json({
        error: 'Failed to fetch user collateral with prices',
        details: err.message
      });
    }
  },
  async TotalAPY(req, res) {
    try {
      const { userAddress } = req.query;
  
      if (!userAddress || !web3.utils.isAddress(userAddress)) {
        return res.status(400).json({ error: "Invalid or missing user address" });
      }
  
      const totalAPYRaw = await LendingPoolContract.methods.getTotalSupplyAPY(userAddress).call();
      const totalAPY = Number(totalAPYRaw) / 100;
  
      res.json({ userAddress, totalAPY });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
  async claimAllTokensForUser(req, res) {
    try {
      const { userAddress } = req.query;
  
      if (!isAddress(userAddress)) {
        return res.status(400).json({ error: 'Invalid user address' });
      }
  
      const claimed = [];
      const skipped = [];
  
      for (const [tokenAddress, faucetAddress] of Object.entries(faucetMap)) {
        const faucetContract = new web3.eth.Contract(FaucetABI.abi, faucetAddress);
  
        const alreadyClaimed = await faucetContract.methods.hasClaimed(userAddress).call();
        if (alreadyClaimed) {
          skipped.push({ token: tokenAddress, reason: "Already claimed" });
          continue;
        }
  
        try {
          const gasEstimate = await faucetContract.methods.claimTokens().estimateGas({ from: userAddress });
          const tx = await faucetContract.methods.claimTokens().send({
            from: userAddress,
            gas: Math.ceil(Number(gasEstimate) * 1.5)
          });
  
          claimed.push({
            token: tokenAddress,
            faucet: faucetAddress,
            txHash: tx.transactionHash
          });
        } catch (claimErr) {
          skipped.push({
            token: tokenAddress,
            reason: `Claim failed: ${claimErr.message}`
          });
        }
      }
  
      return res.status(200).json({
        user: userAddress,
        claimed,
        skipped
      });
  
    } catch (err) {
      return res.status(500).json({
        error: 'Failed to claim all tokens',
        details: err.message
      });
    }
  },
  async getMaxWithdrawable(req, res) {
    try {
      const { userAddress, assetAddress } = req.query;
  
      if (!isAddress(userAddress) || !isAddress(assetAddress)) {
        return res.status(400).json({ error: 'Invalid address' });
      }
  
      // 1. Get user balance from LendingPool
      const currentBalance = await LendingPoolContract.methods
        .balanceOf(assetAddress, userAddress)
        .call();
  
      if (BigInt(currentBalance) === 0n) {
        return res.status(200).json({
          user: userAddress,
          asset: assetAddress,
          maxWithdraw: "0",
          reason: "User has no balance to withdraw"
        });
      }
  
      const tokenContract = getTokenContract(assetAddress);
      const [symbol, decimalsRaw, liquidationThresholdBP] = await Promise.all([
        tokenContract.methods.symbol().call(),
        tokenContract.methods.decimals().call(),
        LendingPoolContract.methods.liquidationThreshold(assetAddress).call()
      ]);
  
      const decimals = Number(decimalsRaw);
      const tokenKey = symbol.toUpperCase();
  
      if (!coingeckoMap[tokenKey]) {
        return res.status(400).json({ error: `Symbol ${symbol} is not mapped to a price feed` });
      }
  
      const [priceData, collateral, borrow] = await Promise.all([
        fetchTokenPrices([coingeckoMap[tokenKey]]),
        getTotalCollateralUSD(userAddress),
        getTotalBorrowedUSD(userAddress)
      ]);
  
      const priceUSD = priceData[coingeckoMap[tokenKey]]?.usd;
      if (!priceUSD || isNaN(priceUSD)) {
        return res.status(500).json({ error: 'Unable to fetch valid price for token' });
      }
  
      const collateralUSD = parseFloat(collateral.totalCollateralUSD);
      const borrowedUSD = parseFloat(borrow.totalBorrowedUSD);
  
      let maxWithdrawAmount;
  
      if (borrowedUSD === 0) {
        maxWithdrawAmount = Number(ethers.formatUnits(currentBalance, decimals));
      } else {
        const withdrawableUSD = collateralUSD - borrowedUSD;
        const effectivePrice = priceUSD * (Number(liquidationThresholdBP) / 10000);
  
        if (effectivePrice <= 0 || isNaN(effectivePrice)) {
          return res.status(500).json({ error: 'Invalid effective price for withdrawal calculation' });
        }
  
        maxWithdrawAmount = withdrawableUSD / effectivePrice;
        if (maxWithdrawAmount < 0) maxWithdrawAmount = 0;
      }
  
      return res.status(200).json({
        user: userAddress,
        asset: assetAddress,
        maxWithdraw: maxWithdrawAmount.toFixed(6)
      });
  
    } catch (err) {
      return res.status(500).json({
        error: 'Failed to calculate max withdraw',
        details: err.message
      });
    }
  },

  async getLiquidationParams(req, res) {
    try {
      const { assetAddress } = req.query;
      if (!isAddress(assetAddress)) {
        return res.status(400).json({ error: 'Invalid token address' });
      }
      
      const params = await LendingPoolContract.methods
        .getLiquidationParams(assetAddress)
        .call();
      
      return res.status(200).json({
        asset: assetAddress,
        liquidationPenalty: (params.penalty / 100).toFixed(2) + '%',
        liquidationThreshold: (params.threshold / 100).toFixed(2) + '%',
        maxLTV: (params.ltv / 100).toFixed(2) + '%'
      });
    } catch (err) {
      return res.status(500).json({ 
        error: 'Failed to fetch liquidation params', 
        details: err.message 
      });
    }
  },

  async setAssetConfig(req, res) {
    try {
      const { 
        tokenAddress,
        supplyCap,
        borrowCap,
        maxLTV,
        liquidationThreshold,
        liquidationPenalty
      } = req.body;
  
      // Validate inputs
      if (!isAddress(tokenAddress)) {
        return res.status(400).json({ error: 'Invalid token address' });
      }
      if (liquidationPenalty > 2000) {
        return res.status(400).json({ error: 'Liquidation penalty cannot exceed 20%' });
      }
  
      const tx = await LendingPoolContract.methods
        .setAssetConfig(
          tokenAddress,
          ethers.parseUnits(supplyCap.toString(), DEFAULT_DECIMALS),
          ethers.parseUnits(borrowCap.toString(), DEFAULT_DECIMALS),
          maxLTV,
          liquidationThreshold,
          liquidationPenalty
        )
        .send({ from: req.adminAddress });
  
      return res.status(200).json({
        message: 'Asset config updated',
        transactionHash: tx.transactionHash
      });
    } catch (err) {
      return res.status(500).json({ 
        error: 'Failed to set asset config', 
        details: err.message 
      });
    }
  },

  async resetTokenConfig(req, res) {
    try {
      const { tokenAddress } = req.body;
      
      if (!isAddress(tokenAddress)) {
        return res.status(400).json({ error: 'Invalid token address' });
      }
  
      const tx = await LendingPoolContract.methods
        .resetTokenConfig(tokenAddress)
        .send({ from: req.adminAddress });
  
      return res.status(200).json({
        message: 'Token config reset to defaults',
        transactionHash: tx.transactionHash
      });
    } catch (err) {
      return res.status(500).json({ 
        error: 'Failed to reset token config', 
        details: err.message 
      });
    }
  },

  async borrow(req, res) {
    try {
      const { fromAddress, assetAddress, amount } = req.body;
      if (!isAddress(fromAddress) || !isAddress(assetAddress)) {
        return res.status(400).json({ error: "Invalid address" });
      }
      if (isNaN(amount) || Number(amount) <= 0) {
        return res.status(400).json({ error: "Invalid amount" });
      }
  
      const amountInSmallestUnit = ethers
        .parseUnits(amount.toString(), DEFAULT_DECIMALS)
        .toString();
  
      const [
        supportedTokens,
        tokenContract,
        collateral,
        maxLTVBP,
        priceData
      ] = await Promise.all([
        LendingPoolContract.methods.getSupportedTokens().call(),
        getTokenContract(assetAddress),
        getTotalCollateralUSD(fromAddress),
        LendingPoolContract.methods.maxLTV(assetAddress).call(),
        fetchTokenPrices(Object.values(coingeckoMap))
      ]);
  
      const symbol = await tokenContract.methods.symbol().call();
      const coingeckoID = coingeckoMap[symbol];
      const priceUSD = priceData[coingeckoID]?.usd;
      if (!priceUSD || isNaN(priceUSD)) {
        return res.status(500).json({
          error: `Unable to fetch price for token: ${assetAddress}`,
          details:
            "Ensure the token is mapped correctly in coingeckoMap and the API is reachable."
        });
      }
  
      const tokenPricesUSD = await Promise.all(
        supportedTokens.map(async (token) => {
          const tokenSymbol = await getTokenContract(token)
            .methods.symbol()
            .call();
          const tokenCoingeckoID = coingeckoMap[tokenSymbol];
          const p = priceData[tokenCoingeckoID]?.usd || 0;
          return ethers.parseUnits(p.toFixed(18), 18).toString();
        })
      );
  
      const collateralUSD = parseFloat(collateral.totalCollateralUSD);
      const maxBorrowableUSD = collateralUSD * (Number(maxLTVBP) / 1e5);
      const borrowValueUSD = Number(amount) * priceUSD;
  
      if (borrowValueUSD > maxBorrowableUSD) {
        return res.status(400).json({
          error: "Borrow amount exceeds maximum borrowable limit",
          maxBorrowableUSD: maxBorrowableUSD.toFixed(2),
          borrowValueUSD: borrowValueUSD.toFixed(2)
        });
      }
  
      const gasEstimate = await LendingPoolContract.methods
        .borrow(assetAddress, amountInSmallestUnit, tokenPricesUSD)
        .estimateGas({ from: fromAddress });
  
      const tx = await LendingPoolContract.methods
        .borrow(assetAddress, amountInSmallestUnit, tokenPricesUSD)
        .send({ from: fromAddress, gas: Math.ceil(Number(gasEstimate) * 1.5) });
  
      return res.status(200).json({
        message: "Borrow successful",
        transactionHash: tx.transactionHash,
        borrowedAmount: amount,
        asset: assetAddress
      });
    } catch (err) {
      console.error("Borrow error:", err);
      return res
        .status(500)
        .json({ error: "Borrow failed", details: err.message });
    }
  },
  
async repay(req, res) {
  try {
    console.log("[Repay] Request received:", req.body);

    const { fromAddress, assetAddress, amount } = req.body;

    if (!isAddress(fromAddress) || !isAddress(assetAddress)) {
      console.log("[Repay] Invalid address:", { fromAddress, assetAddress });
      return res.status(400).json({ error: 'Invalid address' });
    }

    if (isNaN(amount) || Number(amount) <= 0) {
      console.log("[Repay] Invalid amount:", amount);
      return res.status(400).json({ error: 'Invalid amount' });
    }

    const amountInSmallestUnit = ethers.parseUnits(amount.toString(), DEFAULT_DECIMALS).toString();
    console.log("[Repay] Amount in smallest unit:", amountInSmallestUnit);

    const tokenContract = getTokenContract(assetAddress);

    const allowance = await tokenContract.methods
      .allowance(fromAddress, LendingPoolContract.options.address)
      .call();
    console.log("[Repay] Current allowance:", allowance);

    if (BigInt(allowance) < BigInt(amountInSmallestUnit)) {
      try {
        console.log("[Repay] Insufficient allowance, attempting to approve...");
        const gasEstimate = await tokenContract.methods
          .approve(LendingPoolContract.options.address, amountInSmallestUnit)
          .estimateGas({ from: fromAddress });
        await tokenContract.methods
          .approve(LendingPoolContract.options.address, amountInSmallestUnit)
          .send({ from: fromAddress, gas: Math.ceil(Number(gasEstimate) * 1.5) });
        console.log("[Repay] Approval successful.");
      } catch (approveErr) {
        console.error("[Repay] Approval failed:", approveErr.message);
        return res.status(500).json({
          error: 'Approval failed',
          details: approveErr.message,
        });
      }
    }

    console.log("[Repay] Attempting to repay...");
    const gasEstimate = await LendingPoolContract.methods
      .repay(assetAddress, amountInSmallestUnit)
      .estimateGas({ from: fromAddress });

    const tx = await LendingPoolContract.methods
      .repay(assetAddress, amountInSmallestUnit)
      .send({ from: fromAddress, gas: Math.ceil(Number(gasEstimate) * 1.5) });
    console.log("[Repay] Repayment transaction successful:", tx.transactionHash);

    return res.status(200).json({
      message: 'Repayment successful',
      transactionHash: tx.transactionHash,
      repaidAmount: amount,
      asset: assetAddress,
    });
  } catch (err) {
    console.error("[Repay] Repayment error:", err);

    return res.status(500).json({
      error: 'Repayment failed',
      details: err?.data?.message || err.message || 'Unknown error',
    });
  }
},

async getHealthFactor(req, res) {
  try {
      const { userAddress } = req.query;

      if (!isAddress(userAddress)) {
          return res.status(400).json({ error: 'Invalid user address' });
      }

      // Fetch supported tokens
      let supportedTokens;
      try {
          supportedTokens = await LendingPoolContract.methods.getSupportedTokens().call();
          if (!Array.isArray(supportedTokens) || supportedTokens.length === 0) {
              return res.status(500).json({ error: "No supported tokens found in the LendingPool contract" });
          }
      } catch (err) {
          console.error("Error fetching supported tokens:", err.message);
          return res.status(500).json({ error: "Failed to fetch supported tokens", details: err.message });
      }

      const tokenPricesUSD = await getTokenPricesForHealthFactor(supportedTokens);

      const healthFactor = await LendingPoolContract.methods.getHealthFactor(userAddress, tokenPricesUSD).call();

      let formattedHealthFactor;
      if (healthFactor === "0" || healthFactor === 0) {
          formattedHealthFactor = "-"; 
      } else {
          formattedHealthFactor = ethers.formatUnits(healthFactor, 18); 
      }

      return res.status(200).json({
          user: userAddress,
          healthFactor: formattedHealthFactor
      });
  } catch (err) {
      console.error("Error fetching health factor:", err.message);
      return res.status(500).json({ error: 'Failed to fetch health factor', details: err.message });
  }
},

async getMaxBorrowable(req, res) {
  try {
    const { userAddress, assetAddress } = req.query;
    if (!isAddress(userAddress) || !isAddress(assetAddress)) {
      return res.status(400).json({ error: 'Invalid address' });
    }

    const tokenContract = getTokenContract(assetAddress);
    const [symbol, decimalsRaw, maxLTVBPRaw] = await Promise.all([
      tokenContract.methods.symbol().call(),
      tokenContract.methods.decimals().call(),
      LendingPoolContract.methods.maxLTV(assetAddress).call()
    ]);

    const decimals = Number(decimalsRaw);
    const cgID = coingeckoMap[symbol.toUpperCase()];
    if (!cgID) {
      return res.status(400).json({ error: `Symbol ${symbol} is not mapped to a price feed` });
    }

    const [priceData, collateral] = await Promise.all([
      fetchTokenPrices([cgID]),
      getTotalCollateralUSD(userAddress)
    ]);

    const priceUSD = priceData[cgID]?.usd;
    if (!priceUSD || isNaN(priceUSD)) {
      return res.status(500).json({ error: 'Unable to fetch valid price for token' });
    }

    const collateralUSD = parseFloat(collateral.totalCollateralUSD);
    const maxLTVBP = Number(maxLTVBPRaw);
    const maxBorrowableUSD = collateralUSD * (maxLTVBP / 1e5);
    const maxBorrowableAmt = maxBorrowableUSD / priceUSD;

    return res.status(200).json({
      user: userAddress,
      asset: assetAddress,
      symbol,
      maxBorrow: maxBorrowableAmt > 0
        ? maxBorrowableAmt.toFixed(decimals)
        : "0",
      maxBorrowUSD: maxBorrowableUSD.toFixed(2)
    });
  } catch (err) {
    return res.status(500).json({
      error: 'Failed to calculate max borrowable',
      details: err.message
    });
  }
},

async PreviewHealthFactor(req, res) {
    try {
        const { userAddress, assetAddress, borrowAmount } = req.query;

        if (!isAddress(userAddress) || !isAddress(assetAddress)) {
            return res.status(400).json({ error: 'Invalid address' });
        }

        if (isNaN(borrowAmount) || Number(borrowAmount) <= 0) {
            return res.status(400).json({ error: 'Invalid borrow amount' });
        }

        // Fetch token prices and user collateral
        const tokenContract = getTokenContract(assetAddress);
        const [symbol, decimalsRaw, liquidationThresholdBP] = await Promise.all([
            tokenContract.methods.symbol().call(),
            tokenContract.methods.decimals().call(),
            LendingPoolContract.methods.liquidationThreshold(assetAddress).call()
        ]);

        const decimals = Number(decimalsRaw);
        const tokenKey = symbol.toUpperCase();

        if (!coingeckoMap[tokenKey]) {
            return res.status(400).json({ error: `Symbol ${symbol} is not mapped to a price feed` });
        }

        const [priceData, collateral, borrow] = await Promise.all([
            fetchTokenPrices([coingeckoMap[tokenKey]]),
            getTotalCollateralUSD(userAddress),
            getTotalBorrowedUSD(userAddress)
        ]);

        const priceUSD = priceData[coingeckoMap[tokenKey]]?.usd;
        if (!priceUSD || isNaN(priceUSD)) {
            return res.status(500).json({ error: 'Unable to fetch valid price for token' });
        }

        const collateralUSD = parseFloat(collateral.totalCollateralUSD);
        const borrowedUSD = parseFloat(borrow.totalBorrowedUSD);
        const borrowValueUSD = Number(borrowAmount) * priceUSD;

        // Debug logs to identify issues
        console.log("Collateral USD:", collateralUSD);
        console.log("Borrowed USD:", borrowedUSD);
        console.log("Borrow Value USD:", borrowValueUSD);
        console.log("Liquidation Threshold BP:", liquidationThresholdBP);

        // Handle zero collateral case
        if (collateralUSD === 0) {
            return res.status(400).json({
                error: 'User has no collateral supplied',
                collateralUSD: collateralUSD.toString(),
                liquidationThresholdBP: liquidationThresholdBP.toString()
            });
        }

        // Calculate new health factor
        const adjustedCollateral = (collateralUSD * (Number(liquidationThresholdBP) / 100000));
        const newBorrowedUSD = borrowedUSD + borrowValueUSD;

        console.log("Adjusted Collateral:", adjustedCollateral);
        console.log("New Borrowed USD:", newBorrowedUSD);

        // Handle division by zero
        const newHealthFactor = newBorrowedUSD === 0
            ? "Infinity"
            : (adjustedCollateral / newBorrowedUSD).toFixed(6);

        return res.status(200).json({
            user: userAddress,
            asset: assetAddress,
            borrowAmount: borrowAmount.toString(), // Convert to string
            borrowValueUSD: borrowValueUSD.toFixed(2),
            newHealthFactor
        });
    } catch (err) {
        return res.status(500).json({
            error: 'Failed to preview health factor',
            details: err.message
        });
    }
},
async getSupplyAPR(req, res) {
  try {
    const { tokenAddress } = req.query;

    let tokensToQuery = [];

    if (tokenAddress) {
      if (!ethers.isAddress(tokenAddress)) {
        return res.status(400).json({ error: "Invalid token address" });
      }
      tokensToQuery = [tokenAddress];
    } else {
      tokensToQuery = await LendingPoolContract.methods.getSupportedTokens().call();
    }

    const resultMap = {};

    for (const token of tokensToQuery) {
      try {
        const utilization = await LendingPoolContract.methods
          .getUtilization(token)
          .call();

        const aprBps = await InterestModel.methods
          .getSupplyRate(utilization, token)
          .call();

        resultMap[token] = {
          supplyAPR: (Number(aprBps) / 100).toFixed(2) + '%',
          rawBasisPoints: aprBps.toString(),
          utilization: (Number(utilization) / 100).toFixed(2) + '%'
        };
      } catch (innerErr) {
        resultMap[token] = {
          error: 'Failed to calculate APR',
          details: innerErr.message
        };
      }
    }

    return res.status(200).json(resultMap);
  } catch (err) {
    return res.status(500).json({
      error: 'Failed to fetch supply APRs',
      details: err.message
    });
  }
},
async getBorrowAPY(req, res) {
  try {
    const supportedTokens = await LendingPoolContract.methods.getSupportedTokens().call();
    const results = [];

    for (const token of supportedTokens) {
      try {
        const utilization = await LendingPoolContract.methods.getUtilization(token).call();
        const borrowAPY = await InterestModel.methods.getBorrowAPY(token, utilization).call();

        results.push({
          asset: token,
          borrowAPY: (Number(borrowAPY) / 100).toFixed(2) + '%',
          rawBasisPoints: borrowAPY.toString(),
          utilization: (Number(utilization) / 100).toFixed(2) + '%'
        });
      } catch (innerErr) {
        results.push({
          asset: token,
          error: "Failed to fetch Borrow APY",
          details: innerErr.message
        });
      }
    }

    return res.status(200).json(results);
  } catch (err) {
    return res.status(500).json({
      error: "Failed to fetch Borrow APYs",
      details: err.message
    });
  }
},

async getBorrowAPR(req, res) {
  try {
    const { tokenAddress } = req.query;

    if (!tokenAddress || !ethers.isAddress(tokenAddress)) {
      return res.status(400).json({ error: "Invalid or missing token address" });
    }

    const utilization = await LendingPoolContract.methods.getUtilization(tokenAddress).call();
    const borrowAPR = await InterestModel.methods.getBorrowRate(tokenAddress, utilization).call();

    return res.status(200).json({
      asset: tokenAddress,
      borrowAPR: (Number(borrowAPR) / 100).toFixed(2) + '%',
      rawBasisPoints: borrowAPR.toString(),
      utilization: (Number(utilization) / 100).toFixed(2) + '%'
    });
  } catch (err) {
    return res.status(500).json({
      error: "Failed to fetch borrow APR",
      details: err.message
    });
  }
},
async getUserDebt(req, res) {
  try {
    const { userAddress, assetAddress } = req.query;

    if (!isAddress(userAddress) || !isAddress(assetAddress)) {
      return res.status(400).json({ error: 'Invalid address' });
    }

    // First accrue borrow interest (very important to include up-to-date interest)
    await LendingPoolContract.methods.accrueBorrowInterest(assetAddress).send({ from: userAddress });

    // Then fetch debt
    const debt = await LendingPoolContract.methods
      .repayBalanceOf(assetAddress, userAddress)
      .call();

    return res.status(200).json({
      user: userAddress,
      asset: assetAddress,
      debt: ethers.formatUnits(debt, DEFAULT_DECIMALS),
      hasDebt: BigInt(debt) > 0n
    });
  } catch (err) {
    return res.status(500).json({
      error: 'Failed to fetch debt',
      details: err.message
    });
  }
},
async PreviewCollateralAfterWithdraw(req, res) {
  try {
    const { userAddress, assetAddress, withdrawAmount } = req.query;

    if (!isAddress(userAddress) || !isAddress(assetAddress)) {
      return res.status(400).json({ error: 'Invalid address' });
    }

    if (isNaN(withdrawAmount) || Number(withdrawAmount) <= 0) {
      return res.status(400).json({ error: 'Invalid withdraw amount' });
    }

    const result = await LendingPoolContract.methods.getUserCollateral(userAddress).call();
    const tokenAddresses = result[0];
    const balances = result[1];

    const tokenIndex = tokenAddresses.findIndex(addr => addr.toLowerCase() === assetAddress.toLowerCase());
    if (tokenIndex === -1) {
      return res.status(400).json({ error: 'Token not found in user collateral' });
    }

    const rawBalance = balances[tokenIndex];
    await LendingPoolContract.methods.accrueInterest(assetAddress).send({ from: userAddress });

    const tokenContract = getTokenContract(assetAddress);
    const [symbol, decimalsRaw, updatedBalance] = await Promise.all([
      tokenContract.methods.symbol().call(),
      tokenContract.methods.decimals().call(),
      LendingPoolContract.methods.balanceOf(assetAddress, userAddress).call()
    ]);

    const decimals = Number(decimalsRaw);
    const withdrawAmountBig = ethers.parseUnits(withdrawAmount.toString(), decimals);

    if (BigInt(updatedBalance) < BigInt(withdrawAmountBig)) {
      return res.status(400).json({
        error: 'Withdraw amount exceeds current balance',
        currentBalance: ethers.formatUnits(updatedBalance, decimals),
        requestedWithdraw: withdrawAmount
      });
    }

    const remaining = BigInt(updatedBalance) - BigInt(withdrawAmountBig);

    return res.status(200).json({
      user: userAddress,
      asset: assetAddress,
      symbol,
      originalCollateral: ethers.formatUnits(updatedBalance.toString(), decimals),
      requestedWithdraw: withdrawAmount,
      remainingCollateral: ethers.formatUnits(remaining.toString(), decimals)
    });

  } catch (err) {
    return res.status(500).json({
      error: 'Failed to preview remaining collateral',
      details: err.message
    });
  }
},
async PreviewRemainingDebtAfterRepay(req, res) {
  try {
    const { userAddress, assetAddress, repayAmount } = req.query;

    if (!isAddress(userAddress) || !isAddress(assetAddress)) {
      return res.status(400).json({ error: 'Invalid address' });
    }

    if (isNaN(repayAmount) || Number(repayAmount) <= 0) {
      return res.status(400).json({ error: 'Invalid repay amount' });
    }

    const tokenContract = getTokenContract(assetAddress);
    const [symbol, decimalsRaw] = await Promise.all([
      tokenContract.methods.symbol().call(),
      tokenContract.methods.decimals().call()
    ]);

    const decimals = Number(decimalsRaw);
    const repayAmountBig = ethers.parseUnits(repayAmount.toString(), decimals);

    const currentDebt = await LendingPoolContract.methods
      .repayBalanceOf(assetAddress, userAddress)
      .call();

    if (BigInt(currentDebt) === 0n) {
      return res.status(200).json({
        message: 'User has no debt',
        remainingDebt: '0',
        symbol
      });
    }

    const remaining = BigInt(currentDebt) > BigInt(repayAmountBig)
      ? BigInt(currentDebt) - BigInt(repayAmountBig)
      : 0n;

    return res.status(200).json({
      user: userAddress,
      asset: assetAddress,
      symbol,
      originalDebt: ethers.formatUnits(currentDebt, decimals),
      repayAmount,
      remainingDebt: ethers.formatUnits(remaining, decimals)
    });

  } catch (err) {
    return res.status(500).json({
      error: 'Failed to preview remaining debt',
      details: err.message
    });
  }
},
async TotalBorrowAPY(req, res) {
  try {
    const { userAddress } = req.query;

    if (!isAddress(userAddress)) {
      return res.status(400).json({ error: "Invalid user address" });
    }

    const result = await LendingPoolContract.methods.getUserBorrow(userAddress).call();
    const tokenAddresses = result[0];
    const borrowAmounts = result[1];

    if (!tokenAddresses || tokenAddresses.length === 0) {
      return res.status(200).json({
        userAddress,
        totalBorrowAPY: "0.00",
        details: []
      });
    }

    let totalBorrowUSD = 0;
    let weightedAPYSum = 0;
    const details = [];

    for (let i = 0; i < tokenAddresses.length; i++) {
      const token = tokenAddresses[i];
      const rawBorrow = borrowAmounts[i];
      if (rawBorrow === "0") continue;

      const tokenContract = getTokenContract(token);
      const [symbol, decimals, utilization] = await Promise.all([
        tokenContract.methods.symbol().call(),
        tokenContract.methods.decimals().call(),
        LendingPoolContract.methods.getUtilization(token).call()
      ]);

      const borrowAPYbps = await InterestModel.methods.getBorrowAPY(token, utilization).call();
      const borrowAPY = Number(borrowAPYbps) / 100;

      const priceData = await fetchTokenPrices([coingeckoMap[symbol]]);
      const priceUSD = priceData[coingeckoMap[symbol]]?.usd || 0;

      const userBorrow = parseFloat(ethers.formatUnits(rawBorrow, Number(decimals)));
      const userBorrowUSD = userBorrow * priceUSD;

      totalBorrowUSD += userBorrowUSD;
      weightedAPYSum += userBorrowUSD * borrowAPY;

    }

    const totalBorrowAPY = totalBorrowUSD > 0 ? (weightedAPYSum / totalBorrowUSD) : 0;

    return res.status(200).json({
      userAddress,
      totalBorrowAPY: totalBorrowAPY.toFixed(2),
    });

  } catch (err) {
    return res.status(500).json({ error: "Failed to calculate total borrow APY", details: err.message });
  }
},
async SumAllBorrow(req, res) {
  try {
    const { userAddress } = req.query
    if (!isAddress(userAddress)) {
      return res.status(400).json({ error: 'Invalid user address' })
    }

    const result = await LendingPoolContract.methods
      .getUserBorrow(userAddress)
      .call()
    const tokenAddresses = result[0]
    const rawPrincipals  = result[1]

    const tokensToProcess = []
    for (let i = 0; i < tokenAddresses.length; i++) {
      if (rawPrincipals[i] !== "0") {
        tokensToProcess.push(tokenAddresses[i])
      }
    }

    if (tokensToProcess.length === 0) {
      return res.status(200).json({
        user: userAddress,
        totalBorrowUSD: "0.00"
      })
    }

    const infos = await Promise.all(tokensToProcess.map(async token => {
      const rawDebt = await LendingPoolContract.methods
        .repayBalanceOf(token, userAddress)
        .call()
      if (rawDebt === "0") return null
      const tokenContract = getTokenContract(token)
      const [symbol, decimals] = await Promise.all([
        tokenContract.methods.symbol().call(),
        tokenContract.methods.decimals().call()
      ])
      const debtAmount = parseFloat(
        ethers.formatUnits(rawDebt.toString(), Number(decimals))
      )
      const cgID = coingeckoMap[symbol]
      if (!cgID) return null
      return { cgID, debtAmount }
    }))

    const valid = infos.filter(x => x)
    if (valid.length === 0) {
      return res.status(200).json({
        user: userAddress,
        totalBorrowUSD: "0.00"
      })
    }

    const cgIDs = Array.from(new Set(valid.map(i => i.cgID)))
    const prices = await fetchTokenPrices(cgIDs)

    let totalUSD = 0
    for (const { cgID, debtAmount } of valid) {
      const p = prices[cgID]
      if (p && typeof p.usd === "number") {
        totalUSD += debtAmount * p.usd
      }
    }

    return res.status(200).json({
      user: userAddress,
      totalBorrowUSD: totalUSD.toFixed(2)
    })
  } catch (err) {
    return res.status(500).json({
      error: 'Failed to fetch total borrow USD',
      details: err.message
    })
  }
},
async getBorrowerDebt(req, res) {
  try {
    const { userAddress } = req.query;
    if (!isAddress(userAddress)) {
      return res.status(400).json({ error: 'Invalid user address' });
    }

    const result = await LendingPoolContract.methods
      .getUserBorrow(userAddress)
      .call();
    const tokenAddresses = result[0];

    const debt = await Promise.all(
      tokenAddresses.map(async (tokenAddress) => {
        const rawDebt = await LendingPoolContract.methods
          .repayBalanceOf(tokenAddress, userAddress)
          .call();
        const raw = rawDebt.toString();
        const tokenContract = getTokenContract(tokenAddress);
        const [symbol, decimals] = await Promise.all([
          tokenContract.methods.symbol().call(),
          tokenContract.methods.decimals().call(),
        ]);
        const balance = ethers.formatUnits(raw, Number(decimals));
        return {
          tokenAddress,
          symbol,
          balance,
          raw
        };
      })
    );

    return res.status(200).json({
      user: userAddress,
      debt
    });
  } catch (err) {
    return res.status(500).json({
      error: 'Failed to fetch user debt details',
      details: err.message
    });
  }
},
async getNetOverview(req, res) {
  try {
    const { userAddress } = req.query;
    if (!isAddress(userAddress)) {
      return res.status(400).json({ error: 'Invalid user address' });
    }

    // correctly pull out the two arrays from getUserCollateral(...)
    const collRes = await LendingPoolContract.methods
      .getUserCollateral(userAddress)
      .call();
    const colTokens   = collRes.tokens   || collRes[0];
    const colBalances = collRes.balances || collRes[1];

    // correctly pull out the two arrays from getUserBorrow(...)
    const borrowRes      = await LendingPoolContract.methods
      .getUserBorrow(userAddress)
      .call();
    const bTokens        = borrowRes.tokens   || borrowRes[0];
    const rawPrincipals  = borrowRes.amounts  || borrowRes[1];

    // build price lookup set, collateral list, debt list, and rate info
    const cgIDs   = new Set();
    const coll    = [];
    const debts   = [];
    const rateInfo = [];

    // collateral loop
    for (let i = 0; i < colTokens.length; i++) {
      if (colBalances[i] === '0') continue;
      const token   = colTokens[i];
      const tokenC  = getTokenContract(token);
      const [ sym, dec ] = await Promise.all([
        tokenC.methods.symbol().call(),
        tokenC.methods.decimals().call()
      ]);
      const bal    = parseFloat(ethers.formatUnits(colBalances[i], Number(dec)));
      const cgID   = coingeckoMap[sym];
      if (!cgID) continue;
      cgIDs.add(cgID);
      coll.push({ cgID, balance: bal });
    }

    // borrow loop
    for (let i = 0; i < bTokens.length; i++) {
      if (rawPrincipals[i] === '0') continue;
      const token = bTokens[i];
      const raw   = await LendingPoolContract.methods
        .repayBalanceOf(token, userAddress)
        .call();
      if (raw === '0') continue;
      const tokenC  = getTokenContract(token);
      const [ sym, dec ] = await Promise.all([
        tokenC.methods.symbol().call(),
        tokenC.methods.decimals().call()
      ]);
      const bal    = parseFloat(ethers.formatUnits(raw, Number(dec)));
      const cgID   = coingeckoMap[sym];
      if (cgID) {
        cgIDs.add(cgID);
        debts.push({ cgID, balance: bal });
      }
      const util = await LendingPoolContract.methods.getUtilization(token).call();
      const brBP = await InterestModel.methods
        .getBorrowRate(token, util)
        .call();
      rateInfo.push({ borrowRateBP: brBP, balance: bal });
    }

    if (cgIDs.size === 0) {
      return res.status(200).json({
        user: userAddress,
        netWorthUSD: "0.00",
        netAPY: "0.00%"
      });
    }

    const prices = await fetchTokenPrices(Array.from(cgIDs));

    let totalCollateralUSD = 0;
    for (const { cgID, balance } of coll) {
      totalCollateralUSD += balance * prices[cgID].usd;
    }

    let totalBorrowUSD = 0;
    for (const { cgID, balance } of debts) {
      totalBorrowUSD += balance * prices[cgID].usd;
    }

    const supplyAPRbp = await LendingPoolContract.methods
      .getTotalSupplyAPY(userAddress)
      .call();
    const supplyAPR = Number(supplyAPRbp) / 10000;

    const totalDebtAmt = rateInfo.reduce((sum, r) => sum + r.balance, 0);
    let weightedBorrowAPR = 0;
    if (totalDebtAmt > 0) {
      weightedBorrowAPR = rateInfo.reduce(
        (sum, { borrowRateBP, balance }) =>
          sum + (Number(borrowRateBP) / 10000) * balance,
        0
      ) / totalDebtAmt;
    }

    const netAPY    = (supplyAPR - weightedBorrowAPR) * 100;
    const netWorth  = totalCollateralUSD - totalBorrowUSD;

    return res.status(200).json({
      user: userAddress,
      netWorthUSD: netWorth.toFixed(2),
      netAPY:      netAPY.toFixed(2) + '%'
    });

  } catch (err) {
    return res.status(500).json({
      error:   'Failed to fetch net overview',
      details: err.message
    });
  }
},
async getAssetOverview(req, res) {
  try {
    const { userAddress } = req.query;
    if (!isAddress(userAddress)) {
      return res.status(400).json({ error: 'Invalid user address' });
    }

    const tokens = await LendingPoolContract.methods
      .getSupportedTokens()
      .call();

    const assets = [];
    for (const tokenAddress of tokens) {
      const tokenC = getTokenContract(tokenAddress);

      const [
        symbol,
        decimals,
        rawWalletBalance,
        canBeCollateral
      ] = await Promise.all([
        tokenC.methods.symbol().call(),
        tokenC.methods.decimals().call(),
        tokenC.methods.balanceOf(userAddress).call(),
        LendingPoolContract.methods.allowedTokens(tokenAddress).call()
      ]);

      const walletBalance = ethers.formatUnits(rawWalletBalance, Number(decimals));

      const util = await LendingPoolContract.methods
        .getUtilization(tokenAddress)
        .call();

      const supplyRateBP = await InterestModel.methods
        .getSupplyRate(util, tokenAddress)
        .call();

      const apy = (Number(supplyRateBP) / 100).toFixed(2) + '%';

      assets.push({
        tokenAddress,
        symbol,
        walletBalance,
        apy,
        canBeCollateral
      });
    }

    return res.status(200).json({
      user:   userAddress,
      assets
    });
  } catch (err) {
    return res.status(500).json({
      error:   'Failed to fetch asset overview',
      details: err.message
    });
  }
},
async getBorrowOverview(req, res) {
  try {
    const { userAddress } = req.query;
    if (!isAddress(userAddress)) {
      return res.status(400).json({ error: 'Invalid user address' });
    }

    const collData      = await getTotalCollateralUSD(userAddress);
    const collateralUSD = parseFloat(collData.totalCollateralUSD);

    const tokens = await LendingPoolContract.methods
      .getSupportedTokens()
      .call();

    const metas = await Promise.all(tokens.map(async tokenAddress => {
      const tokenC = getTokenContract(tokenAddress);
      const [ symbol, decRaw, maxLTVbpRaw, rawWalletBalance ] = await Promise.all([
        tokenC.methods.symbol().call(),
        tokenC.methods.decimals().call(),
        LendingPoolContract.methods.maxLTV(tokenAddress).call(),
        tokenC.methods.balanceOf(userAddress).call()
      ]);
      return {
        tokenAddress,
        symbol,
        decimals: Number(decRaw),
        maxLTVbp: Number(maxLTVbpRaw),
        rawWalletBalance
      };
    }));

    const cgIDs  = metas
      .map(m => coingeckoMap[m.symbol.toUpperCase()])
      .filter(Boolean);
    const prices = await fetchTokenPrices([...new Set(cgIDs)]);

    const overview = await Promise.all(metas.map(async ({ tokenAddress, symbol, decimals, maxLTVbp, rawWalletBalance }) => {
      const walletBalance = parseFloat(
        ethers.formatUnits(rawWalletBalance.toString(), decimals)
      );

      let available = 0;
      const cgID = coingeckoMap[symbol.toUpperCase()];
      const priceUSD = prices[cgID]?.usd || 0;
      if (priceUSD > 0) {
        const maxBorrowUSD = collateralUSD * (maxLTVbp / 1e5);
        available = maxBorrowUSD / priceUSD;
      }

      const util = await LendingPoolContract.methods
        .getUtilization(tokenAddress)
        .call();
      const borrowRateBP = await InterestModel.methods
        .getBorrowRate(tokenAddress, util)
        .call();
      const borrowAPY = (Number(borrowRateBP) / 100).toFixed(2) + '%';

      return {
        tokenAddress,
        symbol,
        walletBalance: walletBalance.toFixed(decimals),
        available:     available.toFixed(decimals),
        borrowAPY
      };
    }));

    return res.status(200).json({
      user:   userAddress,
      borrow: overview
    });
  } catch (err) {
    return res.status(500).json({
      error:   'Failed to fetch borrow overview',
      details: err.message
    });
  }
},
async getTotalBorrowed(req, res) {
  const { assetAddress } = req.query;

  if (!isAddress(assetAddress)) {
    return res.status(400).json({ error: "Invalid token address" });
  }

  try {
    const tokenContract = getTokenContract(assetAddress);
    const [symbol, decimals] = await Promise.all([
      tokenContract.methods.symbol().call(),
      tokenContract.methods.decimals().call()
    ]);

    const [tokenState, borrowCap, prices] = await Promise.all([
      LendingPoolContract.methods.tokenState(assetAddress).call(),
      LendingPoolContract.methods.borrowCap(assetAddress).call(),
      fetchTokenPrices([coingeckoMap[symbol]])
    ]);

    const tokenPrice = prices[coingeckoMap[symbol]]?.usd || 0;
    const totalBorrowed = ethers.formatUnits(tokenState.totalBorrows, decimals);
    const maxBorrow = ethers.formatUnits(borrowCap, decimals);
    const borrowedInUSD = (parseFloat(totalBorrowed) * tokenPrice).toFixed(2);
    const maxBorrowInUSD = (parseFloat(maxBorrow) * tokenPrice).toFixed(2);
    const borrowPercent = ((parseFloat(totalBorrowed) / parseFloat(maxBorrow)) * 100).toFixed(2);

    return res.status(200).json({
      reserve: {
        borrowed: `${parseFloat(totalBorrowed).toFixed(2)} ${symbol}`,
        borrowedInUSD: `$${borrowedInUSD}`,
        maxBorrow: `${parseFloat(maxBorrow).toFixed(2)} ${symbol}`,
        maxBorrowInUSD: `$${maxBorrowInUSD}`,
        borrowPercent: `${borrowPercent}%`
      }
    });

  } catch (err) {
    return res.status(500).json({
      error: "Failed to fetch reserve status",
      details: err.message
    });
  }
},
async getMarketOverview(req, res) {
  try {
    const supportedTokens = await LendingPoolContract.methods.getSupportedTokens().call();

    let totalSuppliedUSD = 0;
    let totalBorrowedUSD = 0;

    const symbols = await Promise.all(
      supportedTokens.map(async token => {
        const tokenContract = getTokenContract(token);
        const symbol = await tokenContract.methods.symbol().call();
        return coingeckoMap[symbol.toUpperCase()];
      })
    );

    const prices = await fetchTokenPrices(symbols);

    for (let i = 0; i < supportedTokens.length; i++) {
      const token = supportedTokens[i];
      const cgID = symbols[i];
      const tokenContract = getTokenContract(token);

      const [symbol, decimalsRaw, tokenState] = await Promise.all([
        tokenContract.methods.symbol().call(),
        tokenContract.methods.decimals().call(),
        LendingPoolContract.methods.tokenState(token).call()
      ]);

      const decimals = Number(decimalsRaw);
      const priceUSD = prices[cgID]?.usd || 0;

      const supplied = parseFloat(ethers.formatUnits(tokenState.totalDeposits, decimals));
      const borrowed = parseFloat(ethers.formatUnits(tokenState.totalBorrows, decimals));

      totalSuppliedUSD += supplied * priceUSD;
      totalBorrowedUSD += borrowed * priceUSD;
    }

    const totalAvailableUSD = totalSuppliedUSD - totalBorrowedUSD;

    return res.status(200).json({
      totalMarketSize: `$${totalSuppliedUSD.toFixed(2)}`,
      totalAvailable: `$${totalAvailableUSD.toFixed(2)}`,
      totalBorrows: `$${totalBorrowedUSD.toFixed(2)}`
    });
  } catch (err) {
    return res.status(500).json({
      error: "Failed to fetch market overview",
      details: err.message
    });
  }
}












};

module.exports = LendingController;
