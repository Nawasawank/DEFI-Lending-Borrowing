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
      if (!isAddress(assetAddress))
        return res.status(400).json({ error: 'Invalid token address' });

      const [ supplyCap, borrowCap, maxLTV, liquidationThreshold, liquidationPenalty ] = await Promise.all([
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
  
      const [tokenState, supplyCap, utilizationRaw, prices] = await Promise.all([
        LendingPoolContract.methods.tokenState(assetAddress).call(),
        LendingPoolContract.methods.supplyCap(assetAddress).call(),
        LendingPoolContract.methods.getUtilization(assetAddress).call(),
        fetchTokenPrices([coingeckoMap[symbol]])
      ]);

      const tokenPrice = prices[coingeckoMap[symbol]]?.usd || 0;
      const totalSupplied = ethers.formatUnits(tokenState.totalDeposits, decimals);
      const maxSupply = ethers.formatUnits(supplyCap, decimals);
      const utilization = (Number(utilizationRaw) / 100).toFixed(2);
      const suppliedInUSD = (parseFloat(totalSupplied) * tokenPrice).toFixed(2);
      const maxSupplyInUSD = (parseFloat(maxSupply) * tokenPrice).toFixed(2);

      return res.status(200).json({
        reserve: {
          supplied: `${parseFloat(totalSupplied).toFixed(2)} ${symbol}`,
          suppliedInUSD: `$${suppliedInUSD}`,
          maxSupply: `${parseFloat(maxSupply).toFixed(2)} ${symbol}`,
          maxSupplyInUSD: `$${maxSupplyInUSD}`,
          utilizationRate: `${utilization}%`,
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
      for (const tokenAddress of Object.keys(faucetMap)) {
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
      return res.status(500).json({ error: "Failed to fetch token balances", details: err.message });
    }
  },

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
      return res.status(500).json({ error: 'Failed to fetch supply APY', details: err.message });
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
        const borrowEvents = await LendingPoolContract.getPastEvents("Borrow", {
            filter: { borrower: userAddress },
            fromBlock: 0,
            toBlock: "latest",
        });
        const repayEvents = await LendingPoolContract.getPastEvents("Repay", {
            filter: { borrower: userAddress },
            fromBlock: 0,
            toBlock: "latest",
        });

        const allEvents = [...depositEvents, ...withdrawEvents, ...borrowEvents, ...repayEvents];
        const formatted = allEvents.map((e) => ({
            type: e.event,
            token: e.returnValues.token,
            amount: ethers.formatUnits(e.returnValues.amount.toString(), DEFAULT_DECIMALS),
            txHash: e.transactionHash,
            blockNumber: String(e.blockNumber),
            timestamp: null,
        }));

        const provider = new ethers.JsonRpcProvider(process.env.PROVIDER_URL);
        for (const tx of formatted) {
            const block = await provider.getBlock(Number(tx.blockNumber));
            tx.timestamp = block.timestamp.toString();
        }
        formatted.sort((a, b) => Number(b.blockNumber) - Number(a.blockNumber));
        return res.status(200).json({
            user: userAddress,
            history: formatted,
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
        const tokenContract = getTokenContract(tokenAddress);
        const [symbol, decimals] = await Promise.all([
          tokenContract.methods.symbol().call(),
          tokenContract.methods.decimals().call(),
        ]);
        results.push({
          tokenAddress,
          symbol,
          balance: ethers.formatUnits(rawBalance.toString(), decimals),
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

        const amountInSmallestUnit = ethers.parseUnits(amount.toString(), DEFAULT_DECIMALS).toString();

        // Fetch supported tokens using the updated ABI
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

        // Fetch token prices for health factor calculation
        const tokenPricesUSD = await getTokenPricesForHealthFactor(supportedTokens);

        // Fetch token symbol dynamically
        const tokenContract = getTokenContract(assetAddress);
        const symbol = await tokenContract.methods.symbol().call();
        console.log("Token Symbol:", symbol);

        // Check if the symbol exists in coingeckoMap
        const coingeckoID = coingeckoMap[symbol];
        if (!coingeckoID) {
            return res.status(400).json({
                error: `Token symbol ${symbol} is not mapped to CoinGecko`,
                details: "Add the token to coingeckoMap with its corresponding CoinGecko ID.",
            });
        }

        // Fetch price data
        const priceData = await fetchTokenPrices([coingeckoID]);
        console.log("Price Data:", priceData);

        const priceUSD = priceData[coingeckoID]?.usd;
        if (!priceUSD) {
            return res.status(500).json({
                error: `Unable to fetch price for token: ${assetAddress}`,
                details: "Ensure the token is mapped correctly in coingeckoMap and the API is reachable.",
            });
        }

        // Call the borrow function on the smart contract
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
            asset: assetAddress,
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

    // Fetch the user's outstanding debt, including interest
    let owed;
    try {
      owed = await LendingPoolContract.methods
        .repayBalanceOf(assetAddress, fromAddress)
        .call();
      console.log("[Repay] Outstanding debt fetched:", owed);
    } catch (err) {
      console.log("[Repay] Failed to fetch repayable balance, falling back to manual calculation:", err.message);
      const borrows = await LendingPoolContract.methods
        .getUserBorrow(fromAddress)
        .call();
      const tokenIndex = borrows.tokens.indexOf(assetAddress);
      if (tokenIndex === -1 || BigInt(borrows.amounts[tokenIndex]) === 0n) {
        console.log("[Repay] Nothing to repay for asset:", assetAddress);
        return res.status(400).json({
          error: 'Nothing to repay',
          outstandingDebt: '0',
        });
      }
      owed = borrows.amounts[tokenIndex];
    }

    if (BigInt(owed) === 0n) {
      console.log("[Repay] No outstanding debt for asset:", assetAddress);
      return res.status(400).json({
        error: 'Nothing to repay',
        outstandingDebt: '0',
      });
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

    // Fetch the updated debt after repayment
    let remainingDebt;
    try {
      remainingDebt = await LendingPoolContract.methods
        .repayBalanceOf(assetAddress, fromAddress)
        .call();
      console.log("[Repay] Remaining debt fetched:", remainingDebt);
    } catch (err) {
      console.log("[Repay] Failed to fetch remaining debt, falling back to manual calculation:", err.message);
      const borrows = await LendingPoolContract.methods
        .getUserBorrow(fromAddress)
        .call();
      const tokenIndex = borrows.tokens.indexOf(assetAddress);
      remainingDebt = tokenIndex !== -1 ? borrows.amounts[tokenIndex] : '0';
    }

    const remainingFormatted = ethers.formatUnits(remainingDebt.toString(), DEFAULT_DECIMALS);
    console.log("[Repay] Remaining debt formatted:", remainingFormatted);

    return res.status(200).json({
      message: 'Repayment successful',
      transactionHash: tx.transactionHash,
      repaidAmount: amount,
      remainingDebt: remainingFormatted,
      asset: assetAddress,
    });
  } catch (err) {
    console.error("[Repay] Repayment error:", err);

    if (err.data && err.data.message) {
      return res.status(500).json({
        error: 'Repayment failed',
        details: err.data.message,
      });
    }

    return res.status(500).json({
      error: 'Repayment failed',
      details: err.message || 'Unknown error occurred during smart contract execution',
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

        // Fetch token prices for health factor calculation
        const tokenPricesUSD = await getTokenPricesForHealthFactor(supportedTokens);

        // Call the getHealthFactor function with the required parameters
        const healthFactor = await LendingPoolContract.methods.getHealthFactor(userAddress, tokenPricesUSD).call();
        const formattedHealthFactor = healthFactor === "0"
            ? "0" // Handle no borrow case
            : ethers.formatUnits(healthFactor, 18); // Format as a human-readable number

        return res.status(200).json({
            user: userAddress,
            healthFactor: formattedHealthFactor
        });
    } catch (err) {
        console.error("Error fetching health factor:", err.message);
        return res.status(500).json({ error: 'Failed to fetch health factor', details: err.message });
    }
},
  
    
};

module.exports = LendingController;
