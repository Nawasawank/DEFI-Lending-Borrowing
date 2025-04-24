const { ethers } = require("hardhat");

const ORACLE_ADDRESS = "0x53DE98C53D53C3f7CBd62F73c89d71baE77E0fe5"; 

async function main() {
    const [signer] = await ethers.getSigners();
    const oracle = await ethers.getContractAt("PriceOracle", ORACLE_ADDRESS, signer);
    const symbols = ["ETH", "BTC", "USDC", "DAI", "GHO"];

    for (const sym of symbols) {
      try {
        const [rawPrice, decimals] = await Promise.all([
          oracle.getLatestPrice(sym),
          oracle.getDecimals(sym),
        ]);
  
        const price = ethers.formatUnits(rawPrice, decimals);
        console.log(`${sym} price: ${price} USD (decimals: ${decimals})`);
      } catch (err) {
        console.error(`Could not fetch ${sym}:`, err.message);
      }
    }
  }
  
  main().catch(console.error);