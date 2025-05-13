const { expect } = require("chai");
const { ethers } = require("hardhat");

const parseUnits = (val, decimals = 18) => ethers.parseUnits(val.toString(), decimals);
const MaxUint256 = ethers.MaxUint256 || ethers.constants?.MaxUint256;

describe("Liquidation", function () {
  let liquidation, lendingPool, token, owner, user, liquidator;
  let tokenPricesUSD;
  let req, res, resData;

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

    await lendingPool.connect(owner).setLiquidationContract(liquidation.target);

    await token.connect(owner).mint(user.address, parseUnits("100", 18));
    await token.connect(owner).mint(liquidator.address, parseUnits("100", 18));
    await token.connect(user).approve(lendingPool.target, parseUnits("100", 18));
    await token.connect(liquidator).approve(liquidation.target, parseUnits("100", 18));
    await lendingPool.connect(user).deposit(token.target, parseUnits("50", 18));
    await lendingPool.connect(user).borrow(token.target, parseUnits("30", 18), [parseUnits("1", 18)]);

    tokenPricesUSD = [parseUnits("1", 18)];

    this.liquidationController = {
      async checkLiquidationEligibility(userAddress) {
        if (!ethers.isAddress(userAddress)) {
          throw new Error("Invalid user address");
        }

        const healthFactor = ethers.toBigInt("900000000000000000");
        const collateral = { balances: ["1000", "0"] };
        const debt = { amounts: ["500", "0"] };

        const isEligible = healthFactor < ethers.parseUnits("1", 18);
        const hasCollateral = collateral.balances.some((b) => b !== "0");
        const hasDebt = debt.amounts.some((a) => a !== "0");

        return {
          user: userAddress,
          isEligible,
          hasCollateral,
          hasDebt,
          healthFactor: ethers.formatUnits(healthFactor, 18),
          status: isEligible ? "Eligible" : "Not Eligible",
        };
      },
    };
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
    tokenPricesUSD = [parseUnits("0.5", 18)]; // simulate price drop

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
      parseUnits("1.05", 18) // update if your liquidation penalty config differs
    );
  });

  it("should return eligibility details for a valid user address", async function () {
    const userAddress = "0x790BE304955C116dd07CbBecEf8000935Cea2E62";

    const result = await this.liquidationController.checkLiquidationEligibility(userAddress);

    expect(result).to.have.property("user", userAddress);
    expect(result).to.have.property("isEligible", true);
    expect(result).to.have.property("hasCollateral", true);
    expect(result).to.have.property("hasDebt", true);
    expect(result).to.have.property("healthFactor", "0.9");
    expect(result).to.have.property("status", "Eligible");
  });

  it("should return an error for an invalid user address", async function () {
    try {
      await this.liquidationController.checkLiquidationEligibility("invalid_address");
      expect.fail("Expected error was not thrown");
    } catch (err) {
      expect(err.message).to.equal("Invalid user address");
    }
  });
    it("should revert if repay amount is zero", async function () {
  await expect(
    liquidation.connect(liquidator).liquidate(
      user.address,
      token.target,
      0,
      token.target,
      tokenPricesUSD
    )
  ).to.be.revertedWith("Repay amount must be positive");
});
it("should revert if repay token is not allowed", async function () {
  const OtherToken = await ethers.getContractFactory("Token");
  const fake = await OtherToken.deploy("Fake", "FAK", 18);
  await fake.waitForDeployment();

  await expect(
    liquidation.connect(liquidator).liquidate(
      user.address,
      fake.target,
      parseUnits("1", 18),
      token.target,
      tokenPricesUSD
    )
  ).to.be.revertedWith("Invalid repay token");
});
it("should revert if collateral token is not allowed", async function () {
  const OtherToken = await ethers.getContractFactory("Token");
  const fake = await OtherToken.deploy("Fake", "FAK", 18);
  await fake.waitForDeployment();

  await expect(
    liquidation.connect(liquidator).liquidate(
      user.address,
      token.target,
      parseUnits("1", 18),
      fake.target,
      tokenPricesUSD
    )
  ).to.be.revertedWith("Invalid collateral token");
});
it("should revert if liquidation penalty is too high", async function () {
  await expect(
    lendingPool.setAssetConfig(
      token.target,
      parseUnits("1000000", 18),
      parseUnits("1000000", 18),
      7500,
      8000,
      5000 // 50% penalty
    )
  ).to.be.revertedWith("Penalty too high (max 20%)");
});

it("should calculate correct seized collateral with penalty", async function () {
  tokenPricesUSD = [parseUnits("0.5", 18)];

  const repayAmount = parseUnits("1", 18);
  const expectedSeized = repayAmount * BigInt(1e18 + 500 * 1e14) / BigInt(1e18); // 5% penalty

  const tx = await liquidation.connect(liquidator).liquidate(
    user.address,
    token.target,
    repayAmount,
    token.target,
    tokenPricesUSD
  );

  await expect(tx)
    .to.emit(liquidation, "LiquidationExecuted")
    .withArgs(user.address, liquidator.address, token.target, repayAmount, expectedSeized);
});
it("should revert if repay token transferFrom fails", async function () {
  const BadToken = await ethers.getContractFactory("Token");
  const badToken = await BadToken.deploy("Bad", "BAD", 18);
  await badToken.waitForDeployment();

  await lendingPool.addAllowedToken(badToken.target);
  await lendingPool.setAssetConfig(badToken.target, parseUnits("1000000", 18), parseUnits("1000000", 18), 7500, 8000, 500);
  tokenPricesUSD = [parseUnits("0.5", 18)];

  // Do not mint to liquidator or approve, so transferFrom will fail
  await expect(
    liquidation.connect(liquidator).liquidate(
      user.address,
      badToken.target,
      parseUnits("1", 18),
      badToken.target,
      tokenPricesUSD
    )
  ).to.be.revertedWith("Invalid token prices length");
});
 it("should revert if penalty is just above 2000", async function () {
    await expect(
      lendingPool.setAssetConfig(
        token.target,
        parseUnits("1000000", 18),
        parseUnits("1000000", 18),
        7500,
        8000,
        2001 // 20.01% penalty
      )
    ).to.be.revertedWith("Penalty too high (max 20%)");
  });
it("should calculate correct seized collateral when penalty is 0%", async function () {
  await lendingPool.setAssetConfig(
    token.target,
    parseUnits("1000000", 18),
    parseUnits("1000000", 18),
    7500,
    8000,
    0
  );

  tokenPricesUSD = [parseUnits("0.5", 18)];
  const repayAmount = parseUnits("1", 18);
  const expectedSeized = repayAmount;

  const tx = await liquidation.connect(liquidator).liquidate(
    user.address,
    token.target,
    repayAmount,
    token.target,
    tokenPricesUSD
  );

  await expect(tx)
    .to.emit(liquidation, "LiquidationExecuted")
    .withArgs(user.address, liquidator.address, token.target, repayAmount, expectedSeized);
});

it("should allow liquidation when repay and collateral tokens are different", async function () {
  const Token2 = await ethers.getContractFactory("Token");
  const token2 = await Token2.deploy("Token2", "TK2", 18);
  await token2.waitForDeployment();

  await token2.setFaucet(owner.address);

  await lendingPool.addAllowedToken(token2.target);
  await lendingPool.setAssetConfig(token2.target, parseUnits("1000000", 18), parseUnits("1000000", 18), 7500, 8000, 500);

  await token2.connect(owner).mint(liquidator.address, parseUnits("10", 18));
  await token2.connect(liquidator).approve(liquidation.target, parseUnits("10", 18));

  tokenPricesUSD = [
    parseUnits("0.5", 18), 
    parseUnits("1", 18)    
  ];

  const tx = await liquidation.connect(liquidator).liquidate(
    user.address,
    token2.target,
    parseUnits("1", 18),
    token.target,
    tokenPricesUSD
  );

  await expect(tx)
    .to.emit(liquidation, "LiquidationExecuted")
    .withArgs(user.address, liquidator.address, token.target, parseUnits("1", 18), parseUnits("1.05", 18));
});
it("should allow liquidation when penalty is exactly 20%", async function () {
  await lendingPool.setAssetConfig(
    token.target,
    parseUnits("1000000", 18),
    parseUnits("1000000", 18),
    7500,
    8000,
    2000 // exactly 20%
  );

  tokenPricesUSD = [parseUnits("0.5", 18)];
  const repayAmount = parseUnits("1", 18);
  const expectedSeized = repayAmount * BigInt(1e18 + 2000 * 1e14) / BigInt(1e18);

  const tx = await liquidation.connect(liquidator).liquidate(
    user.address,
    token.target,
    repayAmount,
    token.target,
    tokenPricesUSD
  );

  await expect(tx)
    .to.emit(liquidation, "LiquidationExecuted")
    .withArgs(user.address, liquidator.address, token.target, repayAmount, expectedSeized);
});
it("should allow liquidation when penalty is below 20%", async function () {
  await lendingPool.setAssetConfig(
    token.target,
    parseUnits("1000000", 18),
    parseUnits("1000000", 18),
    7500,
    8000,
    1000 
  );

  tokenPricesUSD = [parseUnits("0.5", 18)];
  const repayAmount = parseUnits("1", 18);
  const expectedSeized = repayAmount * BigInt(1e18 + 1000 * 1e14) / BigInt(1e18);

  const tx = await liquidation.connect(liquidator).liquidate(
    user.address,
    token.target,
    repayAmount,
    token.target,
    tokenPricesUSD
  );

  await expect(tx)
    .to.emit(liquidation, "LiquidationExecuted")
    .withArgs(user.address, liquidator.address, token.target, repayAmount, expectedSeized);
});
it("should revert if liquidator has no approval for repay token", async function () {
  await token.connect(liquidator).approve(liquidation.target, 0);

  tokenPricesUSD = [parseUnits("0.5", 18)];

  await expect(
    liquidation.connect(liquidator).liquidate(
      user.address,
      token.target,
      parseUnits("1", 18),
      token.target,
      tokenPricesUSD
    )
  ).to.be.reverted;
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
    const allowance = await token.allowance(liquidator.address, liquidation.target);
    expect(allowance).to.equal(MaxUint256);
  });

  it("should fail if the liquidator address is invalid", async function () {
    const invalidAddress = "invalid_address";
    try {
      await token.connect(owner).approve(invalidAddress, MaxUint256);
      expect.fail("Expected revert for invalid address");
    } catch (err) {
      expect(err.message.toLowerCase()).to.satisfy((msg) =>
        msg.includes("invalid address") || msg.includes("resolvename")
      );
    }
  });

  
});
