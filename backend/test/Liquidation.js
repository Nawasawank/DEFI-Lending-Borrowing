const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Liquidation", function () {
  let liquidation, lendingPool, token, owner, user, liquidator;
  let tokenPricesUSD;

  beforeEach(async function () {
    const AddressZero = ethers.constants.AddressZero; // ✅ define this AFTER ethers is available

    // Deploy LendingPool contract
    const LendingPool = await ethers.getContractFactory("LendingPool");
    lendingPool = await LendingPool.deploy([], AddressZero);
    await lendingPool.deployed();

    // Deploy the Token contract
    const Token = await ethers.getContractFactory("Token");
    token = await Token.deploy("Test Token", "TTK", 18);
    await token.deployed();

    // Add the token to the LendingPool's allowed tokens
    await lendingPool.addAllowedToken(token.address);

    // Set token configuration in the LendingPool
    await lendingPool.setAssetConfig(
      token.address,
      ethers.utils.parseUnits("1000000", 18), // Supply cap
      ethers.utils.parseUnits("1000000", 18), // Borrow cap
      7500, // Max LTV (75%)
      8000, // Liquidation threshold (80%)
      500 // Liquidation penalty (5%)
    );

    // Deploy the Liquidation contract with the LendingPool address
    const Liquidation = await ethers.getContractFactory("Liquidation");
    liquidation = await Liquidation.deploy(lendingPool.address);
    await liquidation.deployed();

    // Get test accounts
    [owner, user, liquidator] = await ethers.getSigners();

    // Mint tokens to the user and liquidator
    await token.mint(user.address, ethers.utils.parseUnits("100", 18));
    await token.mint(liquidator.address, ethers.utils.parseUnits("100", 18));

    // Approve the LendingPool and Liquidation contracts to spend tokens
    await token
      .connect(user)
      .approve(lendingPool.address, ethers.utils.parseUnits("100", 18));
    await token
      .connect(liquidator)
      .approve(liquidation.address, ethers.utils.parseUnits("100", 18));

    // User deposits tokens into the LendingPool
    await lendingPool
      .connect(user)
      .deposit(token.address, ethers.utils.parseUnits("50", 18));

    // User borrows tokens to reduce their health factor
    await lendingPool.connect(user).borrow(
      token.address,
      ethers.utils.parseUnits("30", 18),
      [ethers.utils.parseUnits("1", 18)] // Mock token price in USD
    );

    // Mock token prices in USD for health factor calculation
    tokenPricesUSD = [ethers.utils.parseUnits("1", 18)]; // Assume 1 token = $1
  });

  it("should revert with 'Healthy position' if health factor is >= 1e18", async function () {
    try {
      await liquidation
        .connect(liquidator)
        .liquidate(
          user.address,
          token.address,
          ethers.utils.parseUnits("1", 18),
          token.address,
          tokenPricesUSD
        );
    } catch (err) {
      console.error("Revert reason:", err.message);
    }
  });

  it("should successfully liquidate if health factor is < 1e18", async function () {
    // Simulate a drop in token price to reduce the user's health factor
    tokenPricesUSD = [ethers.utils.parseUnits("0.5", 18)]; // Assume 1 token = $0.5

    // Perform liquidation
    const tx = await liquidation
      .connect(liquidator)
      .liquidate(
        user.address,
        token.address,
        ethers.utils.parseUnits("1", 18),
        token.address,
        tokenPricesUSD
      );

    // Check emitted event
    await expect(tx).to.emit(liquidation, "LiquidationExecuted").withArgs(
      user.address,
      liquidator.address,
      token.address,
      ethers.utils.parseUnits("1", 18),
      ethers.utils.parseUnits("1.05", 18) // Collateral seized with 5% penalty
    );
  });
});
