const hre = require("hardhat");
const { expect } = require("chai");
const { ethers } = hre;

const parseEther = (val) => ethers.utils?.parseEther?.(val) || ethers.parseEther(val);

describe("LendingPool deposit and withdraw with custom InterestRateModel ", function () {
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
  it("should allow a user to deposit a token", async () => {
    const tokenAddress = await token.getAddress();
    const depositAmount = parseEther("10");

    await pool.connect(user).deposit(tokenAddress, depositAmount);
  
    const balance = await pool.balanceOf(tokenAddress, user.address);
    expect(balance).to.equal(depositAmount);

    const tokenState = await pool.tokenState(tokenAddress);
    const totalDeposits = tokenState[2];
  
    expect(totalDeposits).to.equal(depositAmount);
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
  it("should fail if deposit exceeds supply cap", async () => {
    const tokenAddress = await token.getAddress();

    await expect(
      pool.connect(user).deposit(tokenAddress, parseEther("1000001"))
    ).to.be.revertedWith("Exceeds supply cap");
  });
  it("should fail if deposit exceeds user's balance", async () => {
    const tokenAddress = await token.getAddress();
    const depositAmount = parseEther("2000");

    await expect(
      pool.connect(user).deposit(tokenAddress, depositAmount)
    ).to.be.reverted;
  });
  it("should allow multiple deposits", async () => {
    const tokenAddress = await token.getAddress();
    const depositAmount1 = parseEther("50");
    const depositAmount2 = parseEther("30");
  
    await pool.connect(user).deposit(tokenAddress, depositAmount1);
    await pool.connect(user).deposit(tokenAddress, depositAmount2);
  
    const balance = await pool.balanceOf(tokenAddress, user.address);
  
    expect(balance).to.equal(depositAmount1 + depositAmount2);
  });
  it("should withdraw tokens", async () => {
    const tokenAddress = await token.getAddress();
    const depositAmount = parseEther("10");
    await pool.connect(user).deposit(tokenAddress, depositAmount);
  
    const withdrawAmount = parseEther("5");
    await pool.connect(user).withdraw(tokenAddress, withdrawAmount);
  
    const balance = await pool.balanceOf(tokenAddress, user.address);
    expect(balance).to.equal(depositAmount - withdrawAmount);
  });
  it("should fail when withdraw amount is zero", async () => {
    const tokenAddress = await token.getAddress();
    await expect(pool.connect(user).withdraw(tokenAddress, 0)).to.be.revertedWith("Amount must be greater than zero");
  });
  it("should fail when withdraw amount exceeds balance including interest", async () => {
    const tokenAddress = await token.getAddress();
    const depositAmount = parseEther("10");
  
    await pool.connect(user).deposit(tokenAddress, depositAmount);
    await pool.accrueInterest(tokenAddress);

    const userBalance = await pool.balanceOf(tokenAddress, user.address);
    const withdrawAmount = userBalance + parseEther("10");
    
    await expect(pool.connect(user).withdraw(tokenAddress, withdrawAmount)).to.be.revertedWith("Insufficient balance");
  });
  it("should allow a user to withdraw their balance including interest", async () => {
    const tokenAddress = await token.getAddress();
    const depositAmount = parseEther("10");
  
    await pool.connect(user).deposit(tokenAddress, depositAmount);
    await pool.accrueInterest(tokenAddress);
  
    const userBalance = await pool.balanceOf(tokenAddress, user.address);

    await pool.connect(user).withdraw(tokenAddress, userBalance);
  
    const finalBalance = await pool.balanceOf(tokenAddress, user.address);
    expect(finalBalance).to.equal(0);
  
    const tokenState = await pool.tokenState(tokenAddress);
    const totalDeposits = tokenState[1]; 
    expect(totalDeposits).to.equal(0);
  });

  
  
  
});

describe("LendingPool borrow and repay functionality", function () {
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

    // Owner provides liquidity
    await token.approve(poolAddress, parseEther("500"));
    await pool.deposit(tokenAddress, parseEther("500"));
  });

  it("should allow user to borrow after depositing collateral", async () => {
    const tokenAddress = await token.getAddress();
    await pool.connect(user).deposit(tokenAddress, parseEther("100"));

    const prices = [parseEther("1")];
    const borrowAmount = parseEther("50");

    await pool.connect(user).borrow(tokenAddress, borrowAmount, prices);

    const debt = await pool.repayBalanceOf(tokenAddress, user.address);
    expect(debt).to.be.closeTo(borrowAmount, parseEther("0.000001"));
  });

  it("should fail if user tries to borrow more than allowed by collateral", async () => {
    const tokenAddress = await token.getAddress();
    await pool.connect(user).deposit(tokenAddress, parseEther("10"));

    const prices = [parseEther("1")];
    const borrowAmount = parseEther("20");

    await expect(
      pool.connect(user).borrow(tokenAddress, borrowAmount, prices)
    ).to.be.revertedWith("Exceeds collateral-based limit");
  });

  it("should allow user to repay debt partially", async () => {
    const tokenAddress = await token.getAddress();
    await pool.connect(user).deposit(tokenAddress, parseEther("100"));

    const prices = [parseEther("1")];
    const borrowAmount = parseEther("40");
    await pool.connect(user).borrow(tokenAddress, borrowAmount, prices);

    await token.connect(user).approve(await pool.getAddress(), parseEther("20"));
    await pool.connect(user).repay(tokenAddress, parseEther("20"));

    const debt = await pool.repayBalanceOf(tokenAddress, user.address);
    expect(debt).to.be.closeTo(parseEther("20"), parseEther("0.000001"));
  });

  it("should allow user to repay entire debt", async () => {
    const tokenAddress = await token.getAddress();
    await pool.connect(user).deposit(tokenAddress, parseEther("100"));

    const prices = [parseEther("1")];
    const borrowAmount = parseEther("30");
    await pool.connect(user).borrow(tokenAddress, borrowAmount, prices);

    await token.connect(user).approve(await pool.getAddress(), borrowAmount);
    await pool.connect(user).repay(tokenAddress, borrowAmount);

    const debt = await pool.repayBalanceOf(tokenAddress, user.address);
    expect(debt).to.be.lte(parseEther("0.0000001"));
  });

  it("should fail to repay when amount is zero", async () => {
    const tokenAddress = await token.getAddress();
    await expect(pool.connect(user).repay(tokenAddress, 0)).to.be.revertedWith("Amount must be greater than zero");
  });

  it("should fail to repay if user has no borrow", async () => {
    const tokenAddress = await token.getAddress();
    await token.connect(user).approve(await pool.getAddress(), parseEther("10"));

    await expect(
      pool.connect(user).repay(tokenAddress, parseEther("10"))
    ).to.be.revertedWith("Nothing to repay");
  });
});

describe("LendingPool edge cases", function () {
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
    await token.setFaucet(await faucet.getAddress());
    await faucet.connect(user).claimTokens();

    const InterestRateModel = await ethers.getContractFactory("InterestRateModel");
    interestModel = await InterestRateModel.deploy();
    await interestModel.waitForDeployment();
    await interestModel.setParams(tokenAddress, 200, 1000, 3000, 8000, 1000);

    const LendingPool = await ethers.getContractFactory("LendingPool");
    pool = await LendingPool.deploy([tokenAddress], await interestModel.getAddress());
    await pool.waitForDeployment();
    await pool.setAssetConfig(tokenAddress, parseEther("1000000"), parseEther("1000000"), 7500, 8000, 500);

    await token.connect(user).approve(await pool.getAddress(), parseEther("100"));
  });

  it("should not fail accrueInterest when no deposits", async () => {
    await pool.accrueInterest(await token.getAddress());
  });

  it("should not fail accrueBorrowInterest when no borrows", async () => {
    await pool.accrueBorrowInterest(await token.getAddress());
  });

  it("should revert on LTV > liquidation threshold", async () => {
    await expect(pool.setAssetConfig(
      await token.getAddress(),
      parseEther("1000000"),
      parseEther("1000000"),
      9000,
      8000,
      500
    )).to.be.revertedWith("LTV must be <= threshold");
  });

  it("should revert if trying to borrow exactly 0", async () => {
    const prices = [parseEther("1")];
    await expect(pool.connect(user).borrow(await token.getAddress(), 0, prices)).to.be.reverted;
  });

  it("should fail if user deposits more than their balance", async () => {
    const tokenAddress = await token.getAddress();
    await expect(
      pool.connect(user).deposit(tokenAddress, parseEther("2000"))
    ).to.be.reverted;
  });

  it("should fail when unsupported token is used", async () => {
    const OtherToken = await ethers.getContractFactory("Token");
    const fake = await OtherToken.deploy("Fake", "FAK", parseEther("1000"));
    await fake.waitForDeployment();
    await fake.connect(user).approve(await pool.getAddress(), parseEther("10"));

    await expect(
      pool.connect(user).deposit(await fake.getAddress(), parseEther("1"))
    ).to.be.revertedWith("Token not allowed");
  });

  it("should allow withdraw of full balance after interest accrues", async () => {
    const tokenAddress = await token.getAddress();
    await pool.connect(user).deposit(tokenAddress, parseEther("50"));
    await pool.accrueInterest(tokenAddress);
    const bal = await pool.balanceOf(tokenAddress, user.address);
    await pool.connect(user).withdraw(tokenAddress, bal);
    expect(await pool.balanceOf(tokenAddress, user.address)).to.equal(0);
  });

  it("should allow borrowing exactly at LTV limit", async () => {
    const tokenAddress = await token.getAddress();
    await pool.connect(user).deposit(tokenAddress, parseEther("100"));
    const prices = [parseEther("1")];
    await pool.connect(user).borrow(tokenAddress, parseEther("75"), prices);
    const debt = await pool.repayBalanceOf(tokenAddress, user.address);
    expect(debt).to.be.closeTo(parseEther("75"), parseEther("0.00001"));
  });

});


describe("LendingPool integration test", function () {
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
    await token.setFaucet(await faucet.getAddress());
    await faucet.connect(user).claimTokens();

    const InterestRateModel = await ethers.getContractFactory("InterestRateModel");
    interestModel = await InterestRateModel.deploy();
    await interestModel.waitForDeployment();
    await interestModel.setParams(tokenAddress, 200, 1000, 3000, 8000, 1000);

    const LendingPool = await ethers.getContractFactory("LendingPool");
    pool = await LendingPool.deploy([tokenAddress], await interestModel.getAddress());
    await pool.waitForDeployment();
    await pool.setAssetConfig(tokenAddress, parseEther("1000000"), parseEther("1000000"), 7500, 8000, 500);

    await token.connect(user).approve(await pool.getAddress(), parseEther("100"));
  });
  it("should update totalDeposits after a withdrawal", async () => {
    const tokenAddress = await token.getAddress();
    const depositAmount = parseEther("100");
    const withdrawAmount = parseEther("40");

    await pool.connect(user).deposit(tokenAddress, depositAmount);
    await pool.connect(user).withdraw(tokenAddress, withdrawAmount);

    const tokenState = await pool.tokenState(tokenAddress);
    const totalDeposits = tokenState[2];
    expect(totalDeposits).to.equal(depositAmount - withdrawAmount);
  });
  it("should allow a full flow: deposit → borrow → repay → withdraw", async () => {
    const tokenAddress = await token.getAddress();

    // Step 1: User deposits collateral
    await pool.connect(user).deposit(tokenAddress, parseEther("100"));

    // Step 2: Check deposited balance
    let userBalance = await pool.balanceOf(tokenAddress, user.address);
    expect(userBalance).to.equal(parseEther("100"));

    // Step 3: User borrows using the collateral
    const prices = [parseEther("1")];
    const borrowAmount = parseEther("50");
    await pool.connect(user).borrow(tokenAddress, borrowAmount, prices);

    // Step 4: User repays the borrowed amount
    await token.connect(user).approve(await pool.getAddress(), borrowAmount);
    await pool.connect(user).repay(tokenAddress, borrowAmount);

    const debtAfterRepay = await pool.repayBalanceOf(tokenAddress, user.address);
    expect(debtAfterRepay).to.be.lte(parseEther("0.000001"));

    // Step 5: User withdraws their full balance
    await pool.connect(user).withdraw(tokenAddress, parseEther("100"));
    const finalBalance = await pool.balanceOf(tokenAddress, user.address);
    expect(finalBalance).to.equal(0);
  });
});
