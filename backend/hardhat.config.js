require("@nomicfoundation/hardhat-toolbox");
require('@nomicfoundation/hardhat-ethers');


module.exports = {
  solidity: "0.8.28", 

  networks: {
    development: {
      url: "http://127.0.0.1:7545", 
      chainId: 1337,           
    },
  },
  
};

