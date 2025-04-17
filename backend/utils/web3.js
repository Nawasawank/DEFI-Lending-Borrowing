require("dotenv").config();
const Web3 = require("web3").default;

// Import compiled contract ABIs
const PriceOracleABI = require("../artifacts/contracts/PriceOracle.sol/PriceOracle.json");
const LendingPoolABI = require("../artifacts/contracts/LendingPool.sol/LendingPool.json");
const TokenABI = require("../artifacts/contracts/Token.sol/Token.json");
const FaucetABI = require("../artifacts/contracts/TokenFaucet.sol/TokenFaucet.json");
const InterestRateABI = require("../artifacts/contracts/InterestRate.sol/InterestRateModel.json");
const LiquidationABI = require("../artifacts/contracts/Liquidation.sol/Liquidation.json"); // Add this line

// Get provider and contract addresses from environment variables
const providerUrl = process.env.PROVIDER_URL || "http://127.0.0.1:7545";
const priceContractAddress = process.env.PRICE_CONTRACT_ADDRESS;
const lendingPoolAddress = process.env.LENDING_POOL_ADDRESS;
const InterestRateAddress = process.env.INTEREST_RATE_MODEL_ADDRESS;
const liquidationAddress = process.env.LIQUIDATION_ADDRESS; // Add this line

// Initialize Web3 instance - only once
const web3 = new Web3(providerUrl);

// Initialize contract instances
const PriceOracleContract = new web3.eth.Contract(
  PriceOracleABI.abi,
  priceContractAddress
);
const LendingPoolContract = new web3.eth.Contract(
  LendingPoolABI.abi,
  lendingPoolAddress
);

const InterestModel = new web3.eth.Contract(
  InterestRateABI.abi,
  InterestRateAddress
);
const LiquidationContract = new web3.eth.Contract(
  LiquidationABI.abi,
  liquidationAddress
);

module.exports = {
  web3,
  PriceOracleContract,
  LendingPoolContract,
  LiquidationContract, // Export the LiquidationContract
  TokenABI,
  FaucetABI,
  InterestModel,
};
