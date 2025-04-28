const express = require("express");
const CoinController = require("../controllers/CoinPrice.controller.js");
const PriceController = require("../controllers/PriceOracle.controller.js");
const LendingController = require("../controllers/LendingPool.controller.js");
const LiquidationController = require("../controllers/Liquidation.controller.js");
const { LendingPoolContract } = require("../utils/web3.js");

const router = express.Router();

//Price Coingecko API, External Price Oracle
router.get("/coin-prices", CoinController.getPrices); //coingecko price
router.get("/chainlink-prices", PriceController.getAllLatestPrices); //chainlink price
router.post("/deposit", LendingController.deposit); //allow user to supply their tokens
router.get("/balance", LendingController.getLenderBalance); //show user balance(which is combine interest) for each assets
router.get("/asset-config", LendingController.getAssetConfig); //show maxLTV,capacity,liquidation threshold and penalty of each assets
router.post("/withdraw", LendingController.withdraw); //user withdrawal their collateral
router.get("/total-supplied-borrowed", LendingController.getTotalSuppliedAndBorrow); //get total supplied of each assets
router.get("/utilization-rate", LendingController.getUtilizationRate); //get utilization rate of each assets
router.get("/available-liquidity", LendingController.getAvailableLiquidity); //get utilization rate of each assets
router.get("/wallet-balance", LendingController.getUserTokenBalances); //show supply for each user's asset wallet
router.get("/getAssetOverview", LendingController.getAssetOverview); // Get Asset Overview
router.get("/getBorrowOverview", LendingController.getBorrowOverview);  // Get Borrow Overview


// router.get('/collateral-supplied',LendingController.getTotalCollateralSupplied) //Total collateral that users supply
router.get("/supply-apy-utilization", LendingController.getSupplyAPYandUtilization); //get utlization and APY
router.get("/supply-apy", LendingController.getSupplyAPY);
router.get("/supply-apr",LendingController.getSupplyAPR); //get supply apr
router.get("/history", LendingController.getUserHistory); //user's history for supply and withdraw
router.get("/netOverview", LendingController.getNetOverview); //get supply APY history

// router.get('/apr-history', LendingController.recordAPRSnapshots);
router.get("/lender-collateral", LendingController.getLenderCollateral); //get user's collateral for all assets
router.get("/sumCollateral", LendingController.SumAllCollateral); //Total collateral that users supply in USD
router.get("/supply-totalAPY", LendingController.TotalAPY);
router.get("/previewCollateral", LendingController.PreviewCollateralAfterWithdraw); // Preview collateral after withdrawal

router.get("/claimToken", LendingController.claimAllTokensForUser);
router.get("/MaxWithdraw", LendingController.getMaxWithdrawable);
router.get("/health-factor", LendingController.getHealthFactor);
router.get("/preview-health-factor", LendingController.PreviewHealthFactor); // Preview health factor after supplying a value
router.get("/MaxBorrow", LendingController.getMaxBorrowable); // Get max borrowable amount for a user and asset
router.get("/previewRemaingDebt", LendingController.PreviewRemainingDebtAfterRepay); // Preview health factor after supplying a value
router.get("/borrower-debt", LendingController.getBorrowerDebt); // Preview borrow amount after withdrawal
router.get("/total-borrowed", LendingController.getTotalBorrowed); // Preview borrow amount after withdrawal

// Borrow and Repay routes
router.post("/borrow", LendingController.borrow); // allow user to borrow tokens
router.post("/repay", LendingController.repay); // allow user to repay borrowed tokens
router.get("/debt",LendingController.getUserDebt); // Get user's total debt for each asset
router.get("/total-debt", LendingController.getUserTotalDebtUSD); // Get user's total debt for all assets
router.get("/borrow-apy",LendingController.getBorrowAPY); // Get borrow APY for all assets
router.get("/borrow-apr",LendingController.getBorrowAPR);  // Get borrow APR for all assets
router.get("/total-borrow-apy",LendingController.TotalBorrowAPY); // Get total borrow APY for all assets
router.get("/sumBorrow", LendingController.SumAllBorrow); // Get liquidation APY for all assets
router.get("/previewhealthfactorborrow", LendingController.PreviewHealthFactorBorrow); // Preview health factor after borrowing
router.get("/previewhealthfactorrepay", LendingController.PreviewHealthFactorRepay); // Preview health factor after repaying

// Liquidation routes
router.post("/liquidate", LiquidationController.initiateLiquidation); // Add liquidation route
router.get("/liquidation-eligibility",LiquidationController.checkLiquidationEligibility); // Check eligibility
router.post("/setup-liquidator", LiquidationController.setUpLiquidator); // Setup liquidator

router.get("/market", LendingController.getMarketOverview); 
router.get("/all-total-supply-borrow", LendingController.getAllTotalSuppliedAndBorrow); // Get market history for all assets

module.exports = router;
