const hre = require("hardhat");
const { expect } = require("chai");
const { ethers } = hre;

const parseEther = (val) => ethers.utils?.parseEther?.(val) || ethers.parseEther(val);

describe("LendingPool deposit with custom InterestRateModel", function () {
  let owner, user;
  let token, faucet, pool, interestModel;

  beforeEach(async () => {
    [owner, user] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("Token");
    token = await Token.deploy("TestToken", "TTK", parseEther("1000"));
    await token.waitForDeployment();
    const tokenAddress = await token.getAddress();

    const Faucet = await ethers.getContractFactory("TokenFaucet");
    faucet = await Faucet.deploy(tokenAddress);
    await faucet.waitForDeployment();
    const faucetAddress = await faucet.getAddress();

    await token.setFaucet(faucetAddress);
    await faucet.connect(user).claimTokens();

    const InterestRateModel = await ethers.getContractFactory("InterestRateModel");
    interestModel = await InterestRateModel.deploy();
    await interestModel.waitForDeployment();
    const interestModelAddress = await interestModel.getAddress();

    await interestModel.setParams(
      tokenAddress,
      200,
      1000,
      3000,
      8000,
      1000
    );

    const LendingPool = await ethers.getContractFactory("LendingPool");
    pool = await LendingPool.deploy([tokenAddress], interestModelAddress);
    await pool.waitForDeployment();
    const poolAddress = await pool.getAddress();

    await pool.setAssetConfig(
      tokenAddress,
      parseEther("1000000"),
      parseEther("1000000"),
      7500,
      8000,
      500
    );

    await token.connect(user).approve(poolAddress, parseEther("100"));
  });

  it("should deposit tokens and increase user balance", async () => {
    const depositAmount = parseEther("100");
    const tokenAddress = await token.getAddress();

    await pool.connect(user).deposit(tokenAddress, depositAmount);
    
    const balance = await pool.balanceOf(tokenAddress, user.address);
    expect(balance).to.equal(depositAmount);
  });

  it("should fail when deposit is zero", async () => {
    const tokenAddress = await token.getAddress();
    await expect(pool.connect(user).deposit(tokenAddress, 0)).to.be.revertedWith("Amount must be greater than zero");
  });

  it("should fail if token is not allowed", async () => {
    const OtherToken = await ethers.getContractFactory("Token");
    const fakeToken = await OtherToken.deploy("FakeToken", "FAK", parseEther("1000"));
    await fakeToken.waitForDeployment();
    const fakeTokenAddress = await fakeToken.getAddress();

    await fakeToken.connect(user).approve(pool.getAddress(), parseEther("10"));

    await expect(
      pool.connect(user).deposit(fakeTokenAddress, parseEther("1"))
    ).to.be.revertedWith("Token not allowed");
  });
});
