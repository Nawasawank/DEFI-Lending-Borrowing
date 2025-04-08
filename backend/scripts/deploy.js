const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("🚀 Deploying contracts with the account:", deployer.address);

  const Token = await ethers.getContractFactory("Token");
  const Faucet = await ethers.getContractFactory("TokenFaucet");

  const InterestRateModel = await ethers.getContractFactory("InterestRateModel"); 
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

  const interestRateModel = await InterestRateModel.deploy();
  await interestRateModel.waitForDeployment();
  console.log("✅ InterestRateModel deployed to:", interestRateModel.target);

  const lendingPool = await LendingPool.deploy(tokenAddresses, interestRateModel.target);
  await lendingPool.waitForDeployment();
  console.log("✅ LendingPool deployed to:", lendingPool.target);

  const assetConfigs = {
    WETH: { supplyCap: ethers.parseEther("500000"), borrowCap: ethers.parseEther("300000"), maxLTV: 82500, liquidationThreshold: 85000, liquidationPenalty: 750 },
    WBTC: { supplyCap: ethers.parseEther("21000"), borrowCap: ethers.parseEther("10000"), maxLTV: 70000, liquidationThreshold: 75000, liquidationPenalty: 1000 },
    USDC: { supplyCap: ethers.parseUnits("2000000"), borrowCap: ethers.parseUnits("1800000"), maxLTV: 90000, liquidationThreshold: 92500, liquidationPenalty: 500 },
    DAI:  { supplyCap: ethers.parseEther("1000000"), borrowCap: ethers.parseEther("800000"), maxLTV: 87500, liquidationThreshold: 90000, liquidationPenalty: 500 },
    GHO:  { supplyCap: ethers.parseEther("600000"), borrowCap: ethers.parseEther("300000"), maxLTV: 70000, liquidationThreshold: 75000, liquidationPenalty: 1000 }
  };

  for (const symbol of Object.keys(tokens)) {
    const cfg = assetConfigs[symbol];
    const tokenAddress = tokens[symbol];
    const tx = await lendingPool.setAssetConfig(
      tokenAddress,
      cfg.supplyCap,
      cfg.borrowCap,
      cfg.maxLTV,
      cfg.liquidationThreshold,
      cfg.liquidationPenalty
    );
    await tx.wait();
    console.log(`✅ Configured ${symbol}`);
  }

  const interestParams = {
    baseRate: 200,        
    slope1: 4000,         
    slope2: 7500,         
    kink: 8000,           
    reserveFactor: 1000   
  };

  for (const symbol of Object.keys(tokens)) {
    const tokenAddress = tokens[symbol];
    const tx = await interestRateModel.setParams(
      tokenAddress,
      interestParams.baseRate,
      interestParams.slope1,
      interestParams.slope2,
      interestParams.kink,
      interestParams.reserveFactor
    );
    await tx.wait();
    console.log(`✅ Set interest model for ${symbol}`);
  }

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
  console.log("InterestRateModel:", interestRateModel.target);
  console.log("LendingPool:", lendingPool.target);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });
