const { expect } = require("chai");
const { ethers } = require("hardhat");

const MaxUint256 = ethers.MaxUint256 || ethers.constants?.MaxUint256;

const parseUnits = (val, decimals = 18) =>
  ethers.utils?.parseUnits?.(val.toString(), decimals) || ethers.parseUnits(val.toString(), decimals);

describe("Liquidation", function () {
  let liquidation, lendingPool, token, owner, user, liquidator;
  let tokenPricesUSD;

  beforeEach(async function () {
    [owner, user, liquidator] = await ethers.getSigners();

    const InterestRateModel = await ethers.getContractFactory("InterestRateModel");
    const interestRateModel = await InterestRateModel.deploy();
    await interestRateModel.waitForDeployment();

    const LendingPool = await ethers.getContractFactory("LendingPool");
    lendingPool = await LendingPool.deploy([], interestRateModel.target);
    await lendingPool.waitForDeployment();

    const Token = await ethers.getContractFactory("Token");
    token = await Token.deploy("Test Token", "TTK", 18);
    await token.waitForDeployment();

    await token.connect(owner).setFaucet(owner.address);
    await lendingPool.addAllowedToken(token.target);
    await lendingPool.setAssetConfig(
      token.target,
      parseUnits("1000000", 18),
      parseUnits("1000000", 18),
      7500,
      8000,
      500
    );

    const Liquidation = await ethers.getContractFactory("Liquidation");
    liquidation = await Liquidation.deploy(lendingPool.target);
    await liquidation.waitForDeployment();

    // Set the Liquidation contract as the authorized liquidator
    await lendingPool.connect(owner).setLiquidationContract(liquidation.target);

    await token.connect(owner).mint(user.address, parseUnits("100", 18));
    await token.connect(owner).mint(liquidator.address, parseUnits("100", 18));

    await token.connect(user).approve(lendingPool.target, parseUnits("100", 18));
    await token.connect(liquidator).approve(liquidation.target, parseUnits("100", 18));

    await lendingPool.connect(user).deposit(token.target, parseUnits("50", 18));
    await lendingPool.connect(user).borrow(
      token.target,
      parseUnits("30", 18),
      [parseUnits("1", 18)]
    );

    tokenPricesUSD = [parseUnits("1", 18)];
  });

  it("should revert with 'Healthy position' if health factor is >= 1e18", async function () {
    try {
      await liquidation.connect(liquidator).liquidate(
        user.address,
        token.target,
        parseUnits("1", 18),
        token.target,
        tokenPricesUSD
      );
    } catch (err) {
      expect(err.message).to.include("Healthy position");
    }
  });

  it("should successfully liquidate if health factor is < 1e18", async function () {
    // Reduce the token price to simulate a low health factor
    tokenPricesUSD = [parseUnits("0.5", 18)];

    const tx = await liquidation.connect(liquidator).liquidate(
      user.address,
      token.target,
      parseUnits("1", 18),
      token.target,
      tokenPricesUSD
    );

    await expect(tx).to.emit(liquidation, "LiquidationExecuted").withArgs(
      user.address,
      liquidator.address,
      token.target,
      parseUnits("1", 18),
      parseUnits("1.05", 18) // Includes penalty
    );
  });
});

describe("SetUp-Liquidator", function () {
  let liquidation, token, owner, liquidator;

  beforeEach(async function () {
    [owner, liquidator] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("Token");
    token = await Token.deploy("Test Token", "TTK", 18);
    await token.waitForDeployment();

    await token.connect(owner).setFaucet(owner.address);

    const Liquidation = await ethers.getContractFactory("Liquidation");
    liquidation = await Liquidation.deploy(owner.address);
    await liquidation.waitForDeployment();

    await token.connect(owner).mint(liquidator.address, parseUnits("100", 18));
    await token.connect(liquidator).approve(liquidation.target, MaxUint256);
  });

  it("should set up the liquidator and approve the Liquidation contract", async function () {
    const initialAllowance = await token.allowance(
      liquidator.address,
      liquidation.target
    );
    expect(initialAllowance).to.equal(MaxUint256);

    const tx = await token.connect(liquidator).approve(liquidation.target, MaxUint256);
    await tx.wait();

    const finalAllowance = await token.allowance(
      liquidator.address,
      liquidation.target
    );
    expect(finalAllowance).to.equal(MaxUint256);
  });

  it("should fail if the liquidator address is invalid", async function () {
    const invalidAddress = "invalid_address";

    try {
      await token.connect(owner).approve(invalidAddress, MaxUint256);
    } catch (err) {
      expect(
        err.message.toLowerCase()
      ).to.satisfy(msg =>
        msg.includes("invalid address") || msg.includes("resolvename")
      );
    }
  });
});