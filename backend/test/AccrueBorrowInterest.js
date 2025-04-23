const { expect } = require("chai");
const { ethers } = require("hardhat");

const parseEther = (val) =>
  ethers.utils?.parseEther?.(val) || ethers.parseEther(val);

describe("LendingPool accrueBorrowInterest", function () {
  let owner, user;
  let token, pool, interestRateModel;

  beforeEach(async function () {
    [owner, user] = await ethers.getSigners();

    // Deploy the Token contract
    const Token = await ethers.getContractFactory("Token");
    token = await Token.deploy("TestToken", "TTK", parseEther("1000"));
    await token.waitForDeployment();
    const tokenAddress = await token.getAddress();
    console.log("Token deployed at:", tokenAddress);

    // Set the faucet address
    await token.setFaucet(owner.address);

    // Deploy the InterestRateModel contract
    const InterestRateModel = await ethers.getContractFactory(
      "InterestRateModel"
    );
    interestRateModel = await InterestRateModel.deploy();
    await interestRateModel.waitForDeployment();
    const interestRateAddress = await interestRateModel.getAddress();
    console.log("InterestRateModel deployed at:", interestRateAddress);

    // Set interest rate parameters for the token
    await interestRateModel.setParams(
      tokenAddress,
      200, // baseRate (2%)
      1000, // slope1 (10%)
      3000, // slope2 (30%)
      8000, // kink (80% utilization)
      1000 // reserveFactor (10%)
    );

    // Deploy the LendingPool contract
    const LendingPool = await ethers.getContractFactory("LendingPool");
    pool = await LendingPool.deploy([tokenAddress], interestRateAddress);
    await pool.waitForDeployment();
    const poolAddress = await pool.getAddress();
    console.log("LendingPool deployed at:", poolAddress);

    // Configure the LendingPool
    await pool.setAssetConfig(
      tokenAddress,
      parseEther("1000000"), // Supply cap
      parseEther("1000000"), // Borrow cap
      7500, // Max LTV (75%)
      8000, // Liquidation threshold (80%)
      500 // Liquidation penalty (5%)
    );

    // Mint tokens to the owner and approve the LendingPool
    await token.mint(owner.address, parseEther("1000"));
    await token.connect(owner).approve(poolAddress, parseEther("1000"));

    // Deposit tokens into the LendingPool
    await pool.connect(owner).deposit(tokenAddress, parseEther("100"));
  });

  it("should accrue borrow interest correctly", async function () {
    const tokenAddress = await token.getAddress();

    // Simulate a borrow
    await pool.connect(user).borrow(
      tokenAddress,
      parseEther("5"),
      [parseEther("1")] // Mock token price in USD
    );

    // Advance time
    await ethers.provider.send("evm_increaseTime", [3600]); // 1 hour
    await ethers.provider.send("evm_mine");

    // Accrue borrow interest
    await pool.accrueBorrowInterest(tokenAddress);

    // Check the updated total borrows
    const tokenState = await pool.tokenState(tokenAddress);
    console.log(
      "Total borrows after accrual:",
      tokenState.totalBorrows.toString()
    );
    expect(tokenState.totalBorrows).to.be.gt(parseEther("10"));
  });
});
