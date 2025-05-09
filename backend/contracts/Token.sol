// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Token is ERC20, Ownable {
    address public faucet;

    event FaucetUpdated(address indexed newFaucet);

    constructor(
        string memory name_,
        string memory symbol_,
        uint256 initialSupply
    ) ERC20(name_, symbol_) Ownable(msg.sender) {
        _mint(msg.sender, initialSupply);
    }

    modifier onlyFaucet() {
        require(msg.sender == faucet, "Not authorized");
        _;
    }

    function setFaucet(address _faucet) external onlyOwner {
        require(_faucet != address(0), "Faucet cannot be zero address");
        faucet = _faucet;
        emit FaucetUpdated(_faucet);
    }

    function mint(address to, uint256 amount) external onlyFaucet {
        _mint(to, amount);
    }
}
