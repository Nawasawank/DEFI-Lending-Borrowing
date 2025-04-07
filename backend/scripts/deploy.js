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

  // 🔐 Config based on realistic, risk-adjusted parameters
  const assetConfigs = {
    WETH: {
      supplyCap: ethers.parseEther("500000"),         // Large cap, very liquid
      borrowCap: ethers.parseEther("300000"),
      maxLTV: 82500,                                   // 82.5%
      liquidationThreshold: 85000,                     // 85%
      liquidationPenalty: 750                          // 7.5%
    },
    WBTC: {
      supplyCap: ethers.parseEther("21000"),           // Scarce supply
      borrowCap: ethers.parseEther("10000"),
      maxLTV: 70000,                                   // 70% (more volatile than ETH)
      liquidationThreshold: 75000,                     // 75%
      liquidationPenalty: 1000                         // 10%
    },
    USDC: {
      supplyCap: ethers.parseUnits("2000000"),     
      borrowCap: ethers.parseUnits("1800000"),
      maxLTV: 90000,                                   // 90% (very stable)
      liquidationThreshold: 92500,                     // 92.5%
      liquidationPenalty: 500                          // 5%
    },
    DAI: {
      supplyCap: ethers.parseEther("1000000"),         // Stablecoin but algorithmic
      borrowCap: ethers.parseEther("800000"),
      maxLTV: 87500,                                   // 87.5%
      liquidationThreshold: 90000,                     // 90%
      liquidationPenalty: 500                          // 5%
    },
    GHO: {
      supplyCap: ethers.parseEther("600000"),          // Newer stablecoin (Aave-native)
      borrowCap: ethers.parseEther("300000"),
      maxLTV: 70000,                                   // 70% (conservative)
      liquidationThreshold: 75000,                     // 75%
      liquidationPenalty: 1000                         // 10%
    }
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
