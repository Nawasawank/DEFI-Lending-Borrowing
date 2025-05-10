const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MockV3Aggregator", function () {
  let aggregator;
  const DECIMALS = 8;
  const INITIAL_PRICE = 100000000; // 1.00 USD with 8 decimals
  const DESCRIPTION = "ETH / USD";

  beforeEach(async () => {
    const MockV3Aggregator = await ethers.getContractFactory("MockV3Aggregator");
    aggregator = await MockV3Aggregator.deploy(DECIMALS, INITIAL_PRICE, DESCRIPTION);
    await aggregator.waitForDeployment();
  });

  it("should store constructor values correctly", async () => {
    expect(await aggregator.decimals()).to.equal(DECIMALS);
    expect(await aggregator.latestAnswer()).to.equal(INITIAL_PRICE);
    expect(await aggregator.description()).to.equal(DESCRIPTION);
  });

  it("should return correct latestAnswer", async () => {
    expect(await aggregator.latestAnswer()).to.equal(INITIAL_PRICE);
  });

  it("should return correct latestTimestamp", async () => {
    const ts = await aggregator.latestTimestamp();
    expect(ts).to.be.gt(0);
  });

  it("should update answer and timestamp", async () => {
    const NEW_PRICE = 200000000;
    await ethers.provider.send("evm_increaseTime", [10]);
    await aggregator.updateAnswer(NEW_PRICE);

    expect(await aggregator.latestAnswer()).to.equal(NEW_PRICE);
    const newTimestamp = await aggregator.latestTimestamp();
    expect(newTimestamp).to.be.gt(0);
  });

  it("should return correct data from latestRoundData()", async () => {
    const data = await aggregator.latestRoundData();
    expect(data[1]).to.equal(INITIAL_PRICE); // answer
    expect(data[3]).to.equal(await aggregator.latestTimestamp()); // updatedAt
  });

  it("should revert when trying to update with negative price", async () => {
    await expect(aggregator.updateAnswer(-1)).to.be.revertedWith("Invalid price");
  });
});
