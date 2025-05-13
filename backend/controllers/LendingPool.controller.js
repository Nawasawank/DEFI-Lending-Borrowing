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
  
      const priceData = await fetchTokenPrices([coingeckoMap[tokenKey]]);
      const priceUSD = priceData[coingeckoMap[tokenKey]]?.usd;
  
      if (!priceUSD) {
        return res.status(500).json({ error: 'Unable to fetch price for token' });
      }
  
      const balanceHuman = Number(ethers.formatUnits(currentBalance, decimals));
      const debtRaw = await LendingPoolContract.methods.repayBalanceOf(assetAddress, fromAddress).call();
      const debtHuman = Number(ethers.formatUnits(debtRaw, decimals));
  
      let maxWithdrawAmount;
  
      if (debtHuman === 0) {
        maxWithdrawAmount = balanceHuman;
      } else {
        const liquidationThreshold = Number(liquidationThresholdBP) / 100000;
        const minCollateralUSD = debtHuman * priceUSD / liquidationThreshold;
        const balanceUSD = balanceHuman * priceUSD;
        let availableUSD = balanceUSD - minCollateralUSD;
        if (availableUSD < 0) availableUSD = 0;
        maxWithdrawAmount = availableUSD / priceUSD;
      }
  
      if (Number(amount) > maxWithdrawAmount) {
        return res.status(400).json({
          error: 'Requested amount exceeds safe withdrawal limit',
          maxWithdraw: maxWithdrawAmount.toFixed(18),
          priceUSD,
          liquidationThreshold: (Number(liquidationThresholdBP) / 1000).toFixed(2) + '%',
          safeToWithdrawAll: debtHuman === 0
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

  async getTotalSuppliedAndBorrow(req, res) {
    const { assetAddress } = req.query;
  
    if (!isAddress(assetAddress)) {
      return res.status(400).json({ error: "Invalid token address" });
    }
  
    try {
      const tokenContract = getTokenContract(assetAddress);
  
      const [symbol, decimalsRaw] = await Promise.all([
        tokenContract.methods.symbol().call(),
        tokenContract.methods.decimals().call()
      ]);
      const decimals = Number(decimalsRaw);
  
      const [tokenState, supplyCapRaw, borrowCapRaw, prices] = await Promise.all([
        LendingPoolContract.methods.tokenState(assetAddress).call(),
        LendingPoolContract.methods.supplyCap(assetAddress).call(),
        LendingPoolContract.methods.borrowCap(assetAddress).call(),
        fetchTokenPrices([coingeckoMap[symbol]])
      ]);
  
      const tokenPrice = prices[coingeckoMap[symbol]]?.usd || 0;
  
      const totalSupplied = parseFloat(ethers.formatUnits(tokenState.totalDeposits, decimals));
      const totalBorrowed = parseFloat(ethers.formatUnits(tokenState.totalBorrows, decimals));
      const supplyCap = parseFloat(ethers.formatUnits(supplyCapRaw, decimals));
      const borrowCap = parseFloat(ethers.formatUnits(borrowCapRaw, decimals));
  
      const suppliedInUSD = (totalSupplied * tokenPrice).toFixed(2);
      const supplyCapInUSD = (supplyCap * tokenPrice).toFixed(2);
      const borrowedInUSD = (totalBorrowed * tokenPrice).toFixed(2);
      const borrowCapInUSD = (borrowCap * tokenPrice).toFixed(2);
  
      const supplyPercent = supplyCap === 0 ? "0.00" : ((totalSupplied / supplyCap) * 100).toFixed(2);
      const borrowPercentOfSupply = totalSupplied === 0 ? "0.00" : ((totalBorrowed / totalSupplied) * 100).toFixed(2);
  
      return res.status(200).json({
        reserve: {
          supplied: `${totalSupplied.toFixed(2)} ${symbol}`,
          suppliedInUSD: `$${suppliedInUSD}`,
          supplyCap: `${supplyCap.toFixed(2)} ${symbol}`,
          supplyCapInUSD: `$${supplyCapInUSD}`,
          supplyPercent: `${supplyPercent}%`,
          borrowed: `${totalBorrowed.toFixed(2)} ${symbol}`,
          borrowedInUSD: `$${borrowedInUSD}`,
          borrowPercentOfSupply: `${borrowPercentOfSupply}%`,
          borrowCap: `${borrowCap.toFixed(2)} ${symbol}`,
          borrowCapInUSD: `$${borrowCapInUSD}`
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

  async getSupplyAPYandUtilization(req, res) {
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
  async getSupplyAPY(req, res) {
    try {
      const supportedTokens = await LendingPoolContract.methods.getSupportedTokens().call();
  
      const results = await Promise.all(
        supportedTokens.map(async (token) => {
          try {
            const [utilization, supplyAPY] = await Promise.all([
              LendingPoolContract.methods.getUtilization(token).call(),
              InterestModel.methods.getSupplyAPY(token, await LendingPoolContract.methods.getUtilization(token).call()).call()
            ]);
  
            return {
              asset: token,
              supplyAPY: (Number(supplyAPY) / 100).toFixed(2) + '%',
              rawBasisPoints: supplyAPY.toString(),
            };
          } catch (innerErr) {
            console.error(`Failed to get APY for ${token}:`, innerErr.message);
            return {
              asset: token,
              error: "Failed to calculate APY",
              details: innerErr.message
            };
          }
        })
      );
  
      return res.status(200).json(results);
    } catch (err) {
      console.error("Error in getSupplyAPY:", err.message);
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
async getTotalCollateralRawSum(req, res) {
  try {
    const { userAddress } = req.query;
    if (!isAddress(userAddress)) {
      return res.status(400).json({ error: 'Invalid user address' });
    }

    const result = await LendingPoolContract.methods.getUserCollateral(userAddress).call();
    const tokenAddresses = result[0];
    const balances = result[1];

    let totalRawSum = 0;

    for (let i = 0; i < tokenAddresses.length; i++) {
      const tokenAddress = tokenAddresses[i];
      const rawBalance = balances[i];

      if (rawBalance === "0") continue;

      const tokenContract = getTokenContract(tokenAddress);
      const decimalsRaw = await tokenContract.methods.decimals().call();
      const decimals = Number(decimalsRaw);
      const balance = parseFloat(ethers.formatUnits(rawBalance.toString(), decimals));

      totalRawSum += balance;
    }

    return res.status(200).json({
      user: userAddress,
      totalCollateralTokenSum: totalRawSum.toFixed(18)
    });

  } catch (err) {
    return res.status(500).json({
      error: 'Failed to calculate total collateral sum',
      details: err.message
    });
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

    const { 0: tokenAddresses, 1: balances } = await LendingPoolContract.methods
      .getUserCollateral(userAddress)
      .call();

    const tokensToProcess = tokenAddresses.filter((_, i) => balances[i] !== "0");

    if (tokensToProcess.length === 0) {
      return res.status(200).json({ user: userAddress, totalCollateralUSD: "0.00" });
    }


    await Promise.allSettled(tokensToProcess.map(token =>
      LendingPoolContract.methods.accrueInterest(token).send({ from: userAddress })
    ));

    const tokenInfos = await Promise.all(
      tokensToProcess.map(async (token, i) => {
        const rawBalance = balances[i];
        const tokenContract = getTokenContract(token);
        const [symbol, decimalsRaw] = await Promise.all([
          tokenContract.methods.symbol().call(),
          tokenContract.methods.decimals().call()
        ]);
        const decimals = Number(decimalsRaw);
        const userBalance = parseFloat(ethers.formatUnits(rawBalance.toString(), decimals));
        const cgID = coingeckoMap[symbol.toUpperCase()];
        if (userBalance > 0 && cgID) {
          return { cgID, userBalance };
        }
        return null;
      })
    );

    const validInfos = tokenInfos.filter(Boolean);
    if (validInfos.length === 0) {
      return res.status(200).json({ user: userAddress, totalCollateralUSD: "0.00" });
    }

    const uniqueCgIDs = [...new Set(validInfos.map(i => i.cgID))];
    const priceMap = await fetchTokenPrices(uniqueCgIDs);

    const totalUSD = validInfos.reduce((sum, { cgID, userBalance }) => {
      const price = priceMap[cgID]?.usd;
      if (typeof price === "number") {
        sum += userBalance * price;
      }
      return sum;
    }, 0);

    return res.status(200).json({
      user: userAddress,
      totalCollateralUSD: totalUSD.toFixed(18),
    });
  } catch (err) {
    console.error('Error in SumAllCollateral:', err);
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

      await LendingPoolContract.methods.accrueInterest(assetAddress).send({ from: userAddress })
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
  
      // Get price data for the asset being withdrawn
      const priceData = await fetchTokenPrices([coingeckoMap[tokenKey]]);
      const priceUSD = priceData[coingeckoMap[tokenKey]]?.usd;
      if (!priceUSD || isNaN(priceUSD)) {
        return res.status(500).json({ error: 'Unable to fetch valid price for token' });
      }
  
      // Simulate interest accrual for this asset
      await LendingPoolContract.methods.accrueBorrowInterest(assetAddress).call();
      
      // Get the repay balance directly
      const debt = await LendingPoolContract.methods
        .repayBalanceOf(assetAddress, userAddress)
        .call();
      
      // Calculate debt in USD
      const debtAmount = parseFloat(ethers.formatUnits(debt, decimals));
      const borrowedUSD = debtAmount * priceUSD;
  
      // Calculate the maximum withdrawable amount
      const balanceHuman = Number(ethers.formatUnits(currentBalance, decimals));
      const balanceUSD = balanceHuman * priceUSD;
      console.log("Balance USD:", balanceUSD);
      console.log("Borrowed USD:", borrowedUSD);
  
      let availableUSD;
      if (borrowedUSD === 0) {
        availableUSD = balanceUSD;
      } else {
        availableUSD = balanceUSD - (borrowedUSD / (Number(liquidationThresholdBP) / 100000));
        console.log(Number(liquidationThresholdBP));
        
        if (availableUSD < 0) availableUSD = 0;
      }
  
      console.log("Available USD:", availableUSD);
      const maxWithdrawAmount = availableUSD / priceUSD;
  
      return res.status(200).json({
        user: userAddress,
        asset: assetAddress,
        maxWithdraw: String(maxWithdrawAmount.toFixed(18)),
        totalBorrowedUSD: borrowedUSD.toFixed(2)
      });
  
    } catch (err) {
      return res.status(500).json({
        error: 'Failed to calculate max withdraw',
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
        tokenState
      ] = await Promise.all([
        LendingPoolContract.methods.getSupportedTokens().call(),
        getTokenContract(assetAddress),
        getTotalCollateralUSD(fromAddress),
        LendingPoolContract.methods.maxLTV(assetAddress).call(),
        LendingPoolContract.methods.tokenState(assetAddress).call()
      ]);
  
      const symbol = await tokenContract.methods.symbol().call();
      const coingeckoID = coingeckoMap[symbol];
      const priceData = await fetchTokenPrices([coingeckoID]);
      const priceUSD = priceData[coingeckoID]?.usd;
      if (!priceUSD || isNaN(priceUSD)) {
        return res.status(500).json({
          error: `Unable to fetch price for token: ${assetAddress}`,
          details: "Ensure the token is mapped correctly in coingeckoMap and the API is reachable."
        });
      }
  
      const collateralUSD = parseFloat(collateral.totalCollateralUSD);
      const maxLTV = Number(maxLTVBP) / 1e5;
      console.log("Max LTV:", maxLTV);
      
      const maxBorrowableUSD = collateralUSD * maxLTV;
  
      // 📍 Before checking, accrue borrow interest
      await LendingPoolContract.methods.accrueBorrowInterest(assetAddress).send({ from: fromAddress });
  
      // 📍 Fetch user current debt
      const currentDebtRaw = await LendingPoolContract.methods.repayBalanceOf(assetAddress, fromAddress).call();
      const userDebt = parseFloat(ethers.formatUnits(currentDebtRaw.toString(), DEFAULT_DECIMALS));
      const userDebtUSD = userDebt * priceUSD;
  
      const availableBorrowUSD = Math.max(maxBorrowableUSD - userDebtUSD, 0);
  
      const borrowValueUSD = Number(amount) * priceUSD;
  
      if (borrowValueUSD > availableBorrowUSD) {
        return res.status(400).json({
          error: "Borrow amount exceeds maximum borrowable limit",
          availableBorrowUSD: availableBorrowUSD.toFixed(2),
          borrowValueUSD: borrowValueUSD.toFixed(2)
        });
      }
  
      // Prepare tokenPrices array
      const allPrices = await fetchTokenPrices(Object.values(coingeckoMap));
      const tokenPricesUSD = await Promise.all(
        supportedTokens.map(async (token) => {
          const tokenSymbol = await getTokenContract(token).methods.symbol().call();
          const tokenCoingeckoID = coingeckoMap[tokenSymbol];
          const p = allPrices[tokenCoingeckoID]?.usd || 0;
          return ethers.parseUnits(p.toFixed(18), 18).toString();
        })
      );
  
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
      return res.status(500).json({ error: "Borrow failed", details: err.message });
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
      
      const MAX_UINT256 = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");

      let formattedHealthFactor;
      if (BigInt(healthFactor) === MAX_UINT256) {
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
    const [symbol, decimalsRaw, maxLTVBPRaw, borrowCapRaw, tokenState] = await Promise.all([
      tokenContract.methods.symbol().call(),
      tokenContract.methods.decimals().call(),
      LendingPoolContract.methods.maxLTV(assetAddress).call(),
      LendingPoolContract.methods.borrowCap(assetAddress).call(),
      LendingPoolContract.methods.tokenState(assetAddress).call()
    ]);

    const decimals = Number(decimalsRaw);
    const borrowCap = BigInt(borrowCapRaw);
    const totalBorrows = BigInt(tokenState.totalBorrows);

    if (totalBorrows >= borrowCap) {
      return res.status(400).json({
        error: 'Cannot borrow as borrow cap is exceeded',
        borrowCap: ethers.formatUnits(borrowCap.toString(), decimals),
        totalBorrows: ethers.formatUnits(totalBorrows.toString(), decimals)
      });
    }

    const cgID = coingeckoMap[symbol.toUpperCase()];
    if (!cgID) {
      return res.status(400).json({ error: `Symbol ${symbol} is not mapped to a price feed` });
    }

    const [priceData, collateralData] = await Promise.all([
      fetchTokenPrices([cgID]),
      getTotalCollateralUSD(userAddress)
    ]);

    const priceUSD = priceData[cgID]?.usd;
    if (!priceUSD || isNaN(priceUSD)) {
      return res.status(500).json({ error: 'Unable to fetch valid price for token' });
    }

    const collateralUSD = parseFloat(collateralData.totalCollateralUSD);
    const maxLTVBP = Number(maxLTVBPRaw);

    const maxBorrowableUSD = collateralUSD * (maxLTVBP / 1e5);

    await LendingPoolContract.methods.accrueBorrowInterest(assetAddress).send({ from: userAddress });

    const debtRaw = await LendingPoolContract.methods.repayBalanceOf(assetAddress, userAddress).call();
    const userBorrowBalance = parseFloat(ethers.formatUnits(debtRaw.toString(), decimals));
    const userBorrowUSD = userBorrowBalance * priceUSD;

    const availableBorrowUSD = Math.max(maxBorrowableUSD - userBorrowUSD, 0);
    const availableBorrowAmount = availableBorrowUSD / priceUSD;

    return res.status(200).json({
      asset: assetAddress,
      symbol,
      maxBorrow: availableBorrowAmount.toFixed(decimals),
      maxBorrowUSD: availableBorrowUSD.toFixed(decimals),
    });

  } catch (err) {
    return res.status(500).json({
      error: 'Failed to calculate max borrowable',
      details: err.message
    });
  }
},

// async PreviewHealthFactor(req, res) {
//   try {
//     const { userAddress, assetAddress, borrowAmount } = req.query;

//     if (!isAddress(userAddress) || !isAddress(assetAddress)) {
//       return res.status(400).json({ error: "Invalid address" });
//     }
//     if (isNaN(borrowAmount) || Number(borrowAmount) <= 0) {
//       return res.status(400).json({ error: "Invalid borrow amount" });
//     }

//     const borrowAmountNum = Number(borrowAmount);

//     // Fetch supported tokens and price list (array)
//     const supportedTokens = await LendingPoolContract.methods.getSupportedTokens().call();
//     const tokenPricesList = await getTokenPricesForHealthFactor(supportedTokens); // array aligned with supportedTokens

//     let totalAdjustedCollateral = 0;
//     let totalBorrowedUSD = 0;

//     for (let i = 0; i < supportedTokens.length; i++) {
//       const token = supportedTokens[i];
//       const priceUSD = tokenPricesList[i] / 1e18; // because your priceutils returns * 1e18

//       const tokenContract = getTokenContract(token);
//       const [
//         depositInfo,
//         tokenState,
//         liquidationThresholdBP,
//         decimalsRaw
//       ] = await Promise.all([
//         LendingPoolContract.methods.deposits(token, userAddress).call(),
//         LendingPoolContract.methods.tokenState(token).call(),
//         LendingPoolContract.methods.liquidationThreshold(token).call(),
//         tokenContract.methods.decimals().call()
//       ]);

//       const userShares = BigInt(depositInfo.shares);
//       const totalDeposits = BigInt(tokenState.totalDeposits);
//       const totalShares = BigInt(tokenState.totalShares);

//       if (userShares === 0n || totalShares === 0n) continue;

//       const balanceRaw = (userShares * totalDeposits) / totalShares;
//       const decimals = Number(decimalsRaw);
//       const balance = Number(ethers.formatUnits(balanceRaw.toString(), decimals));

//       const collateralUSD = balance * priceUSD;
//       const adjusted = collateralUSD * (Number(liquidationThresholdBP) / 10000);
//       totalAdjustedCollateral += adjusted;

//       const borrowSharesRaw = await LendingPoolContract.methods.borrowShares(token, userAddress).call();
//       const borrowShares = BigInt(borrowSharesRaw);
//       const totalBorrowShares = BigInt(tokenState.totalBorrowShares);
//       const totalBorrows = BigInt(tokenState.totalBorrows);
      

//       if (borrowShares > 0n && totalBorrowShares > 0n) {
//         const userDebt = (borrowShares * totalBorrows) / totalBorrowShares;
//         const debt = Number(ethers.formatUnits(userDebt.toString(), decimals));
//         console.log("Debt:", debt, "Price USD:", priceUSD);
        
//         totalBorrowedUSD += debt * priceUSD;
//       }
//     }

//     // Get borrow token price
//     const borrowTokenContract = getTokenContract(assetAddress);
//     const [symbol, decimalsRaw] = await Promise.all([
//       borrowTokenContract.methods.symbol().call(),
//       borrowTokenContract.methods.decimals().call()
//     ]);

//     // Try to find borrow token price by index
//     let borrowTokenIndex = supportedTokens.findIndex(addr => addr.toLowerCase() === assetAddress.toLowerCase());
//     if (borrowTokenIndex === -1) {
//       return res.status(400).json({ error: `Borrow asset ${symbol} not found in supportedTokens` });
//     }

//     const borrowPriceUSD = tokenPricesList[borrowTokenIndex] / 1e18;
//     const additionalBorrowUSD = borrowAmountNum * borrowPriceUSD;
//     const newTotalBorrowedUSD = totalBorrowedUSD + additionalBorrowUSD;

//     let newHealthFactor;
//     if (newTotalBorrowedUSD === 0) {
//       newHealthFactor = "Infinity";
//     } else {
//       newHealthFactor = (totalAdjustedCollateral / newTotalBorrowedUSD).toFixed(6);
//     }

//     return res.status(200).json({
//       user: userAddress,
//       asset: assetAddress,
//       borrowAmount: borrowAmount.toString(),
//       borrowValueUSD: additionalBorrowUSD.toFixed(2),
//       newHealthFactor
//     });

//   } catch (err) {
//     console.error("PreviewHealthFactor error:", err.message);
//     return res.status(500).json({
//       error: "Failed to preview health factor",
//       details: err.message
//     });
//   }
// },
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

    await LendingPoolContract.methods.accrueBorrowInterest(assetAddress).send({ from: userAddress });

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
    const { userAddress } = req.query;
    if (!isAddress(userAddress)) {
      return res.status(400).json({ error: 'Invalid user address' });
    }

    const { 0: tokenAddresses, 1: rawPrincipals } = await LendingPoolContract.methods
      .getUserBorrow(userAddress)
      .call();

    const tokensToProcess = tokenAddresses.filter((_, i) => rawPrincipals[i] !== "0");

    if (tokensToProcess.length === 0) {
      return res.status(200).json({ user: userAddress, totalBorrowUSD: "0.00" });
    }

    // Accrue borrow interests in parallel but don't await each one individually
    await Promise.allSettled(tokensToProcess.map(token =>
      LendingPoolContract.methods.accrueBorrowInterest(token).send({ from: userAddress })
    ));

    const tokenInfos = await Promise.all(
      tokensToProcess.map(async token => {
        const [rawDebt, tokenContract] = await Promise.all([
          LendingPoolContract.methods.repayBalanceOf(token, userAddress).call(),
          getTokenContract(token),
        ]);
        if (rawDebt === "0") return null;
        const [symbol, decimalsRaw] = await Promise.all([
          tokenContract.methods.symbol().call(),
          tokenContract.methods.decimals().call(),
        ]);
        const decimals = Number(decimalsRaw);
        const debtAmount = parseFloat(ethers.formatUnits(rawDebt.toString(), decimals));
        const cgID = coingeckoMap[symbol];
        if (!cgID) return null;
        return { cgID, debtAmount };
      })
    );

    const validInfos = tokenInfos.filter(Boolean);
    if (validInfos.length === 0) {
      return res.status(200).json({ user: userAddress, totalBorrowUSD: "0.00" });
    }

    const uniqueCgIDs = [...new Set(validInfos.map(i => i.cgID))];
    const priceMap = await fetchTokenPrices(uniqueCgIDs);

    const totalUSD = validInfos.reduce((sum, { cgID, debtAmount }) => {
      const price = priceMap[cgID]?.usd;
      if (typeof price === "number") {
        sum += debtAmount * price;
      }
      return sum;
    }, 0);

    return res.status(200).json({
      user: userAddress,
      totalBorrowUSD: totalUSD.toFixed(18),
    });
  } catch (err) {
    console.error('Error in SumAllBorrow:', err);
    return res.status(500).json({
      error: 'Failed to fetch total borrow USD',
      details: err.message,
    });
  }
},
async getBorrowerDebt(req, res) {
  try {
    const { userAddress } = req.query;

    if (!isAddress(userAddress)) {
      return res.status(400).json({ error: 'Invalid user address' });
    }

    const result = await LendingPoolContract.methods.getUserBorrow(userAddress).call();
    const tokenAddresses = result[0];

    const debt = await Promise.all(
      tokenAddresses.map(async (tokenAddress) => {
        try {
          // Accrue borrow interest first
          await LendingPoolContract.methods.accrueBorrowInterest(tokenAddress).send({ from: userAddress });

          const rawDebt = await LendingPoolContract.methods.repayBalanceOf(tokenAddress, userAddress).call();
          const raw = rawDebt.toString();
          const tokenContract = getTokenContract(tokenAddress);

          const [symbol, decimalsRaw] = await Promise.all([
            tokenContract.methods.symbol().call(),
            tokenContract.methods.decimals().call()
          ]);

          const decimals = Number(decimalsRaw);
          const balance = ethers.formatUnits(raw, decimals);

          return {
            tokenAddress,
            symbol,
            balance,
            raw
          };
        } catch (innerErr) {
          console.error(`Failed to fetch debt for ${tokenAddress}:`, innerErr.message);
          return {
            tokenAddress,
            error: 'Failed to fetch debt or accrue interest',
            details: innerErr.message
          };
        }
      })
    );

    return res.status(200).json({
      user: userAddress,
      debt
    });

  } catch (err) {
    console.error('Error in getBorrowerDebt:', err.message);
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

    // Collateral
    const collRes = await LendingPoolContract.methods.getUserCollateral(userAddress).call();
    const colTokens = collRes.tokens || collRes[0];
    const colBalances = collRes.balances || collRes[1];

    // Borrow
    const borrowRes = await LendingPoolContract.methods.getUserBorrow(userAddress).call();
    const bTokens = borrowRes.tokens || borrowRes[0];
    const rawPrincipals = borrowRes.amounts || borrowRes[1];

    const cgIDs = new Set();
    const coll = [];
    const debts = [];
    const rateInfo = [];

    // --- Collateral Loop ---
    await Promise.all(colTokens.map(async (token, i) => {
      if (colBalances[i] === '0') return;
      const tokenC = getTokenContract(token);
      const [sym, dec] = await Promise.all([
        tokenC.methods.symbol().call(),
        tokenC.methods.decimals().call()
      ]);
      const bal = parseFloat(ethers.formatUnits(colBalances[i], Number(dec)));
      const cgID = coingeckoMap[sym];
      if (!cgID) return console.warn(`Missing CoinGecko ID for ${sym}`);
      cgIDs.add(cgID);
      coll.push({ cgID, balance: bal });
    }));

    // --- Borrow Loop ---
    await Promise.all(bTokens.map(async (token, i) => {
      if (rawPrincipals[i] === '0') return;
      const raw = await LendingPoolContract.methods.repayBalanceOf(token, userAddress).call();
      if (raw === '0') return;

      const tokenC = getTokenContract(token);
      const [sym, dec] = await Promise.all([
        tokenC.methods.symbol().call(),
        tokenC.methods.decimals().call()
      ]);
      const bal = parseFloat(ethers.formatUnits(raw, Number(dec)));
      const cgID = coingeckoMap[sym];
      if (cgID) {
        cgIDs.add(cgID);
        debts.push({ cgID, balance: bal });
      } else {
        console.warn(`Missing CoinGecko ID for ${sym}`);
      }

      const util = await LendingPoolContract.methods.getUtilization(token).call();
      const brBP = await InterestModel.methods.getBorrowRate(token, util).call();
      rateInfo.push({ borrowRateBP: brBP, balance: bal });
    }));

    // If no data available
    if (cgIDs.size === 0) {
      return res.status(200).json({
        user: userAddress,
        netWorthUSD: "0.00",
        netAPY: "0.00%"
      });
    }

    const prices = await fetchTokenPrices(Array.from(cgIDs));

    // --- Calculate Collateral in USD ---
    let totalCollateralUSD = 0;
    for (const { cgID, balance } of coll) {
      const price = prices[cgID]?.usd;
      if (price !== undefined) {
        totalCollateralUSD += balance * price;
      } else {
        console.warn(`Price missing for ${cgID} in collateral`);
      }
    }

    // --- Calculate Debt in USD ---
    let totalBorrowUSD = 0;
    for (const { cgID, balance } of debts) {
      const price = prices[cgID]?.usd;
      if (price !== undefined) {
        totalBorrowUSD += balance * price;
      } else {
        console.warn(`Price missing for ${cgID} in debt`);
      }
    }

    // --- Interest Rates ---
    const supplyAPRbp = await LendingPoolContract.methods.getTotalSupplyAPY(userAddress).call();
    const supplyAPR = Number(supplyAPRbp) / 10000;

    const totalDebtAmt = rateInfo.reduce((sum, r) => sum + r.balance, 0);
    let weightedBorrowAPR = 0;
    if (totalDebtAmt > 0) {
      weightedBorrowAPR = rateInfo.reduce((sum, { borrowRateBP, balance }) =>
        sum + (Number(borrowRateBP) / 10000) * balance, 0) / totalDebtAmt;
    }

    const netAPY = (supplyAPR - weightedBorrowAPR) * 100;
    const netWorth = totalCollateralUSD - totalBorrowUSD;

    return res.status(200).json({
      user: userAddress,
      netWorthUSD: netWorth.toFixed(2),
      netAPY: netAPY.toFixed(2) + '%'
    });

  } catch (err) {
    return res.status(500).json({
      error: 'Failed to fetch net overview',
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
},
async getUserTotalDebtUSD(req, res) {
  try {
    const { userAddress } = req.query;

    if (!isAddress(userAddress)) {
      return res.status(400).json({ error: 'Invalid user address' });
    }

    const supportedTokens = await LendingPoolContract.methods.getSupportedTokens().call();

    let totalDebtUSD = 0;

    for (const tokenAddress of supportedTokens) {
      try {
        // Accrue latest borrow interest
        await LendingPoolContract.methods.accrueBorrowInterest(tokenAddress).send({ from: userAddress });

        const debtRaw = await LendingPoolContract.methods.repayBalanceOf(tokenAddress, userAddress).call();
        if (BigInt(debtRaw) === 0n) continue; // No debt, skip

        const tokenContract = getTokenContract(tokenAddress);

        const [symbol, decimalsRaw] = await Promise.all([
          tokenContract.methods.symbol().call(),
          tokenContract.methods.decimals().call()
        ]);
        const decimals = Number(decimalsRaw);

        const userDebt = parseFloat(ethers.formatUnits(debtRaw.toString(), decimals));

        // Get USD price
        const cgID = coingeckoMap[symbol.toUpperCase()];
        if (!cgID) {
          console.warn(`No Coingecko ID found for ${symbol}, skipping.`);
          continue;
        }

        const priceData = await fetchTokenPrices([cgID]);
        const priceUSD = priceData[cgID]?.usd;
        if (!priceUSD) {
          console.warn(`No price found for ${symbol}, skipping.`);
          continue;
        }

        // Add to total
        totalDebtUSD += userDebt * priceUSD;
      } catch (innerErr) {
        console.error(`Error processing token ${tokenAddress}:`, innerErr.message);
      }
    }

    return res.status(200).json({
      user: userAddress,
      totalDebtUSD: totalDebtUSD.toFixed(18)
    });

  } catch (err) {
    console.error('Error in getUserTotalDebtUSD:', err.message);
    return res.status(500).json({ error: 'Failed to fetch total debt', details: err.message });
  }
},
async getAllTotalSuppliedAndBorrow(req, res) {
  try {
    const supportedTokens = await LendingPoolContract.methods.getSupportedTokens().call();

    const results = [];

    for (const assetAddress of supportedTokens) {
      try {
        const tokenContract = getTokenContract(assetAddress);

        const [symbol, decimalsRaw, tokenState] = await Promise.all([
          tokenContract.methods.symbol().call(),
          tokenContract.methods.decimals().call(),
          LendingPoolContract.methods.tokenState(assetAddress).call()
        ]);

        const decimals = Number(decimalsRaw);

        const totalSupplied = parseFloat(ethers.formatUnits(tokenState.totalDeposits, decimals)).toFixed(2);
        const totalBorrowed = parseFloat(ethers.formatUnits(tokenState.totalBorrows, decimals)).toFixed(2);

        results.push({
          assetAddress,
          symbol,
          totalSupplied,
          totalBorrowed
        });
      } catch (innerErr) {
        console.error(`Error fetching data for token ${assetAddress}:`, innerErr.message);
      }
    }

    return res.status(200).json(results);

  } catch (err) {
    console.error("Error fetching total supplied and borrowed for all assets:", err.message);
    return res.status(500).json({
      error: "Failed to fetch total supplied and borrowed for all assets",
      details: err.message
    });
  }
},
async PreviewHealthFactorBorrow(req, res) {
  try {
    const { userAddress, assetAddress, borrowAmount } = req.query;
    
    // Validate addresses early to avoid unnecessary processing
    if (!isAddress(userAddress) || !isAddress(assetAddress)) {
      return res.status(400).json({ error: 'Invalid address' });
    }
    
    if (isNaN(borrowAmount) || Number(borrowAmount) <= 0) {
      return res.status(400).json({ error: 'Invalid borrow amount' });
    }
    
    const borrowAmountInSmallestUnit = ethers.parseUnits(borrowAmount.toString(), 18);
    
    const [supportedTokens, MAX_UINT256] = await Promise.all([
      LendingPoolContract.methods.getSupportedTokens().call(),
      Promise.resolve(BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"))
    ]);
    
    const tokenPricesUSD = await getTokenPricesForHealthFactor(supportedTokens);
    
    const tokenPricesUSDInSmallestUnit = tokenPricesUSD.map(price => 
      ethers.parseUnits(
        price.toLocaleString("fullwide", { useGrouping: false }), 
        18
      ).toString()
    );
    
    // Get health factor
    const healthFactor = await LendingPoolContract.methods
      .previewHealthFactorAfterBorrow(
        userAddress, 
        assetAddress, 
        borrowAmountInSmallestUnit, 
        tokenPricesUSDInSmallestUnit
      )
      .call();
      
    // Format health factor
    const formattedHealthFactor = BigInt(healthFactor) === MAX_UINT256 
      ? "-" 
      : ethers.formatUnits(healthFactor, 18);
    
    return res.status(200).json({
      user: userAddress,
      asset: assetAddress,
      borrowAmount,
      healthFactor: formattedHealthFactor
    });
    
  } catch (err) {
    return res.status(500).json({
      error: 'Failed to preview health factor after borrow',
      details: err.message
    });
  }
},

async PreviewHealthFactorRepay(req, res) {
  try {
    const { userAddress, assetAddress, repayAmount } = req.query;

    if (!isAddress(userAddress) || !isAddress(assetAddress)) {
      return res.status(400).json({ error: 'Invalid address' });
    }

    if (isNaN(repayAmount) || Number(repayAmount) <= 0) {
      return res.status(400).json({ error: 'Invalid repay amount' });
    }

    const repayAmountInSmallestUnit = ethers.parseUnits(repayAmount.toString(), 18);

    const supportedTokens = await LendingPoolContract.methods.getSupportedTokens().call();
    const tokenPricesUSD = await getTokenPricesForHealthFactor(supportedTokens);

    const tokenPricesUSDInSmallestUnit = tokenPricesUSD.map(price => {
      const priceStr = price.toLocaleString("fullwide", { useGrouping: false });
      return ethers.parseUnits(priceStr, 18).toString();
    });

    const healthFactor = await LendingPoolContract.methods
      .previewHealthFactorAfterRepay(userAddress, assetAddress, repayAmountInSmallestUnit, tokenPricesUSDInSmallestUnit)
      .call();

      const INFINITE_HEALTH = BigInt("1000000000000000000000000000000000000");

      let formattedHealthFactor;
      if (BigInt(healthFactor) === INFINITE_HEALTH ) {
        formattedHealthFactor = "-";
      } else {
        formattedHealthFactor = ethers.formatUnits(healthFactor, 18);
      }
    return res.status(200).json({
      user: userAddress,
      asset: assetAddress,
      repayAmount,
      healthFactor: formattedHealthFactor,
    });

  } catch (err) {
    return res.status(500).json({
      error: 'Failed to preview health factor after repay',
      details: err.message,
    });
  }
},

async checkTokenStatus(req, res) {
  try {
    const supportedTokens = await LendingPoolContract.methods.getSupportedTokens().call();

    const results = await Promise.all(supportedTokens.map(async (assetAddress) => {
      try {
        const [tokenState, supplyCapRaw, borrowCapRaw] = await Promise.all([
          LendingPoolContract.methods.tokenState(assetAddress).call(),
          LendingPoolContract.methods.supplyCap(assetAddress).call(),
          LendingPoolContract.methods.borrowCap(assetAddress).call()
        ]);

        const totalSupplied = BigInt(tokenState.totalDeposits);
        const totalBorrowed = BigInt(tokenState.totalBorrows);
        const supplyCap = BigInt(supplyCapRaw);
        const borrowCap = BigInt(borrowCapRaw);

        const availableLiquidity = totalSupplied > totalBorrowed
          ? totalSupplied - totalBorrowed
          : 0n;

        return {
          asset: assetAddress,
          isSupplyFull: totalSupplied >= supplyCap,
          isBorrowFull: totalBorrowed >= borrowCap,
          isEmpty: availableLiquidity === 0n,
        };
      } catch (tokenErr) {
        return {
          asset: assetAddress,
          isSupplyFull: null,
          isBorrowFull: null,
          isEmpty: null,
          availableLiquidity: null,
          error: tokenErr.message
        };
      }
    }));

    return res.status(200).json(results);
  } catch (err) {
    return res.status(500).json({
      error: 'Failed to check token status',
      details: err.message
    });
  }
}



};

module.exports = LendingController;