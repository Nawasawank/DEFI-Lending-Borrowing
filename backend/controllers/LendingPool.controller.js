require('dotenv').config();
const { ethers } = require("ethers");
const { web3, LendingPoolContract, TokenABI, FaucetABI } = require('../utils/web3.js');
const { isAddress } = require('web3-validator');

const faucetMap = {
  "0x205dC7D16c110ca71c0cBabca1Ec165e95f48ED7": "0x426aF8C92c24AC366A643E61C21EC02b22549CC1", // WETH
  "0x90dfE955beee92Dab0AeF1872B315f8895F3EeE5": "0x9F34E7A20F935F8D8E73cB0b59b1e8dbC39E198c", // WBTC
  "0x1A4AD281086D526ddC0Eb75E753AccE93EB5E6cf": "0x4f5DeaD96f62309e2829212f3137FCF6FcfC2B12", // USDC
  "0x11aF28AD87DE999577D624187A734EbDCa419CD5": "0x78AF2e1f6A7ad84cc0dC3343BF31633576f479e7", // DAI
  "0x3c5c1238b5B8409A7349B2A719f245972e965614": "0x0AD913da455E9C48FE2f4258554640359f0f23e2"  // GHO
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
  }
  
};

module.exports = LendingController;