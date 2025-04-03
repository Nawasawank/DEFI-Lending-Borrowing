require('dotenv').config();
const Web3 = require('web3').default;
const contractJson = require('../build/contracts/MultiPriceConsumer.json');

const providerUrl = process.env.PROVIDER_URL || 'http://127.0.0.1:9545';
const contractAddress = "0x0B635e0E51b574f2029f246424894F11cC25cD45";

const web3 = new Web3(providerUrl);
const MultiPriceContract = new web3.eth.Contract(contractJson.abi, contractAddress);

module.exports = {
  web3,
  MultiPriceContract
};

