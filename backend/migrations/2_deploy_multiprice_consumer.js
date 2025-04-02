// migrations/3_deploy_real_price_consumer.js
const MultiPriceConsumer = artifacts.require("MultiPriceConsumer");

module.exports = async function(deployer, network, accounts) {
  console.log(`Deploying MultiPriceConsumer to ${network}...`);
  
  // Deploy the contract
  await deployer.deploy(MultiPriceConsumer);
  const priceConsumer = await MultiPriceConsumer.deployed();
  
  console.log(`MultiPriceConsumer deployed at: ${priceConsumer.address}`);
  
  // For Sepolia or mainnet, the constructor has already set up the price feeds
  if (network === "sepolia" || network === "mainnet") {
    console.log("Price feeds initialized in constructor");
  }
};