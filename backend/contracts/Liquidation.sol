// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "hardhat/console.sol";
import "./LendingPool.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Liquidation {
    LendingPool public lendingPool;

    constructor(address _lendingPool) {
        lendingPool = LendingPool(_lendingPool);
    }

    event LiquidationExecuted(
        address indexed user,
        address indexed liquidator,
        address indexed collateralToken,
        uint256 debtRepaid,
        uint256 collateralSeized
    );

    event Debug(string message, uint256 value);
    
    function liquidate(
        address user, 
        address repayToken, 
        uint256 repayAmount,
        address collateralToken,
        uint256[] memory tokenPricesUSD
    ) external {
        require(repayAmount > 0, "Repay amount must be positive");
        
        lendingPool.accrueBorrowInterest(repayToken);
        lendingPool.accrueInterest(collateralToken);
        
        require(lendingPool.getHealthFactor(user, tokenPricesUSD) < 1e18, "Healthy position");
        
        require(lendingPool.allowedTokens(repayToken), "Invalid repay token");
        require(lendingPool.allowedTokens(collateralToken), "Invalid collateral token");
        
        (uint256 penalty,,) = lendingPool.getLiquidationParams(collateralToken);
        require(penalty <= 2000, "Excessive penalty");
        
        uint256 collateralSeized = (repayAmount * (1e18 + penalty * 1e14)) / 1e18;
        
        IERC20(repayToken).transferFrom(msg.sender, address(lendingPool), repayAmount);
        
        IERC20(collateralToken).transferFrom(address(lendingPool), msg.sender, collateralSeized);
        
        emit LiquidationExecuted(user, msg.sender, collateralToken, repayAmount, collateralSeized);
    }
}