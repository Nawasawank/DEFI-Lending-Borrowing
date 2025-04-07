// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract LendingPool is Ownable {
    mapping(address => mapping(address => uint256)) public deposits;
    mapping(address => uint256) public totalDeposits;
    mapping(address => bool) public allowedTokens;

    // New mappings for asset config
    mapping(address => uint256) public supplyCap;
    mapping(address => uint256) public borrowCap;
    mapping(address => uint256) public maxLTV;
    mapping(address => uint256) public liquidationThreshold;
    mapping(address => uint256) public liquidationPenalty;

    // Events
    event Deposit(address indexed token, address indexed lender, uint256 amount);
    event Withdraw(address indexed token, address indexed lender, uint256 amount);
    event AllowedTokenAdded(address token);
    event AllowedTokenRemoved(address token);
    event AssetConfigSet(address token, uint256 supplyCap, uint256 borrowCap, uint256 maxLTV, uint256 liquidationThreshold, uint256 liquidationPenalty);

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

    function setAssetConfig(
        address token,
        uint256 _supplyCap,
        uint256 _borrowCap,
        uint256 _maxLTV,
        uint256 _liquidationThreshold,
        uint256 _liquidationPenalty
    ) external onlyOwner {
        require(token != address(0), "Invalid token");
        require(_maxLTV <= _liquidationThreshold, "LTV must be <= threshold");

        supplyCap[token] = _supplyCap;
        borrowCap[token] = _borrowCap;
        maxLTV[token] = _maxLTV;
        liquidationThreshold[token] = _liquidationThreshold;
        liquidationPenalty[token] = _liquidationPenalty;

        emit AssetConfigSet(token, _supplyCap, _borrowCap, _maxLTV, _liquidationThreshold, _liquidationPenalty);
    }

    function deposit(address token, uint256 amount) external {
        require(allowedTokens[token], "Token not allowed");
        require(amount > 0, "Amount must be greater than zero");
        require(totalDeposits[token] + amount <= supplyCap[token], "Exceeds supply cap");

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
