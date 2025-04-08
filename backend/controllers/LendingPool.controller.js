require('dotenv').config();
const { ethers } = require("ethers");
const { web3, LendingPoolContract, TokenABI, FaucetABI,InterestModel } = require('../utils/web3.js');
const { isAddress } = require('web3-validator');

const faucetMap = {
  "0xaD5641D48FB5a4Ac7008138C50eD8C443D6a4014": "0x415B90448E30D0Ee2ab11887D8dB0caC32Ee4b79", // WETH
  "0x99F3cf5fACFe240692981cBb344BE400c774Df7b": "0x1487BC42E2dE62BD6a0cD3f91B620a8757191b34", // WBTC
  "0xE4D32700265f886283D5ddaFA9652B7c576E9825": "0x3bF522a2fA7B7A32Bbd66E6d4b0a7B0c683E6028", // USDC
  "0xF969457b5124B73b919805E887744496eDE02763": "0x69a5D3BDbC29fb6161D9F78e2FC7116f2448525B", // DAI
  "0x9400047516EE9C0Da71C00325f4144d85b9F496A": "0x96280Ac5EB0795F3bcd740EF0A1ec864fC6aCe69"  // GHO
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
  }  
};

module.exports = LendingController;