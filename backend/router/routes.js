const express = require('express');
const CoinController = require('../controllers/CoinPrice.controller.js');
const PriceController = require('../controllers/PriceOracle.controller.js')
const LendingController = require('../controllers/LendingPool.controller.js');
const { LendingPoolContract } = require('../utils/web3.js');


const router = express.Router();

//Price Coingecko API, External Price Oracle
router.get('/coin-prices', CoinController.getPrices); //coingecko price
router.get('/chainlink-prices', PriceController.getAllLatestPrices); //chainlink price
router.post('/deposit', LendingController.deposit); //allow user to supply their tokens
router.get('/balance', LendingController.getLenderBalance); //show user balance(which is combine interest) for each assets
router.get('/asset-config', LendingController.getAssetConfig); //show maxLTV,capacity,liquidation threshold and penalty of each assets
router.post('/withdraw', LendingController.withdraw); //user withdrawal their collateral
router.get('/total-supplied', LendingController.getTotalSupplied); //get total supplied of each assets
router.get('/utilization-rate', LendingController.getUtilizationRate); //get utilization rate of each assets
router.get('/available-liquidity', LendingController.getAvailableLiquidity); //get utilization rate of each assets
router.get('/wallet-balance',LendingController.getUserTokenBalances) //show supply for each user's asset wallet

// router.get('/collateral-supplied',LendingController.getTotalCollateralSupplied) //Total collateral that users supply
router.get('/apy',LendingController.getSupplyAPY) //get utlization and APY
router.get('/history', LendingController.getUserHistory) //user's history for supply and withdraw

// router.get('/apr-history', LendingController.recordAPRSnapshots);
router.get('/lender-collateral',LendingController.getLenderCollateral)
router.get('/sumCollateral',LendingController.SumAllCollateral)
router.get('/totalAPY',LendingController.TotalAPY)

router.get('/claimToken',LendingController.claimAllTokensForUser)
router.get('/MaxWithdraw',LendingController.getMaxWithdrawable)

// Borrow and Repay routes
router.post('/borrow', LendingController.borrow); // allow user to borrow tokens
router.post('/repay', LendingController.repay); // allow user to repay borrowed tokens

module.exports = router;