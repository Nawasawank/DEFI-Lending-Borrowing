require("@nomicfoundation/hardhat-toolbox");
require('@nomicfoundation/hardhat-ethers');
require("hardhat-slither");

module.exports = {
  solidity: "0.8.28",
  networks: {
    development: {
      url: "http://127.0.0.1:7545", // Ganache RPC URL
      chainId: 1337,                // Ganache chain ID
      accounts: [
        "aC808B988f22aB316C63763F97359B380eB6134b" // 👈 Paste your Ganache private key here (no 0x)
      ]
    }
  }
};
