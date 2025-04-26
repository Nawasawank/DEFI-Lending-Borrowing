const { ethers } = require("ethers");
const {
  web3,
  LiquidationContract,
  LendingPoolContract,
} = require("../utils/web3.js");
const { isAddress } = require("web3-validator");
const { getTokenPricesForHealthFactor } = require("../utils/priceUtils.js");

// Define ERC20_ABI
const ERC20_ABI = [
  {
    constant: false,
    inputs: [
      { name: "_spender", type: "address" },
      { name: "_value", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ name: "", type: "bool" }],
    type: "function",
  },
  {
    constant: true,
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    type: "function",
  },
  {
    constant: true,
    inputs: [
      { name: "_owner", type: "address" },
      { name: "_spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ name: "", type: "uint256" }],
    type: "function",
  },
];

// Update parseUnits helper function
const parseUnits = (val, decimals = 18) =>
  ethers.parseUnits(val.toString(), decimals);

const LiquidationController = {
  async initiateLiquidation(req, res) {
    try {
      // 1. Extract all required parameters
      const { user, repayToken, repayAmount, collateralToken, fromAddress } =
        req.body;

      // 2. Enhanced input validation
      if (!isAddress(user)) {
        return res.status(400).json({ error: "Invalid user address" });
      }

      if (!isAddress(repayToken)) {
        return res.status(400).json({ error: "Invalid repay token address" });
      }

      if (!isAddress(collateralToken)) {
        return res
          .status(400)
          .json({ error: "Invalid collateral token address" });
      }

      if (!isAddress(fromAddress)) {
        return res.status(400).json({ error: "Invalid liquidator address" });
      }

      // 3. Parse amount with token decimals consideration
      let parsedRepayAmount;
      try {
        const tokenContract = new web3.eth.Contract(ERC20_ABI, repayToken);
        const decimals = await tokenContract.methods.decimals().call();
        parsedRepayAmount = ethers.parseUnits(repayAmount.toString(), decimals); // Updated for ethers v6
      } catch (parseError) {
        return res.status(400).json({
          error: "Amount parsing failed",
          details: parseError.message,
        });
      }

      // 4. Fetch supported tokens
      let supportedTokens;
      try {
        supportedTokens = await LendingPoolContract.methods
          .getSupportedTokens()
          .call();
        if (!Array.isArray(supportedTokens) || supportedTokens.length === 0) {
          return res.status(500).json({
            error: "No supported tokens found in the LendingPool contract",
          });
        }
      } catch (err) {
        console.error("[DEBUG] Error fetching supported tokens:", err.message);
        return res.status(500).json({
          error: "Failed to fetch supported tokens",
          details: err.message,
        });
      }

      // 5. Fetch token prices for health factor calculation
      let tokenPricesUSD;
      try {
        tokenPricesUSD = await getTokenPricesForHealthFactor(supportedTokens);

        // Validate and format token prices
        tokenPricesUSD = tokenPricesUSD.map((price, index) => {
          if (typeof price !== "string") {
            price = price.toString(); // Ensure price is a string
          }
          const parsedPrice = parseFloat(price);
          if (isNaN(parsedPrice) || parsedPrice <= 0) {
            throw new Error(
              `Invalid token price for token at index ${index}: ${price}`
            );
          }
          console.log(`[DEBUG] Token price for index ${index}:`, parsedPrice);
          return ethers.parseUnits(parsedPrice.toFixed(18), 18); // Updated for ethers v6
        });
      } catch (err) {
        console.error("[DEBUG] Error fetching token prices:", err.message);
        return res.status(500).json({
          error: "Failed to fetch token prices",
          details: err.message,
        });
      }

      // 6. Health factor check
      const healthFactor = await LendingPoolContract.methods
        .getHealthFactor(user, tokenPricesUSD)
        .call();

      console.log(
        "[DEBUG] Health Factor:",
        ethers.formatUnits(healthFactor, 18) // Updated for ethers v6
      );

      if (BigInt(healthFactor) >= 1e18) {
        return res.status(400).json({
          error: "Position not eligible",
          healthFactor: ethers.formatUnits(healthFactor, 18), // Updated for ethers v6
        });
      }

      // 7. Token allowance check
      const token = new web3.eth.Contract(ERC20_ABI, repayToken);
      const allowance = await token.methods
        .allowance(fromAddress, LiquidationContract._address)
        .call();

      if (BigInt(allowance) < BigInt(parsedRepayAmount)) {
        console.error("[DEBUG] Insufficient allowance:", {
          required: parsedRepayAmount.toString(),
          current: allowance.toString(),
        });
        try {
          await token.methods
            .approve(LiquidationContract._address, ethers.MaxUint256.toString()) // Updated for ethers v6
            .send({ from: fromAddress });
        } catch (approveError) {
          return res.status(500).json({
            error: "Approval failed",
            details: approveError.message,
          });
        }
      }

      // 8. Collateral balance check
      let collateralBalance;
      try {
        collateralBalance = await LendingPoolContract.methods
          .getAvailableLiquidity(collateralToken) // Use getAvailableLiquidity from LendingPool.sol
          .call();
      } catch (err) {
        console.error(
          "[DEBUG] Error fetching collateral balance:",
          err.message
        );
        return res.status(500).json({
          error: "Failed to fetch collateral balance",
          details: err.message,
        });
      }

      if (BigInt(collateralBalance) < BigInt(parsedRepayAmount)) {
        console.error("[DEBUG] Insufficient collateral balance:", {
          required: parsedRepayAmount.toString(),
          current: collateralBalance.toString(),
        });
        return res.status(400).json({
          error: "Insufficient collateral balance in lending pool",
          required: parsedRepayAmount.toString(),
          current: collateralBalance.toString(),
        });
      }

      console.log("[DEBUG] Liquidation Params:", {
        user,
        repayToken,
        repayAmount: parsedRepayAmount.toString(),
        collateralToken,
      });

      // 9. Execute liquidation
      try {
        const gasEstimate = await LiquidationContract.methods
          .liquidate(
            user,
            repayToken,
            parsedRepayAmount,
            collateralToken,
            tokenPricesUSD
          )
          .estimateGas({ from: fromAddress });

        console.log("[DEBUG] Gas Estimate:", gasEstimate);

        const tx = await LiquidationContract.methods
          .liquidate(
            user,
            repayToken,
            parsedRepayAmount,
            collateralToken,
            tokenPricesUSD
          )
          .send({
            from: fromAddress,
            gas: Math.ceil(gasEstimate * 1.3), // 30% buffer
            gasPrice: await web3.eth.getGasPrice(),
          });

        return res.status(200).json({
          success: true,
          txHash: tx.transactionHash,
          details: {
            user,
            liquidator: fromAddress,
            repayToken,
            repayAmount: parsedRepayAmount.toString(), // Convert BigInt to string
            collateralToken,
          },
        });
      } catch (txError) {
        console.error("[TX ERROR]", txError);
        return res.status(500).json({
          error: "Liquidation failed",
          reason: txError.reason || txError.message,
          debug: {
            user,
            repayToken,
            collateralToken,
          },
        });
      }
    } catch (err) {
      console.error("[CONTROLLER ERROR]", err);
      return res.status(500).json({
        error: "Server error during liquidation",
        details:
          process.env.NODE_ENV !== "production" ? err.message : undefined,
      });
    }
  },

  async checkLiquidationEligibility(req, res) {
    try {
      const { userAddress } = req.query;

      // Debug: Log the received userAddress
      console.log("[DEBUG] Received userAddress:", userAddress);

      if (!isAddress(userAddress)) {
        return res.status(400).json({
          error: "Invalid user address",
          details: `Received: ${userAddress}`,
        });
      }

      // Fetch supported tokens
      let supportedTokens;
      try {
        supportedTokens = await LendingPoolContract.methods
          .getSupportedTokens()
          .call();
        if (!Array.isArray(supportedTokens) || supportedTokens.length === 0) {
          return res.status(500).json({
            error: "No supported tokens found in the LendingPool contract",
          });
        }
      } catch (err) {
        console.error("[DEBUG] Error fetching supported tokens:", err.message);
        return res.status(500).json({
          error: "Failed to fetch supported tokens",
          details: err.message,
        });
      }

      // Fetch token prices for health factor calculation
      const tokenPricesUSD = await getTokenPricesForHealthFactor(
        supportedTokens
      );

      // Fetch health factor, collateral, and debt
      const [healthFactor, collateral, debt] = await Promise.all([
        LendingPoolContract.methods
          .getHealthFactor(userAddress, tokenPricesUSD)
          .call(), // Pass tokenPricesUSD
        LendingPoolContract.methods.getUserCollateral(userAddress).call(),
        LendingPoolContract.methods.getUserBorrow(userAddress).call(),
      ]);

      const isEligible = BigInt(healthFactor) < 1e18;
      const hasCollateral = collateral.balances.some((b) => b !== "0");
      const hasDebt = debt.amounts.some((a) => a !== "0");

      return res.status(200).json({
        user: userAddress,
        isEligible,
        hasCollateral,
        hasDebt,
        healthFactor: ethers.formatUnits(healthFactor, 18), // Updated for ethers v6
        status: isEligible ? "Eligible" : "Not Eligible",
      });
    } catch (err) {
      console.error("[ELIGIBILITY CHECK ERROR]", err);
      return res.status(500).json({
        error: "Failed to check eligibility",
        details: err.message,
        retrySuggestion: true,
      });
    }
  },

  async setUpLiquidator(req, res) {
    try {
      const { liquidator, repayToken } = req.body;

      // Validate input addresses
      if (!isAddress(liquidator)) {
        return res.status(400).json({ error: "Invalid liquidator address" });
      }

      if (!isAddress(repayToken)) {
        return res.status(400).json({ error: "Invalid repay token address" });
      }

      // Debug: Log the repayToken address
      console.log("[DEBUG] repayToken address:", repayToken);

      // Initialize the token contract
      const tokenContract = new web3.eth.Contract(ERC20_ABI, repayToken);

      // Debug: Log the tokenContract instance
      console.log("[DEBUG] tokenContract:", tokenContract);

      // Test the decimals function to ensure the contract is valid
      const decimals = await tokenContract.methods.decimals().call();

      // Debug: Log the decimals value
      console.log("[DEBUG] Token decimals:", decimals);

      // Approve the Liquidation contract to spend the repay token
      const tx = await tokenContract.methods
        .approve(LiquidationContract._address, ethers.MaxUint256.toString()) // Updated for ethers v6
        .send({ from: liquidator });

      return res.status(200).json({
        success: true,
        txHash: tx.transactionHash,
        details: {
          liquidator,
          repayToken,
          approvedAmount: ethers.MaxUint256.toString(), // Updated for ethers v6
        },
      });
    } catch (err) {
      console.error("[SETUP LIQUIDATOR ERROR]", err);
      return res.status(500).json({
        error: "Failed to set up liquidator",
        details: err.message,
      });
    }
  },
};

module.exports = LiquidationController;
