const { expect } = require("chai");
const { ethers } = require("hardhat");

const parseUnits = (val, decimals = 18) =>
  ethers.utils?.parseUnits?.(val.toString(), decimals) || ethers.parseUnits(val.toString(), decimals);

describe("Token", function () {
  let Token, token, owner, faucet, user;

  beforeEach(async function () {
    [owner, faucet, user] = await ethers.getSigners();

    Token = await ethers.getContractFactory("Token");
    token = await Token.deploy("MyToken", "MTK", parseUnits("1000", 18));
    await token.waitForDeployment();
  });

  it("should set the correct name and symbol", async function () {
    expect(await token.name()).to.equal("MyToken");
    expect(await token.symbol()).to.equal("MTK");
  });

  it("should mint initial supply to owner", async function () {
    const ownerBalance = await token.balanceOf(owner.address);
    expect(ownerBalance).to.equal(parseUnits("1000", 18));
  });

    it("should allow only owner to set faucet", async function () {
    await expect(token.connect(user).setFaucet(faucet.address))
        .to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount")
        .withArgs(user.address);

    await token.setFaucet(faucet.address);
    expect(await token.faucet()).to.equal(faucet.address);
    });


  it("should allow faucet to mint tokens", async function () {
    await token.setFaucet(faucet.address);
    await token.connect(faucet).mint(user.address, parseUnits("10", 18));

    const userBalance = await token.balanceOf(user.address);
    expect(userBalance).to.equal(parseUnits("10", 18));
  });

  it("should not allow non-faucet to mint tokens", async function () {
    await token.setFaucet(faucet.address);
    await expect(token.connect(user).mint(user.address, parseUnits("10", 18))).to.be.revertedWith("Not authorized");
  });
});