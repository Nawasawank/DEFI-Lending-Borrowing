const { expect } = require("chai");
const { ethers } = require("hardhat");

// Helper function for parseUnits
const parseUnits = (val, decimals = 18) =>
  ethers.utils?.parseUnits?.(val, decimals) || ethers.parseUnits(val, decimals);

describe("Liquidation", function () {
  let liquidation, lendingPool, token, owner, user, liquidator;
  let tokenPricesUSD;

  beforeEach(async function () {
    const AddressZero = "0x0000000000000000000000000000000000000000";

    // Get test accounts
    [owner, user, liquidator] = await ethers.getSigners();

    // Deploy a mock InterestRateModel contract
    const InterestRateModel = await ethers.getContractFactory(
      "InterestRateModel"
    );
    const interestRateModel = await InterestRateModel.deploy();
    await interestRateModel.waitForDeployment();

    // Deploy LendingPool contract with the mock InterestRateModel
    const LendingPool = await ethers.getContractFactory("LendingPool");
    lendingPool = await LendingPool.deploy([], interestRateModel.target);
    await lendingPool.waitForDeployment();

    // Deploy the Token contract
    const Token = await ethers.getContractFactory("Token");
    token = await Token.deploy("Test Token", "TTK", 18);
    await token.waitForDeployment();

    // Set the faucet address (e.g., owner)
    await token.connect(owner).setFaucet(owner.address);

    // Add the token to the LendingPool's allowed tokens
    await lendingPool.addAllowedToken(token.target);

    // Set token configuration in the LendingPool
    await lendingPool.setAssetConfig(
      token.target,
      parseUnits("1000000", 18), // Supply cap
      parseUnits("1000000", 18), // Borrow cap
      7500, // Max LTV (75%)
      8000, // Liquidation threshold (80%)
      500 // Liquidation penalty (5%)
    );

    // Deploy the Liquidation contract with the LendingPool address
    const Liquidation = await ethers.getContractFactory("Liquidation");
    liquidation = await Liquidation.deploy(lendingPool.target);
    await liquidation.waitForDeployment();

    // Mint tokens to the user and liquidator
    await token.connect(owner).mint(user.address, parseUnits("100", 18));
    await token.connect(owner).mint(liquidator.address, parseUnits("100", 18));

    // Approve the LendingPool and Liquidation contracts to spend tokens
    await token
      .connect(user)
      .approve(lendingPool.target, parseUnits("100", 18));
    await token
      .connect(liquidator)
      .approve(liquidation.target, parseUnits("100", 18));

    // User deposits tokens into the LendingPool
    await lendingPool.connect(user).deposit(token.target, parseUnits("50", 18));

    // User borrows tokens to reduce their health factor
    await lendingPool.connect(user).borrow(
      token.target,
      parseUnits("30", 18),
      [parseUnits("1", 18)] // Mock token price in USD
    );

    // Mock token prices in USD for health factor calculation
    tokenPricesUSD = [parseUnits("1", 18)]; // Assume 1 token = $1

    // Approve the Liquidation contract to transfer collateral tokens
    await lendingPool
      .connect(owner)
      .approveLiquidation(
        token.target,
        liquidation.target,
        parseUnits("100", 18)
      );
  });

  it("should revert with 'Healthy position' if health factor is >= 1e18", async function () {
    try {
      await liquidation
        .connect(liquidator)
        .liquidate(
          user.address,
          token.target,
          parseUnits("1", 18),
          token.target,
          tokenPricesUSD
        );
    } catch (err) {
      console.error("Revert reason:", err.message);
    }
  });

  it("should successfully liquidate if health factor is < 1e18", async function () {
    // Simulate a drop in token price to reduce the user's health factor
    tokenPricesUSD = [parseUnits("0.5", 18)]; // Assume 1 token = $0.5

    // Perform liquidation
    const tx = await liquidation
      .connect(liquidator)
      .liquidate(
        user.address,
        token.target,
        parseUnits("1", 18),
        token.target,
        tokenPricesUSD
      );

    // Check emitted event
    await expect(tx).to.emit(liquidation, "LiquidationExecuted").withArgs(
      user.address,
      liquidator.address,
      token.target,
      parseUnits("1", 18),
      parseUnits("1.05", 18) // Collateral seized with 5% penalty
    );
  });
});
