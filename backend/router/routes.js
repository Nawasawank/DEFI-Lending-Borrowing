const express = require('express');
const CoinController = require('../controllers/CoinPrice.controller.js');
const PriceController = require('../controllers/PriceOracle.controller.js')

const router = express.Router();

//Price Coingecko API, External Price Oracle
router.get('/coin-prices', CoinController.getPrices); //coingecko
router.get('/chainlink-prices', PriceController.getAllLatestPrices); //chainlink

module.exports = router;