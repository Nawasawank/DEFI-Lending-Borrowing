const PriceOracle = artifacts.require("PriceOracle");

module.exports = async function(deployer, network, accounts) {
  console.log(`Deploying PriceOracle to ${network}...`);
  
  // Deploy the contract
  await deployer.deploy(PriceOracle);
  const PriceOracle_deployed = await PriceOracle.deployed();
  
  console.log(`PriceOracle deployed at: ${PriceOracle_deployed.address}`);
  
  // For Sepolia or mainnet, the constructor has already set up the price feeds
  if (network === "sepolia" || network === "mainnet") {
    console.log("Price feeds initialized in constructor");
  }
};