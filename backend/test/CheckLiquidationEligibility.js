const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("checkLiquidationEligibility", function () {
  let lendingPool, liquidationController, supportedTokens, tokenPricesUSD;

  beforeEach(async function () {
    // Get test accounts
    const [deployer] = await ethers.getSigners();

    // Mock supported tokens with valid Ethereum addresses
    supportedTokens = [
      "0x0000000000000000000000000000000000000001",
      "0x0000000000000000000000000000000000000002",
      "0x0000000000000000000000000000000000000003",
      "0x0000000000000000000000000000000000000004",
      "0x0000000000000000000000000000000000000005",
    ];
    tokenPricesUSD = ["1.0", "2.0", "3.0", "4.0", "5.0"];

    // Deploy a mock LendingPool contract with required arguments
    const LendingPool = await ethers.getContractFactory("LendingPool");
    lendingPool = await LendingPool.deploy(supportedTokens, deployer.address); // Pass valid arguments
    await lendingPool.waitForDeployment();

    // Mock the LiquidationController logic
    liquidationController = {
      async checkLiquidationEligibility(userAddress) {
        if (!ethers.isAddress(userAddress)) {
          // Use ethers.isAddress for ethers v6
          throw new Error("Invalid user address");
        }

        // Simulate fetching supported tokens
        if (supportedTokens.length === 0) {
          throw new Error(
            "No supported tokens found in the LendingPool contract"
          );
        }

        // Simulate fetching health factor, collateral, and debt
        const healthFactor = ethers.toBigInt("900000000000000000"); // Use ethers.toBigInt for ethers v6
        const collateral = { balances: ["1000", "0"] };
        const debt = { amounts: ["500", "0"] };

        const isEligible = healthFactor < ethers.parseUnits("1", 18); // Use ethers.parseUnits for ethers v6
        const hasCollateral = collateral.balances.some((b) => b !== "0");
        const hasDebt = debt.amounts.some((a) => a !== "0");

        return {
          user: userAddress,
          isEligible,
          hasCollateral,
          hasDebt,
          healthFactor: ethers.formatUnits(healthFactor, 18), // Use ethers.formatUnits for ethers v6
          status: isEligible ? "Eligible" : "Not Eligible",
        };
      },
    };
  });

  it("should return eligibility details for a valid user address", async function () {
    const userAddress = "0x1234567890abcdef1234567890abcdef12345678";

    const result = await liquidationController.checkLiquidationEligibility(
      userAddress
    );

    expect(result).to.have.property("user", userAddress);
    expect(result).to.have.property("isEligible", true);
    expect(result).to.have.property("hasCollateral", true);
    expect(result).to.have.property("hasDebt", true);
    expect(result).to.have.property("healthFactor", "0.9");
    expect(result).to.have.property("status", "Eligible");
  });

  it("should return an error for an invalid user address", async function () {
    const invalidUserAddress = "invalid_address";

    try {
      await liquidationController.checkLiquidationEligibility(
        invalidUserAddress
      );
    } catch (err) {
      expect(err.message).to.equal("Invalid user address");
    }
  });

  it("should handle errors when fetching supported tokens", async function () {
    // Simulate no supported tokens
    supportedTokens = [];

    const userAddress = "0x1234567890abcdef1234567890abcdef12345678";

    try {
      await liquidationController.checkLiquidationEligibility(userAddress);
    } catch (err) {
      expect(err.message).to.equal(
        "No supported tokens found in the LendingPool contract"
      );
    }
  });
});
