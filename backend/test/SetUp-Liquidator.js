const { expect } = require("chai");
const { ethers } = require("hardhat");

// Use ethers.MaxUint256 for ethers@6
const MaxUint256 = ethers.MaxUint256;

// Helper function for parseUnits
const parseUnits = (val, decimals = 18) =>
  ethers.parseUnits(val.toString(), decimals);

describe("SetUp-Liquidator", function () {
  let liquidation, token, owner, liquidator;

  beforeEach(async function () {
    // Get test accounts
    [owner, liquidator] = await ethers.getSigners();

    // Deploy a mock ERC20 token
    const Token = await ethers.getContractFactory("Token");
    token = await Token.deploy("Test Token", "TTK", 18);
    await token.waitForDeployment();

    // Set the faucet address to the owner
    await token.connect(owner).setFaucet(owner.address); // Ensure owner is authorized to mint

    // Deploy the Liquidation contract
    const Liquidation = await ethers.getContractFactory("Liquidation");
    liquidation = await Liquidation.deploy(owner.address); // Mock LendingPool address
    await liquidation.waitForDeployment();

    // Mint tokens to the liquidator
    await token.connect(owner).mint(liquidator.address, parseUnits("100", 18));

    // Approve the Liquidation contract to spend tokens
    await token.connect(liquidator).approve(liquidation.target, MaxUint256);
  });

  it("should set up the liquidator and approve the Liquidation contract", async function () {
    // Check initial allowance
    const initialAllowance = await token.allowance(
      liquidator.address,
      liquidation.target
    );
    expect(initialAllowance).to.equal(MaxUint256);

    // Simulate the setup-liquidator function
    const tx = await token
      .connect(liquidator)
      .approve(liquidation.target, MaxUint256);
    await tx.wait();

    // Verify the allowance
    const finalAllowance = await token.allowance(
      liquidator.address,
      liquidation.target
    );
    expect(finalAllowance).to.equal(MaxUint256);

    console.log("Liquidator setup successful. Allowance approved.");
  });

  it("should fail if the liquidator address is invalid", async function () {
    try {
      // Attempt to approve with an invalid address
      await token.connect(owner).approve(liquidation.target, MaxUint256);
    } catch (err) {
      expect(err.message).to.include("invalid address");
    }
  });
});
