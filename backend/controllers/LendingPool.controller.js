require('dotenv').config();
const { ethers } = require("ethers");
const { web3, LendingPoolContract, TokenABI, FaucetABI } = require('../utils/web3.js');
const { isAddress } = require('web3-validator');

const faucetMap = {
  "0xEd53851d940de7b19de141D2659641739921a775": "0xeE02Fe82bFbE33eDD19CE15A8d96D16Fb7713987",
  "0x5C1773fAD2472b261a45fE5080D25987b834FB41": "0x4019e7D63e8436f6ca3F4C160b4dd2ed487d5699", 
  "0x06674888993A9674Bc40243fdA964231eCEF8666": "0x0309c0F347D357cE7A6138F1EdeCf90142E54c78", 
  "0x251239a15e6BFB9DD5F7265DD3E06351c05a5528": "0x9B72bFE1Cb18aC66125bEBD626Bd890D55d30068", 
  "0x0Ea2C78f8836d46bD4b15bEeab76154122aE8Ec6": "0x31369b71D9d36d7b7BF0d2Ac42baDF0810305b96"  
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
  }
};

module.exports = LendingController;