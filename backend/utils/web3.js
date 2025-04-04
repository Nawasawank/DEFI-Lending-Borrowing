require('dotenv').config();
const Web3 = require('web3').default;
const PriceContract = require('../build/contracts/PriceOracle.json');

const providerUrl = process.env.PROVIDER_URL || 'http://127.0.0.1:9545';
const PriceContractAddress = process.env.PriceContractAddress;

const web3 = new Web3(providerUrl);
const PriceOracleContract = new web3.eth.Contract(PriceContract.abi, PriceContractAddress);

module.exports = {
  web3,
  PriceOracleContract
};

