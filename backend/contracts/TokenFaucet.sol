// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./Token.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract TokenFaucet is ReentrancyGuard {
    Token public immutable token;

    mapping(address => bool) public hasClaimed;

    event Claimed(address indexed user, uint256 amount);

    constructor(address tokenAddress) {
        require(tokenAddress != address(0), "Invalid token address");
        token = Token(tokenAddress);
    }

    function claimTokens() external nonReentrant {
        require(!hasClaimed[msg.sender], "You have already claimed your tokens");

        hasClaimed[msg.sender] = true; 

        uint256 amount = 100 ether;
        token.mint(msg.sender, amount);

        emit Claimed(msg.sender, amount);
    }
}
