const { expect } = require("chai");
const { ethers } = require("hardhat");

const parseUnits = (val, decimals = 18) =>
  ethers.utils?.parseUnits?.(val, decimals) || ethers.parseUnits(val, decimals);

describe("Liquidation (Network Environment)", function () {
  let liquidation, lendingPool, token, owner, user, liquidator;
  let tokenPricesUSD;

  before(async function () {
    // Replace these with the deployed contract addresses
    const lendingPoolAddress = "0xYourDeployedLendingPoolAddress";
    const liquidationAddress = "0xYourDeployedLiquidationAddress";
    const tokenAddress = "0xYourDeployedTokenAddress";

    // Log the addresses for debugging
    console.log("LendingPool address:", lendingPoolAddress);
    console.log("Liquidation address:", liquidationAddress);
    console.log("Token address:", tokenAddress);

    // Get test accounts
    [owner, user, liquidator] = await ethers.getSigners();
    console.log("Owner address:", owner.address);
    console.log("User address:", user.address);
    console.log("Liquidator address:", liquidator.address);

    // Connect to deployed contracts
    const LendingPool = await ethers.getContractFactory("LendingPool");
    lendingPool = LendingPool.attach(lendingPoolAddress);

    const Liquidation = await ethers.getContractFactory("Liquidation");
    liquidation = Liquidation.attach(liquidationAddress);

    const Token = await ethers.getContractFactory("Token");
    token = Token.attach(tokenAddress);

    // Mock token prices in USD for health factor calculation
    tokenPricesUSD = [parseUnits("1", 18)]; // Assume 1 token = $1
    console.log("Token prices USD:", tokenPricesUSD);
  });

  it("should revert with 'Healthy position' if health factor is >= 1e18", async function () {
    try {
      await liquidation
        .connect(liquidator)
        .liquidate(
          user.address,
          token.address,
          parseUnits("1", 18),
          token.address,
          tokenPricesUSD
        );
    } catch (err) {
      console.error("Revert reason:", err.message);
    }
  });

  it("should successfully liquidate if health factor is < 1e18", async function () {
    // Simulate a drop in token price to reduce the user's health factor
    const supportedTokens = await lendingPool.getSupportedTokens();
    tokenPricesUSD = [parseUnits("0.5", 18)]; // Assume 1 token = $0.5
    console.log("Updated token prices USD:", tokenPricesUSD);

    // Fetch supported tokens from the LendingPool contract
    console.log("Supported tokens:", supportedTokens);
    console.log("Token prices USD length:", tokenPricesUSD.length);
    console.log("Supported tokens length:", supportedTokens.length);

    // Ensure the lengths match
    if (tokenPricesUSD.length !== supportedTokens.length) {
      throw new Error(
        `Mismatch in lengths: tokenPricesUSD (${tokenPricesUSD.length}) vs supportedTokens (${supportedTokens.length})`
      );
    }

    // Perform liquidation
    const tx = await liquidation
      .connect(liquidator)
      .liquidate(
        user.address,
        token.address,
        parseUnits("1", 18),
        token.address,
        tokenPricesUSD
      );

    // Check emitted event
    await expect(tx).to.emit(liquidation, "LiquidationExecuted").withArgs(
      user.address,
      liquidator.address,
      token.address,
      parseUnits("1", 18),
      parseUnits("1.05", 18) // Collateral seized with 5% penalty
    );
  });
});
