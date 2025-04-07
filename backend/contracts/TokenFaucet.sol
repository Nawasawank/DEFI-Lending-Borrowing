// SPDX-License-Identifier: MIT 
pragma solidity ^0.8.20;

import "./Token.sol";

contract TokenFaucet {
    Token public token;

    mapping(address => bool) public hasClaimed;

    constructor(address tokenAddress) {
        token = Token(tokenAddress);
    }

    function claimTokens() external {
        require(!hasClaimed[msg.sender], "You have already claimed your tokens");

        uint256 amount = 100 ether;
        token.mint(msg.sender, amount);
        hasClaimed[msg.sender] = true;
    }
}
