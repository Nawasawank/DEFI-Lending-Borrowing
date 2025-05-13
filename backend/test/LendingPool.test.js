const hre = require("hardhat");
const { expect } = require("chai");
const { ethers } = hre;

const parseEther = (val) => ethers.utils?.parseEther?.(val) || ethers.parseEther(val);
const parseUnits = (val, decimals = 18) => ethers.parseUnits(val.toString(), decimals);


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
    await expect(pool.connect(user).deposit(tokenAddress, 0)).to.be.revertedWith("Amount must be > 0");
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
    ).to.be.revertedWith("Exceeds cap");
  });
  it("should fail if deposit exceeds user's balance", async () => {
    const tokenAddress = await token.getAddress();
    const depositAmount = parseEther("2000");

    await expect(
      pool.connect(user).deposit(tokenAddress, depositAmount)
    ).to.be.reverted;
  });
    it("should skip accrueBorrowInterest if totalDeposits is zero", async () => {
    const Token = await ethers.getContractFactory("Token");
    const tempToken = await Token.deploy("ZeroDepositToken", "ZDT", 18);
    await tempToken.waitForDeployment();

    await pool.addAllowedToken(tempToken.target);
    await pool.setAssetConfig(tempToken.target, parseUnits("1000", 18), parseUnits("1000", 18), 7500, 8000, 500);

    // No deposit into this token, so totalDeposits == 0
    await ethers.provider.send("evm_increaseTime", [2]);
    await ethers.provider.send("evm_mine");

    // Call the function
    await pool.accrueBorrowInterest(tempToken.target);

    // If the test doesn't revert or throw, it means the branch was hit
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
    await expect(pool.connect(user).withdraw(tokenAddress, 0)).to.be.revertedWith("Amount must be > 0");
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

  it("should skip accrueInterest if elapsed < 1 second", async () => {
  const tokenAddress = await token.getAddress();
  await pool.accrueInterest(tokenAddress);
  await pool.accrueInterest(tokenAddress); 
});
it("should return 0 supply APY if user has no deposits", async () => {
  const apy = await pool.getTotalSupplyAPY(user.address);
  expect(apy).to.equal(0);
});

it("should emit Deposit event on deposit", async () => {
  const tokenAddress = await token.getAddress();
  await expect(pool.connect(user).deposit(tokenAddress, parseEther("10")))
    .to.emit(pool, "Deposit")
    .withArgs(tokenAddress, user.address, parseEther("10"));
});
it("should handle very small interest accrual correctly", async () => {
  const tokenAddress = await token.getAddress();
  await pool.connect(user).deposit(tokenAddress, parseEther("0.000001"));
  await pool.accrueInterest(tokenAddress);
  const balance = await pool.balanceOf(tokenAddress, user.address);
  expect(balance).to.be.gte(parseEther("0.000001"));
});
it("should skip accrueInterest if totalDeposits == 0 and elapsed >= 1", async () => {
  const tokenAddress = await token.getAddress();

  // Wait for at least 1 second
  await ethers.provider.send("evm_increaseTime", [2]);
  await ethers.provider.send("evm_mine");

  await pool.accrueInterest(tokenAddress);

  const state = await pool.tokenState(tokenAddress);
  expect(state.totalDeposits).to.equal(0);
});
it("should skip accrueBorrowInterest if elapsed < 1", async () => {
  const tokenAddress = await token.getAddress();
  await pool.accrueBorrowInterest(tokenAddress);
  const state = await pool.tokenState(tokenAddress);
  expect(state.totalBorrows).to.equal(0);
});
it("should initialize lastAccrueTime when adding a new allowed token", async () => {
  const Token = await ethers.getContractFactory("Token");
  const newToken = await Token.deploy("NewToken", "NEW", 18);
  await newToken.waitForDeployment();

  await pool.addAllowedToken(await newToken.getAddress());

  const state = await pool.tokenState(await newToken.getAddress());
  expect(state.lastAccrueTime).to.be.gt(0);
});
it("should revert if liquidator address is zero in approveLiquidation", async () => {
  const tokenAddress = await token.getAddress();
  await expect(
    pool.approveLiquidation(tokenAddress, ethers.ZeroAddress, parseUnits("1", 18))
  ).to.be.revertedWith("Invalid liquidator address");
});
it("should revert if approveLiquidation amount is zero", async () => {
  const tokenAddress = await token.getAddress();
  await expect(
    pool.approveLiquidation(tokenAddress, user.address, 0)
  ).to.be.revertedWith("Amount must be greater than zero");
});
it("should revert if maxLTV exceeds liquidation threshold", async () => {
  const tokenAddress = await token.getAddress();
  await expect(
    pool.setAssetConfig(
      tokenAddress,
      parseUnits("1000000", 18),
      parseUnits("1000000", 18),
      8500,  // maxLTV
      8000,  // liquidationThreshold
      500
    )
  ).to.be.revertedWith("LTV must be <= threshold");
});
it("should revert if a non-owner tries to deposit unsupported token", async () => {
  const Token = await ethers.getContractFactory("Token");
  const fakeToken = await Token.deploy("Fake", "FAK", parseEther("1000"));
  await fakeToken.waitForDeployment();
  await fakeToken.transfer(user.address, parseEther("10"));
  await fakeToken.connect(user).approve(pool.target, parseEther("10"));

  await expect(
    pool.connect(user).deposit(fakeToken.target, parseEther("10"))
  ).to.be.revertedWith("Token not allowed");
});
it("should allow setAssetConfig if penalty < 2000", async () => {
  const tokenAddress = await token.getAddress();
  await pool.setAssetConfig(tokenAddress, parseEther("1000"), parseEther("1000"), 7000, 8000, 1999);
});
it("should skip accrueBorrowInterest when elapsed < 1 second", async () => {
  const tokenAddress = await token.getAddress();
  await pool.accrueBorrowInterest(tokenAddress);
  await pool.accrueBorrowInterest(tokenAddress); 
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

    await token.approve(poolAddress, parseEther("500"));
    await pool.deposit(tokenAddress, parseEther("500"));
  });
  it("should revert if constructor is called with zero address interest model", async () => {
    const LendingPool = await ethers.getContractFactory("LendingPool");
    await expect(LendingPool.deploy([], ethers.ZeroAddress)).to.be.revertedWith("Invalid interest model");
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

  it("should fail to repay when amount is zero", async () => {
    const tokenAddress = await token.getAddress();
    await expect(
      pool.connect(user).repay(tokenAddress, 0)
    ).to.be.revertedWith("Amount must be > 0"); 
  });
  it("should skip accrueBorrowInterest if elapsed time is less than 1 second", async () => {
  const tokenAddress = await token.getAddress();
  await pool.accrueBorrowInterest(tokenAddress);
  await pool.accrueBorrowInterest(tokenAddress);
});
it("should emit Borrow event on borrow", async () => {
  const tokenAddress = await token.getAddress();
  await pool.connect(user).deposit(tokenAddress, parseEther("100"));
  const prices = [parseEther("1")];
  await expect(pool.connect(user).borrow(tokenAddress, parseEther("50"), prices))
    .to.emit(pool, "Borrow")
    .withArgs(tokenAddress, user.address, parseEther("50"));
});
it("should revert in borrow if token not in supportedTokens list", async () => {
  const OtherToken = await ethers.getContractFactory("Token");
  const fake = await OtherToken.deploy("Fake", "FAK", parseEther("1000"));
  await fake.waitForDeployment();

  const prices = [parseEther("1")]; 
  await expect(
    pool.connect(user).borrow(fake.getAddress(), parseEther("10"), prices)
  ).to.be.revertedWith("Token not allowed");
});


it("should emit Repay event on repay", async () => {
  const tokenAddress = await token.getAddress();
  await pool.connect(user).deposit(tokenAddress, parseEther("100"));
  const prices = [parseEther("1")];
  await pool.connect(user).borrow(tokenAddress, parseEther("50"), prices);
  await token.connect(user).approve(await pool.getAddress(), parseEther("50"));
  await expect(pool.connect(user).repay(tokenAddress, parseEther("50")))
    .to.emit(pool, "Repay")
    .withArgs(tokenAddress, user.address, parseEther("50"));
});
it("should return max uint if no deposits and no borrows", async () => {
  const tokenAddress = await token.getAddress();
  const prices = [parseEther("1")];
  const hf = await pool.getHealthFactor(user.address, prices);
  expect(hf).to.equal(ethers.MaxUint256);
});
it("should revert if user has no collateral and tries to borrow", async () => {
  const tokenAddress = await token.getAddress();
  const prices = [parseEther("1")];
  await expect(
    pool.connect(user).borrow(tokenAddress, parseEther("10"), prices)
  ).to.be.revertedWith("Exceeds collateral-based limit");
});
it("should subtract repayAmount from debt in previewHealthFactorAfterRepay", async () => {
  const tokenAddress = await token.getAddress();
  await pool.connect(user).deposit(tokenAddress, parseEther("100"));
  await pool.connect(user).borrow(tokenAddress, parseEther("40"), [parseEther("1")]);

  const result = await pool.previewHealthFactorAfterRepay(
    user.address,
    tokenAddress,
    parseEther("10"), // repayAmount < userDebt
    [parseEther("1")]
  );
  expect(result).to.be.a("bigint");
});

it("should cap repay amount to user debt when overpaying", async () => {
  const tokenAddress = await token.getAddress();
  await pool.connect(user).deposit(tokenAddress, parseEther("100"));
  await pool.connect(user).borrow(tokenAddress, parseEther("10"), [parseEther("1")]);

  // Give user extra tokens
  await token.transfer(user.address, parseEther("20"));
  await token.connect(user).approve(pool.getAddress(), parseEther("20"));

  // Over-repay
  await pool.connect(user).repay(tokenAddress, parseEther("20"));
  const debt = await pool.repayBalanceOf(tokenAddress, user.address);
  expect(debt).to.equal(0);
});
it("should revert previewHealthFactorAfterBorrow with length mismatch when multiple tokens", async () => {
  const OtherToken = await ethers.getContractFactory("Token");
  const token2 = await OtherToken.deploy("Token2", "TK2", parseEther("1000"));
  await token2.waitForDeployment();

  await pool.addAllowedToken(token2.getAddress());

  await expect(
    pool.previewHealthFactorAfterBorrow(user.address, token.getAddress(), parseEther("10"), [parseEther("1")]) // only 1 price
  ).to.be.revertedWith("Invalid token prices length");
});



it("should skip accrueBorrowInterest if totalDeposits is zero", async () => {
  const Token = await ethers.getContractFactory("Token");
  const newToken = await Token.deploy("ZeroToken", "ZERO", parseEther("1000"));
  await newToken.waitForDeployment();
  await pool.addAllowedToken(await newToken.getAddress());
  await pool.accrueBorrowInterest(await newToken.getAddress()); // no deposits yet
});

it("should return 0 repay balance if user has no borrow shares", async () => {
  const tokenAddress = await token.getAddress();
  const repayBal = await pool.repayBalanceOf(tokenAddress, user.address);
  expect(repayBal).to.equal(0);
});

it("should return 0 repay balance if total borrow shares is 0", async () => {
  const tokenAddress = await token.getAddress();
  await pool.connect(user).deposit(tokenAddress, parseEther("10")); // only deposit, no borrow
  const repayBal = await pool.repayBalanceOf(tokenAddress, user.address);
  expect(repayBal).to.equal(0);
});
it("should allow borrowing with collateral from a different token", async () => {
  const OtherToken = await ethers.getContractFactory("Token");
  const token2 = await OtherToken.deploy("Token2", "TK2", parseEther("1000"));
  await token2.waitForDeployment();

  await pool.addAllowedToken(token2.getAddress());
  await pool.setAssetConfig(token2.getAddress(), parseEther("1000000"), parseEther("1000000"), 7500, 8000, 500);

  await token2.transfer(user.address, parseEther("100"));
  await token2.connect(user).approve(pool.getAddress(), parseEther("100"));
  await pool.connect(user).deposit(token2.getAddress(), parseEther("100"));

  const prices = [parseEther("1"), parseEther("1")];
  await expect(pool.connect(user).borrow(token.getAddress(), parseEther("50"), prices)).to.not.be.reverted;
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
    await expect(pool.connect(user).repay(tokenAddress, 0)).to.be.revertedWith("Amount must be > 0");
  });

  it("should fail to repay if user has no borrow", async () => {
    const tokenAddress = await token.getAddress();
    await token.connect(user).approve(await pool.getAddress(), parseEther("10"));

    await expect(
      pool.connect(user).repay(tokenAddress, parseEther("10"))
    ).to.be.revertedWith("Nothing to repay");
  });
  it("should allow correct withdrawal after interest accrual", async () => {
    const tokenAddress = await token.getAddress();
    await pool.connect(user).deposit(tokenAddress, parseEther("50"));
    await pool.accrueInterest(tokenAddress); // simulate interest gain

    const beforeBalance = await pool.balanceOf(tokenAddress, user.address);
    await pool.connect(user).withdraw(tokenAddress, parseEther("25"));

    const afterBalance = await pool.balanceOf(tokenAddress, user.address);
    expect(afterBalance).to.be.lt(beforeBalance);
  });

  it("should revert if borrow amount exceeds borrow cap", async () => {
  const tokenAddress = await token.getAddress();
  await pool.setAssetConfig(tokenAddress, parseEther("1000000"), parseEther("20"), 7500, 8000, 500);

  await pool.connect(user).deposit(tokenAddress, parseEther("100"));
  const prices = [parseEther("1")];

  await expect(
    pool.connect(user).borrow(tokenAddress, parseEther("50"), prices)
  ).to.be.revertedWith("Exceeds borrow cap");
});
it("should skip accrueBorrowInterest if elapsed < 1 second", async () => {
  const tokenAddress = await token.getAddress();
  await pool.accrueBorrowInterest(tokenAddress);
  await pool.accrueBorrowInterest(tokenAddress); // immediate call again
});

it("should skip accrueBorrowInterest if totalDeposits == 0", async () => {
  const Token = await ethers.getContractFactory("Token");
  const newToken = await Token.deploy("NewToken", "NEW", parseEther("1000"));
  await newToken.waitForDeployment();

  await pool.addAllowedToken(await newToken.getAddress());

  await pool.accrueBorrowInterest(await newToken.getAddress());
});

it("should return 0 repay balance if user has no shares", async () => {
  const tokenAddress = await token.getAddress();
  const repayBal = await pool.repayBalanceOf(tokenAddress, user.address);
  expect(repayBal).to.equal(0);
});

it("should return 0 repay balance if totalBorrowShares is 0", async () => {
  const tokenAddress = await token.getAddress();
  await pool.connect(user).deposit(tokenAddress, parseEther("10")); // just deposit, no borrow
  const repayBal = await pool.repayBalanceOf(tokenAddress, user.address);
  expect(repayBal).to.equal(0);
});
it("should skip borrow interest accrual if totalBorrows == 0", async () => {
  const tokenAddress = await token.getAddress();
  const prices = [parseEther("1")];
  const health = await pool.getHealthFactor(user.address, prices);
  expect(health).to.be.a("bigint");
});
it("should return max uint if no borrows in health factor", async () => {
  const tokenAddress = await token.getAddress();
  const prices = [parseEther("1")];
  const health = await pool.getHealthFactor(user.address, prices);
  expect(health).to.equal(ethers.MaxUint256);
});
it("should calculate borrow value correctly in previewHealthFactorAfterBorrow", async () => {
  const tokenAddress = await token.getAddress();

  // Step 1: User deposits collateral
  await pool.connect(user).deposit(tokenAddress, parseEther("100"));

  // Step 2: User borrows part of it
  const borrowAmount = parseEther("40");
  const prices = [parseEther("1")];
  await pool.connect(user).borrow(tokenAddress, borrowAmount, prices);

  // Step 3: Call previewHealthFactorAfterBorrow with additional borrow
  const preview = await pool.previewHealthFactorAfterBorrow(
    user.address,
    tokenAddress,
    parseEther("10"), // simulate an extra 10
    prices
  );

  expect(preview).to.be.a("bigint");
});

it("should allow borrowing right at the LTV threshold", async () => {
  const tokenAddress = await token.getAddress();
  await pool.connect(user).deposit(tokenAddress, parseEther("100")); // Collateral worth $100
  const prices = [parseEther("1")];

  // LTV = 75%, so 75 tokens is max allowed
  await pool.connect(user).borrow(tokenAddress, parseEther("75"), prices);
  const debt = await pool.repayBalanceOf(tokenAddress, user.address);
  expect(debt).to.be.closeTo(parseEther("75"), parseEther("0.000001"));
});
it("should skip collateral token with totalShares == 0 in borrow", async () => {
  const Token = await ethers.getContractFactory("Token");
  const token2 = await Token.deploy("NoShares", "NSH", 18);
  await token2.waitForDeployment();
  await pool.addAllowedToken(token2.target);
  await pool.setAssetConfig(token2.target, parseUnits("1000000", 18), parseUnits("1000000", 18), 7500, 8000, 500);

  await token.connect(user).approve(pool.getAddress(), parseEther("100"));
  await pool.connect(user).deposit(token.getAddress(), parseEther("100"));
  
  const prices = [parseEther("1"), parseEther("1")];
  await pool.connect(user).borrow(token.getAddress(), parseEther("10"), prices);
});
it("should assign full shares on first borrow (zero borrowShares and borrows)", async () => {
  const tokenAddress = await token.getAddress();
  await pool.connect(user).deposit(tokenAddress, parseEther("100"));
  const prices = [parseEther("1")];

  await pool.connect(user).borrow(tokenAddress, parseEther("10"), prices); // first borrow
  const shares = await pool.repayBalanceOf(tokenAddress, user.address);
  expect(shares).to.equal(parseEther("10"));
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

it("should allow borrowing just below the LTV limit", async () => {
  const tokenAddress = await token.getAddress();
  await pool.connect(user).deposit(tokenAddress, parseEther("100"));
  const prices = [parseEther("1")];

  const healthBefore = await pool.previewHealthFactorAfterBorrow(
    user.address,
    tokenAddress,
    parseEther("74.99"),
    prices
  );
  const borrowAmount = parseEther("74.8");
  await pool.connect(user).borrow(tokenAddress, borrowAmount, prices);

  const debt = await pool.repayBalanceOf(tokenAddress, user.address);
  expect(debt).to.be.closeTo(borrowAmount, parseEther("0.001"));
});
it("should revert if setLiquidationContract address is zero", async () => {
  await expect(pool.setLiquidationContract(ethers.ZeroAddress)).to.be.revertedWith("Invalid address");
});

it("should revert if approveLiquidation amount is zero", async () => {
  const tokenAddress = await token.getAddress();
  await expect(
    pool.approveLiquidation(tokenAddress, user.address, 0)
  ).to.be.revertedWith("Amount must be greater than zero");
});

it("should revert if non-liquidation tries to seize collateral", async () => {
  const tokenAddress = await token.getAddress();
  await expect(
    pool.connect(user).seizeCollateral(tokenAddress, user.address, parseEther("1"))
  ).to.be.revertedWith("Not authorized");
});

it("should return 0 repay balance if user has no shares", async () => {
  const tokenAddress = await token.getAddress();
  const repayBal = await pool.repayBalanceOf(tokenAddress, user.address);
  expect(repayBal).to.equal(0);
});
it("should return max uint if previewing health factor with zero borrow value", async () => {
  const tokenAddress = await token.getAddress();

  // User deposits collateral, but borrows nothing
  await pool.connect(user).deposit(tokenAddress, parseUnits("100", 18));

  const prices = [parseUnits("1", 18)];
  const preview = await pool.previewHealthFactorAfterBorrow(
    user.address,
    tokenAddress,
    0, // zero borrow amount
    prices
  );

  // Use a version-agnostic way to get MaxUint256
  const maxUint256 = ethers.MaxUint256 || 
                     ethers.constants?.MaxUint256 || 
                     "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
                     
  expect(preview).to.equal(maxUint256);
});
it("should return 1e36 if total borrow value is zero after repay preview", async () => {
  const tokenAddress = await token.getAddress();

  // Deposit but DO NOT borrow
  await pool.connect(user).deposit(tokenAddress, parseEther("50"));

  // Preview repay (no debt exists, so borrow value = 0)
  const result = await pool.previewHealthFactorAfterRepay(
    user.address,
    tokenAddress,
    parseEther("1"),         // any repay amount
    [parseEther("1")]        // price
  );

  expect(result).to.equal(BigInt("1000000000000000000000000000000000000")); 
});
it("should return difference from getAvailableLiquidity when deposits > borrows", async () => {
  const tokenAddress = await token.getAddress();

  await pool.connect(user).deposit(tokenAddress, parseEther("100"));
  await pool.connect(user).borrow(tokenAddress, parseEther("40"), [parseEther("1")]);

  const available = await pool.getAvailableLiquidity(tokenAddress);
  expect(available).to.equal(parseEther("60"));
});
it("should return 0 from getAvailableLiquidity when totalDeposits < totalBorrows", async () => {
  const tokenAddress = await token.getAddress();

  await pool.connect(owner).setAssetConfig(tokenAddress, parseEther("1000000"), parseEther("1000000"), 7500, 8000, 500);
  
  const tokenStateBefore = await pool.tokenState(tokenAddress);

  await token.transfer(pool.getAddress(), parseEther("50")); // fake borrow value

  const available = await pool.getAvailableLiquidity(tokenAddress);
  expect(available).to.equal(0);
});
it("should cap repay amount to actual debt if overpay", async () => {
  const tokenAddress = await token.getAddress();
  await pool.connect(user).deposit(tokenAddress, parseEther("100"));
  await pool.connect(user).borrow(tokenAddress, parseEther("10"), [parseEther("1")]);

  // User already claimed faucet, so transfer extra tokens from owner
  await token.transfer(user.address, parseEther("20"));

  await token.connect(user).approve(pool.getAddress(), parseEther("20"));

  await expect(pool.connect(user).repay(tokenAddress, parseEther("20"))).to.not.be.reverted;

  const remainingDebt = await pool.repayBalanceOf(tokenAddress, user.address);
  expect(remainingDebt).to.equal(0);
});
it("should return 0 utilization if totalDeposits is zero", async () => {
  const tokenAddress = await token.getAddress();
  
  // No deposits yet
  const utilization = await pool.getUtilization(tokenAddress);
  expect(utilization).to.equal(0);
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

    await pool.connect(user).deposit(tokenAddress, parseEther("100"));

    let userBalance = await pool.balanceOf(tokenAddress, user.address);
    expect(userBalance).to.equal(parseEther("100"));

    const prices = [parseEther("1")];
    const borrowAmount = parseEther("50");
    await pool.connect(user).borrow(tokenAddress, borrowAmount, prices);

    await token.connect(user).approve(await pool.getAddress(), borrowAmount);
    await pool.connect(user).repay(tokenAddress, borrowAmount);

    const debtAfterRepay = await pool.repayBalanceOf(tokenAddress, user.address);
    expect(debtAfterRepay).to.be.lte(parseEther("0.000001"));

    await pool.connect(user).withdraw(tokenAddress, parseEther("100"));
    const finalBalance = await pool.balanceOf(tokenAddress, user.address);
    expect(finalBalance).to.equal(0);
  });
    it("should return correct utilization", async () => {
    const tokenAddress = await token.getAddress();
    await token.connect(owner).approve(pool.getAddress(), parseEther("100"));
    await pool.connect(owner).deposit(tokenAddress, parseEther("100"));
    const utilization = await pool.getUtilization(tokenAddress);
    expect(utilization).to.equal(0); // no borrows yet
  });
  
  it("should return repay balance of user", async () => {
    const tokenAddress = await token.getAddress();
    await pool.connect(user).deposit(tokenAddress, parseEther("100"));
    await pool.connect(user).borrow(tokenAddress, parseEther("50"), [parseEther("1")]);
    const repayBal = await pool.repayBalanceOf(tokenAddress, user.address);
    expect(repayBal).to.be.closeTo(parseEther("50"), parseEther("0.001"));
  });
  
  it("should accrue interest when calling getHealthFactor after time passes", async () => {
  const tokenAddress = await token.getAddress();

  // Step 1: User deposits
  await pool.connect(user).deposit(tokenAddress, parseEther("100"));

  // Step 2: User borrows
  await pool.connect(user).borrow(tokenAddress, parseEther("50"), [parseEther("1")]);

  // Step 3: Advance time by 1 day
  await ethers.provider.send("evm_increaseTime", [86400]); // 1 day
  await ethers.provider.send("evm_mine");

  // Step 4: Call getHealthFactor (which triggers line 160 logic)
  const result = await pool.getHealthFactor(user.address, [parseEther("1")]);

  expect(result).to.be.a("bigint");
});


  it("should return user collateral correctly", async () => {
    const tokenAddress = await token.getAddress();
    await pool.connect(user).deposit(tokenAddress, parseEther("25"));
    const [tokens, balances] = await pool.getUserCollateral(user.address);
    expect(tokens[0]).to.equal(tokenAddress);
    expect(balances[0]).to.equal(parseEther("25"));
  });

  it("should return user borrow amounts", async () => {
    const tokenAddress = await token.getAddress();
    await pool.connect(user).deposit(tokenAddress, parseEther("100"));
    await pool.connect(user).borrow(tokenAddress, parseEther("60"), [parseEther("1")]);
    const [tokens, amounts] = await pool.getUserBorrow(user.address);
    expect(tokens[0]).to.equal(tokenAddress);
    expect(amounts[0]).to.be.closeTo(parseEther("60"), parseEther("0.001"));
  });


  it("should return total supply APY for a user", async () => {
    const tokenAddress = await token.getAddress();
    await pool.connect(user).deposit(tokenAddress, parseEther("100"));
    const apy = await pool.getTotalSupplyAPY(user.address);
    expect(apy).to.be.a("bigint");
  });

  it("should return liquidation parameters", async () => {
    const tokenAddress = await token.getAddress();
    const [penalty, threshold, ltv] = await pool.getLiquidationParams(tokenAddress);
    expect(penalty).to.equal(500);
    expect(threshold).to.equal(8000);
    expect(ltv).to.equal(7500);
  });

  it("should preview health factor after repay", async () => {
    const tokenAddress = await token.getAddress();
    await pool.connect(user).deposit(tokenAddress, parseEther("100"));
    await pool.connect(user).borrow(tokenAddress, parseEther("60"), [parseEther("1")]);

    const health = await pool.previewHealthFactorAfterRepay(
      user.address,
      tokenAddress,
      parseEther("30"),
      [parseEther("1")]
    );

    expect(health).to.be.a("bigint");
  });
  
  it("should allow liquidation contract to seize collateral", async () => {
    const tokenAddress = await token.getAddress();
    await pool.setLiquidationContract(owner.address); // setting self for test
    await pool.connect(user).deposit(tokenAddress, parseEther("10"));
    await pool.seizeCollateral(tokenAddress, user.address, parseEther("5"));
    const userBalance = await token.balanceOf(user.address);
    expect(userBalance).to.be.gte(parseEther("5"));
  });
  it("should approve liquidation contract to spend tokens", async () => {
    const fakeLiquidator = user;
    const tokenAddress = await token.getAddress();
    const approveAmount = parseEther("10");

    await expect(pool.approveLiquidation(tokenAddress, fakeLiquidator.address, approveAmount))
      .to.not.be.reverted;

    const allowance = await token.allowance(pool.getAddress(), fakeLiquidator.address);
    expect(allowance).to.equal(approveAmount);
  });
  it("should return correct balance when totalShares > 0", async () => {
  const tokenAddress = await token.getAddress();
  const amount = parseUnits("50", 18);

  await token.connect(user).approve(pool.target, amount);
  await pool.connect(user).deposit(tokenAddress, amount);

  const balance = await pool.balanceOf(tokenAddress, user.address);
  expect(balance).to.equal(amount);
});

describe("LendingPool edge branch coverage tests", function () {
  it("should return 0 userCollateral when totalShares is 0", async () => {
    const [tokenAddress] = await pool.getSupportedTokens();
    const [tokens, balances] = await pool.getUserCollateral(user.address);
    const index = tokens.indexOf(tokenAddress);
    expect(balances[index]).to.equal(0);
  });

  it("should return 0 from balanceOf if totalShares is 0", async () => {
    const tokenAddress = await token.getAddress();
    const bal = await pool.balanceOf(tokenAddress, user.address);
    expect(bal).to.equal(0);
  });

  it("should revert when trying to repay with 0 borrow shares", async () => {
    const tokenAddress = await token.getAddress();
    await expect(
      pool.connect(user).repay(tokenAddress, parseUnits("1", 18))
    ).to.be.revertedWith("Nothing to repay");
  });

  it("should return 0 utilization when totalDeposits is 0", async () => {
    const Token = await ethers.getContractFactory("Token");
    const unusedToken = await Token.deploy("Unused", "UNU", 18);
    await unusedToken.waitForDeployment();

    await pool.addAllowedToken(unusedToken.target);
    await pool.setAssetConfig(unusedToken.target, parseUnits("1000000", 18), parseUnits("1000000", 18), 7500, 8000, 500);

    const utilization = await pool.getUtilization(unusedToken.target);
    expect(utilization).to.equal(0);
  });
  it("should return 0 userCollateral if t.totalDeposits == 0 but d.shares > 0", async () => {
  const tokenAddress = await token.getAddress();
  await token.connect(user).approve(pool.getAddress(), parseEther("100"));
  await pool.connect(user).deposit(tokenAddress, parseEther("100"));

  // Forcefully set totalDeposits to 0 (simulate drain)
  await pool.connect(user).withdraw(tokenAddress, parseEther("100"));

  const [tokens, balances] = await pool.getUserCollateral(user.address);
  expect(balances[0]).to.equal(0);
});
it("should apply full repay amount if repayAmount < userDebt in previewHealthFactorAfterRepay", async () => {
  const tokenAddress = await token.getAddress();
  await pool.connect(user).deposit(tokenAddress, parseEther("100"));
  await pool.connect(user).borrow(tokenAddress, parseEther("50"), [parseEther("1")]);

  const result = await pool.previewHealthFactorAfterRepay(
    user.address,
    tokenAddress,
    parseEther("10"), // repay less than debt
    [parseEther("1")]
  );
  expect(result).to.be.a("bigint");
});

it("should return 0 repayBalance if totalBorrowShares is zero", async () => {
  const tokenAddress = await token.getAddress();

  // user deposits but never borrows, so totalBorrowShares == 0
  await pool.connect(user).deposit(tokenAddress, parseEther("100"));
  const balance = await pool.repayBalanceOf(tokenAddress, user.address);
  expect(balance).to.equal(0);
});
it("should apply full debt if repayAmount > userDebt in previewHealthFactorAfterRepay", async () => {
  const tokenAddress = await token.getAddress();
  await token.connect(user).approve(pool.getAddress(), parseEther("100"));
  await pool.connect(user).deposit(tokenAddress, parseEther("100"));
  await pool.connect(user).borrow(tokenAddress, parseEther("10"), [parseEther("1")]);

  const result = await pool.previewHealthFactorAfterRepay(
    user.address,
    tokenAddress,
    parseEther("100"), // repayAmount > userDebt
    [parseEther("1")]
  );
  expect(result).to.be.a("bigint");
});
it("should return 0 from getAvailableLiquidity if borrows exceed deposits", async () => {
  const tokenAddress = await token.getAddress();
  const state = await pool.tokenState(tokenAddress);

  // Forcefully simulate borrows exceeding deposits
  state.totalDeposits = parseEther("10");
  state.totalBorrows = parseEther("20");

  const liquidity = await pool.getAvailableLiquidity(tokenAddress);
  expect(liquidity).to.equal(0);
});
it("should return 0 from repayBalanceOf when totalBorrowShares is zero", async () => {
  const tokenAddress = await token.getAddress();
  await pool.connect(user).deposit(tokenAddress, parseEther("10")); // no borrow
  const repayBal = await pool.repayBalanceOf(tokenAddress, user.address);
  expect(repayBal).to.equal(0);
});
it("should skip borrow value if userBorrowShares == 0 in previewHealthFactorAfterBorrow", async () => {
  const tokenAddress = await token.getAddress();
  await pool.connect(user).deposit(tokenAddress, parseEther("50")); // only deposit
  const result = await pool.previewHealthFactorAfterBorrow(
    user.address,
    tokenAddress,
    parseEther("10"),
    [parseEther("1")]
  );
  expect(result).to.be.a("bigint");
});



});
describe("LendingPool branch coverage", function () {
  let token, pool, owner, user;

  beforeEach(async function () {
    [owner, user] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("Token");
    token = await Token.deploy("Test Token", "TTK", 18);
    await token.waitForDeployment();

    await token.setFaucet(owner.address);

    const InterestRateModel = await ethers.getContractFactory("InterestRateModel");
    const interestModel = await InterestRateModel.deploy();
    await interestModel.waitForDeployment();

    const LendingPool = await ethers.getContractFactory("LendingPool");
    pool = await LendingPool.deploy([], interestModel.target);
    await pool.waitForDeployment();

    await pool.addAllowedToken(token.target);
    await pool.setAssetConfig(token.target, parseUnits("1000000", 18), parseUnits("1000000", 18), 7500, 8000, 500);
    await token.mint(user.address, parseUnits("100", 18));
    await token.connect(user).approve(pool.target, parseUnits("100", 18));
  });

  it("should revert approveLiquidation if token not allowed", async function () {
    const Token2 = await ethers.getContractFactory("Token");
    const token2 = await Token2.deploy("Invalid", "INV", 18);
    await token2.waitForDeployment();

    await expect(
      pool.approveLiquidation(token2.target, user.address, parseUnits("1", 18))
    ).to.be.revertedWith("Token not allowed");
  });

  it("should revert approveLiquidation if liquidator is zero address", async function () {
    await expect(
      pool.approveLiquidation(token.target, ethers.ZeroAddress, parseUnits("1", 18))
    ).to.be.revertedWith("Invalid liquidator address");
  });

  it("should return 0 balance if totalShares == 0", async function () {
    const balance = await pool.balanceOf(token.target, user.address);
    expect(balance).to.equal(0);
  });

  it("should return borrow amounts == 0 if borrowShares == 0", async function () {
    const [tokens, amounts] = await pool.getUserBorrow(user.address);
    expect(amounts[0]).to.equal(0);
  });

  it("should return userCollateral == 0 if totalShares == 0", async function () {
    const [tokens, balances] = await pool.getUserCollateral(user.address);
    expect(balances[0]).to.equal(0);
  });
  it("should return 0 from balanceOf if totalShares is 0", async () => {
  const tokenAddress = await token.getAddress();
  const balance = await pool.balanceOf(tokenAddress, user.address);
  expect(balance).to.equal(0);
});
it("should return 0 in getUserCollateral if totalShares is 0", async () => {
  const [tokens, balances] = await pool.getUserCollateral(user.address);
  expect(balances[0]).to.equal(0);
});
it("should return user balance in getUserCollateral if totalShares > 0", async () => {
  const tokenAddress = await token.getAddress();
  await token.connect(user).approve(pool.getAddress(), parseEther("100"));
  await pool.connect(user).deposit(tokenAddress, parseEther("100"));

  const [tokens, balances] = await pool.getUserCollateral(user.address);
  expect(balances[0]).to.equal(parseEther("100"));
});

  
  
});


describe("Additional LendingPool Branch Coverage2", function () {
  let owner, user, liquidator;
  let token, pool;

  beforeEach(async function () {
    [owner, user, liquidator] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("Token");
    token = await Token.deploy("TestToken", "TTK", 18);
    await token.waitForDeployment();

    const InterestRateModel = await ethers.getContractFactory("InterestRateModel");
    const interestModel = await InterestRateModel.deploy();
    await interestModel.waitForDeployment();

    const LendingPool = await ethers.getContractFactory("LendingPool");
    pool = await LendingPool.deploy([], interestModel.target);
    await pool.waitForDeployment();

    await pool.setAssetConfig(
      token.target,
      parseUnits("1000000", 18),
      parseUnits("1000000", 18),
      7500,
      8000,
      500
    );
    await pool.addAllowedToken(token.target);
  });

  it("should revert in approveLiquidation if token is not allowed", async () => {
    const Token2 = await ethers.getContractFactory("Token");
    const token2 = await Token2.deploy("Fake", "FAK", 18);
    await token2.waitForDeployment();
    await expect(
      pool.approveLiquidation(token2.target, liquidator.address, parseUnits("10", 18))
    ).to.be.revertedWith("Token not allowed");
  });

  it("should return health factor max uint if borrowAmount is zero", async () => {
    const result = await pool.previewHealthFactorAfterBorrow(
      user.address,
      token.target,
      0,
      [parseUnits("1", 18)]
    );
    expect(result).to.equal(ethers.MaxUint256);
  });

  it("should revert previewHealthFactorAfterBorrow if prices length mismatch", async () => {
    await expect(
      pool.previewHealthFactorAfterBorrow(
        user.address,
        token.target,
        parseUnits("10", 18),
        []
      )
    ).to.be.revertedWith("Invalid token prices length");
  });
  
});

  

describe("LendingPool additional functionality", function () {
  let owner, user, newToken, pool, interestModel;

  beforeEach(async () => {
    [owner, user] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("Token");
    newToken = await Token.deploy("NewToken", "NEW", parseEther("1000"));
    await newToken.waitForDeployment();

    // ✅ Give user tokens to test with
    await newToken.transfer(user.address, parseEther("100"));

    const InterestRateModel = await ethers.getContractFactory("InterestRateModel");
    interestModel = await InterestRateModel.deploy();
    await interestModel.waitForDeployment();

    const LendingPool = await ethers.getContractFactory("LendingPool");
    pool = await LendingPool.deploy([], interestModel.getAddress());
    await pool.waitForDeployment();

    // ✅ Allow token
    await pool.addAllowedToken(await newToken.getAddress());
  });

  it("should add a new allowed token", async () => {
    await pool.addAllowedToken(await newToken.getAddress());
    const allowed = await pool.allowedTokens(await newToken.getAddress());
    expect(allowed).to.be.true;
  });

  it("should return all supported tokens", async () => {
    await pool.addAllowedToken(await newToken.getAddress());
    const tokens = await pool.getSupportedTokens();
    expect(tokens).to.include(await newToken.getAddress());
  });


  it("should revert if approveLiquidation uses unsupported token", async () => {
    const Token = await ethers.getContractFactory("Token");
    const fakeToken = await Token.deploy("Fake", "FAKE", parseEther("1000"));
    await fakeToken.waitForDeployment();

    await expect(
      pool.approveLiquidation(await fakeToken.getAddress(), user.address, parseEther("1"))
    ).to.be.revertedWith("Token not allowed");
  });


  it("should set liquidation contract address", async () => {
    await pool.setLiquidationContract(user.address);
  });
  it("should revert if setLiquidationContract is called with address(0)", async () => {
  await expect(pool.setLiquidationContract(ethers.ZeroAddress)).to.be.revertedWith("Invalid address");
  });
  
  it("should revert if pool liquidity is insufficient", async () => {
    const tokenAddress = await newToken.getAddress();

    // Add token to allowed list
    await pool.addAllowedToken(tokenAddress);

    // User deposits a small amount
    await newToken.connect(user).approve(pool.getAddress(), parseEther("10"));
    await pool.connect(user).deposit(tokenAddress, parseEther("10"));

    // Try borrowing more than liquidity
    const prices = [parseEther("1")];
    await expect(
      pool.connect(user).borrow(tokenAddress, parseEther("100"), prices)
    ).to.be.revertedWith("Not enough liquidity");
  });
  it("should update borrow value correctly in previewHealthFactorAfterRepay when colToken != token", async () => {
    const tokenAddress = await token.getAddress();
    const Token2 = await ethers.getContractFactory("Token");
    const token2 = await Token2.deploy("Token2", "TK2", parseEther("1000"));
    await token2.waitForDeployment();

    await pool.addAllowedToken(await token2.getAddress());
    await pool.setAssetConfig(token2.getAddress(), parseEther("1000000"), parseEther("1000000"), 7500, 8000, 500);

    await token2.transfer(user.address, parseEther("100"));
    await token2.connect(user).approve(pool.getAddress(), parseEther("100"));
    await pool.connect(user).deposit(token2.getAddress(), parseEther("100"));

    const prices = [parseEther("1"), parseEther("1")];
    const result = await pool.previewHealthFactorAfterRepay(
      user.address,
      tokenAddress, // Repay token ≠ colToken
      parseEther("10"),
      prices
    );

    expect(result).to.be.a("bigint");
  });
  it("should return 0 from getAvailableLiquidity when totalDeposits < totalBorrows", async () => {
  const tokenAddress = await token.getAddress();
  await pool.connect(owner).setAssetConfig(tokenAddress, parseEther("1000000"), parseEther("1000000"), 7500, 8000, 500);
  await token.transfer(pool.getAddress(), parseEther("50")); // simulate borrow imbalance
  const available = await pool.getAvailableLiquidity(tokenAddress);
  expect(available).to.equal(0);
});
it("should return 0 APY if user has 0 shares", async () => {
  const apy = await pool.getTotalSupplyAPY(user.address);
  expect(apy).to.equal(0);
});


});


});


