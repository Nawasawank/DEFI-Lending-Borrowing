const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("🚀 Deploying contracts with the account:", deployer.address);

  const Token = await ethers.getContractFactory("Token");
  const Faucet = await ethers.getContractFactory("TokenFaucet");
  const LendingPool = await ethers.getContractFactory("LendingPool");

  const initialSupply = ethers.parseEther("1000000");

  const tokens = {};
  const faucets = {};
  const tokenMeta = [
    { name: "Wrapped Ether", symbol: "WETH" },
    { name: "Wrapped Bitcoin", symbol: "WBTC" },
    { name: "USD Coin", symbol: "USDC" },
    { name: "Dai Stablecoin", symbol: "DAI" },
    { name: "GHO Token", symbol: "GHO" }
  ];

  const tokenAddresses = [];

  console.log("Deploying token contracts and faucets...");
  for (const { name, symbol } of tokenMeta) {
    const token = await Token.deploy(name, symbol, deployer.address, initialSupply);
    await token.waitForDeployment();
    console.log(`${symbol} deployed to:`, token.target);
    tokens[symbol] = token.target;
    tokenAddresses.push(token.target);

    const faucet = await Faucet.deploy(token.target);
    await faucet.waitForDeployment();
    console.log(`${symbol} Faucet deployed to:`, faucet.target);
    faucets[symbol] = faucet.target;

    const tx = await token.setFaucet(faucet.target);
    await tx.wait();
    console.log(`Set ${symbol} faucet address in token contract`);
  }

  const lendingPool = await LendingPool.deploy(tokenAddresses);
  await lendingPool.waitForDeployment();
  console.log("LendingPool deployed to:", lendingPool.target);

  console.log("\n🎉 All contracts deployed:");
  console.log("Deployer:", deployer.address);
  console.log("Tokens:");
  for (const [symbol, address] of Object.entries(tokens)) {
    console.log(`  ${symbol}: ${address}`);
  }
  console.log("Faucets:");
  for (const [symbol, address] of Object.entries(faucets)) {
    console.log(`  ${symbol}: ${address}`);
  }
  console.log("LendingPool:", lendingPool.target);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });
