require('dotenv').config();
const { ethers } = require("ethers");
const { web3, LendingPoolContract, TokenABI, FaucetABI,InterestModel } = require('../utils/web3.js');
const { isAddress } = require('web3-validator');

const faucetMap = {
  "0x4dCDC6af8AD621B42447F9c0dC6867895E517768": "0xe977E49F245E6265D7947287a5182E883130C82B",
  "0x9e461f11ea7AF0be5621cB5C4E63Fb34AAF9b50F": "0x5442828E5134A802320ED0b30357E24321bdb19a", 
  "0x519068bC9235856c3A835dF58BA9d49107254027": "0x40a5972a126d4901EbE0B00Ef264755aD2261f80", 
  "0xA032c3669911B94529df6f6b2b866c002Baa8267": "0x8403b55FfB7864F22666198281F460792018E5e1", 
  "0x11d20e610512D39a881A9780B64338Eb977c1f84": "0x65A91ff68F751e7901DE597055fb365eED6Df1f2"  
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
  
      const rate = await InterestModel.methods.getUtilizationRate(asset).call();
  
      const rateNum = Number(rate); 
      return res.status(200).json({
        asset,
        utilizationRate: (rateNum / 100).toFixed(2) + '%',
        rawBasisPoints: rate.toString()
      });
  
    } catch (err) {
      return res.status(500).json({ error: 'Failed to fetch utilization rate', details: err.message });
    }
  }  
};

module.exports = LendingController;