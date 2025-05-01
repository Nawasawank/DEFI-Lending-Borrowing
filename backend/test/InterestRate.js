const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("InterestRateModel", function () {
  let model;
  let owner;
  let token;

  beforeEach(async () => {
    [owner] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("Token");
    token = await Token.deploy("TestToken", "TTK", ethers.parseEther("1000"));
    await token.waitForDeployment();
    const tokenAddress = await token.getAddress();

    const InterestRateModel = await ethers.getContractFactory("InterestRateModel");
    model = await InterestRateModel.deploy();
    await model.waitForDeployment();

    await model.setParams(
      tokenAddress,
      200,    
      1000,   
      3000,   
      8000,   
      1000    
    );
  });

  it("should return correct borrow rate below kink", async () => {
    const utilization = 5000; 
    const rate = await model.getBorrowRate(await token.getAddress(), utilization);
    expect(rate).to.equal(200 + (1000 * 5000) / 10000); 
  });

  it("should return correct borrow rate above kink", async () => {
    const utilization = 9000; 
    const tokenAddress = await token.getAddress();
    const rate = await model.getBorrowRate(tokenAddress, utilization);

    const expected = 200 + (1000 * 8000) / 10000 + (3000 * (9000 - 8000)) / 10000;
    expect(rate).to.equal(expected);
  });

  it("should return correct supply rate", async () => {
    const utilization = 7000; 
    const tokenAddress = await token.getAddress();

    const borrowRate = await model.getBorrowRate(tokenAddress, utilization);
    const supplyRate = await model.getSupplyRate(utilization, tokenAddress);

    const expectedSupplyRate = borrowRate * BigInt(utilization) * BigInt(10000 - 1000) / BigInt(1e8);
    expect(supplyRate).to.equal(expectedSupplyRate);
  });

  it("should calculate borrow APY greater than borrow rate", async () => {
    const tokenAddress = await token.getAddress();
    const utilization = 7500;

    const apr = await model.getBorrowRate(tokenAddress, utilization);
    const apy = await model.getBorrowAPY(tokenAddress, utilization);

    expect(apy).to.be.gte(apr); 
  });

  it("should calculate supply APY greater than supply rate", async () => {
    const tokenAddress = await token.getAddress();
    const utilization = 6000;

    const apr = await model.getSupplyRate(utilization, tokenAddress);
    const apy = await model.getSupplyAPY(tokenAddress, utilization);

    expect(apy).to.be.gte(apr); 
  });
});
