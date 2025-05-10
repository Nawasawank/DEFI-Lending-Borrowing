const { expect } = require("chai");
const { ethers } = require("hardhat");

const parseUnits = (val, decimals = 18) =>
  ethers.utils?.parseUnits?.(val.toString(), decimals) || ethers.parseUnits(val.toString(), decimals);

describe("TokenFaucet", function () {
  let Token, Faucet, token, faucet;
  let owner, user1, user2;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    Token = await ethers.getContractFactory("Token");
    token = await Token.deploy("Test Token", "TTK", parseUnits("1000"));
    await token.waitForDeployment();

    Faucet = await ethers.getContractFactory("TokenFaucet");
    faucet = await Faucet.deploy(token.target);
    await faucet.waitForDeployment();

    await token.setFaucet(faucet.target);
  });

  it("should allow a user to claim tokens once", async function () {
    const tx = await faucet.connect(user1).claimTokens();
    await expect(tx)
      .to.emit(faucet, "Claimed")
      .withArgs(user1.address, parseUnits("100"));

    const balance = await token.balanceOf(user1.address);
    expect(balance).to.equal(parseUnits("100"));

    const claimed = await faucet.hasClaimed(user1.address);
    expect(claimed).to.be.true;
  });

  it("should not allow a user to claim tokens twice", async function () {
    await faucet.connect(user1).claimTokens();
    await expect(faucet.connect(user1).claimTokens()).to.be.revertedWith("You have already claimed your tokens");
  });

  it("should allow different users to claim individually", async function () {
    await faucet.connect(user1).claimTokens();
    await faucet.connect(user2).claimTokens();

    const balance1 = await token.balanceOf(user1.address);
    const balance2 = await token.balanceOf(user2.address);

    expect(balance1).to.equal(parseUnits("100"));
    expect(balance2).to.equal(parseUnits("100"));
  });

  it("should revert if faucet has not been set in token", async function () {
    const token2 = await Token.deploy("Test Token", "TTK", parseUnits("1000"));
    const faucet2 = await Faucet.deploy(token2.target);

    await expect(faucet2.connect(user1).claimTokens()).to.be.revertedWith("Not authorized");
  });

  it("should revert constructor if token address is zero", async function () {
    const Faucet = await ethers.getContractFactory("TokenFaucet");
    await expect(Faucet.deploy(ethers.ZeroAddress)).to.be.revertedWith("Invalid token address");
  });
});
