const { web3, TokenABI } = require('../utils/web3.js');

function getTokenContract(assetAddress) {
  return new web3.eth.Contract(TokenABI.abi, assetAddress);
}

module.exports = {
  getTokenContract,
};
