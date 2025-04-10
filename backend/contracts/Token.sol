// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Token is ERC20, Ownable {
    address public faucet;

    constructor(
        string memory name,
        string memory symbol,
        uint256 initialSupply
    ) ERC20(name, symbol) Ownable(msg.sender) {
        _mint(msg.sender, initialSupply);
    }

    modifier onlyFaucet() {
        require(msg.sender == faucet, "Not authorized");
        _;
    }

    function setFaucet(address _faucet) external onlyOwner {
        faucet = _faucet;
    }

    function mint(address to, uint256 amount) external onlyFaucet {
        _mint(to, amount);
    }
}
