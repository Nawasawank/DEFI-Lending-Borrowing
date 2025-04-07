// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract LendingPool is Ownable {
    mapping(address => mapping(address => uint256)) public deposits;
    mapping(address => uint256) public totalDeposits;
    mapping(address => bool) public allowedTokens;

    event Deposit(address indexed token, address indexed lender, uint256 amount);
    event Withdraw(address indexed token, address indexed lender, uint256 amount);
    event AllowedTokenAdded(address token);
    event AllowedTokenRemoved(address token);

    constructor(address[] memory _allowedTokens) Ownable(msg.sender) {
        for (uint256 i = 0; i < _allowedTokens.length; i++) {
            allowedTokens[_allowedTokens[i]] = true;
            emit AllowedTokenAdded(_allowedTokens[i]);
        }
    }

    function addAllowedToken(address token) external onlyOwner {
        allowedTokens[token] = true;
        emit AllowedTokenAdded(token);
    }

    function removeAllowedToken(address token) external onlyOwner {
        allowedTokens[token] = false;
        emit AllowedTokenRemoved(token);
    }

    function deposit(address token, uint256 amount) external {
        require(allowedTokens[token], "Token not allowed");
        require(amount > 0, "Amount must be greater than zero");
        
        require(IERC20(token).transferFrom(msg.sender, address(this), amount), "Transfer failed");
        
        deposits[token][msg.sender] += amount;
        totalDeposits[token] += amount;
        
        emit Deposit(token, msg.sender, amount);
    }

    function withdraw(address token, uint256 amount) external {
        require(allowedTokens[token], "Token not allowed");
        require(amount > 0, "Amount must be greater than zero");
        require(deposits[token][msg.sender] >= amount, "Insufficient balance");

        deposits[token][msg.sender] -= amount;
        totalDeposits[token] -= amount;
        
        require(IERC20(token).transfer(msg.sender, amount), "Transfer failed");

        emit Withdraw(token, msg.sender, amount);
    }

    function balanceOf(address token, address lender) external view returns (uint256) {
        return deposits[token][lender];
    }
}
