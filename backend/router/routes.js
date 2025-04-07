const express = require('express');
const CoinController = require('../controllers/CoinPrice.controller.js');
const PriceController = require('../controllers/PriceOracle.controller.js')
const LendingController = require('../controllers/LendingPool.controller.js');


const router = express.Router();

//Price Coingecko API, External Price Oracle
router.get('/coin-prices', CoinController.getPrices); //coingecko
router.get('/chainlink-prices', PriceController.getAllLatestPrices); //chainlink
router.post('/deposit', LendingController.deposit); //allow user to supply their tokens
router.post('/balance', LendingController.getLenderBalance); //show user supply for each assets
router.get('/asset-config', LendingController.getAssetConfig); //show maxLTV,capacity,liquidation threshold and penalty of each assets


module.exports = router;