// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

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
        address collateralToken
    ) external {
        require(repayAmount > 0, "Repay amount must be positive");
        emit Debug("Step 1: Repay amount is valid", repayAmount);
        
        lendingPool.accrueBorrowInterest(repayToken);
        lendingPool.accrueInterest(collateralToken);
        emit Debug("Step 2: Interest accrued", 0);
        
        require(lendingPool.getHealthFactor(user) < 1e18, "Healthy position");
        emit Debug("Step 3: Health factor is valid", 0);
        
        require(lendingPool.allowedTokens(repayToken), "Invalid repay token");
        require(lendingPool.allowedTokens(collateralToken), "Invalid collateral token");
        emit Debug("Step 4: Tokens are valid", 0);
        
        (uint256 penalty,,) = lendingPool.getLiquidationParams(collateralToken);
        require(penalty <= 2000, "Excessive penalty");
        emit Debug("Step 5: Penalty is valid", penalty);
        
        uint256 collateralSeized = (repayAmount * (1e18 + penalty * 1e14)) / 1e18;
        emit Debug("Step 6: Collateral seized calculated", collateralSeized);
        
        IERC20(repayToken).transferFrom(msg.sender, address(lendingPool), repayAmount);
        emit Debug("Step 7: Repay token transferred", repayAmount);
        
        IERC20(collateralToken).transferFrom(address(lendingPool), msg.sender, collateralSeized);
        emit Debug("Step 8: Collateral token transferred", collateralSeized);
        
        emit LiquidationExecuted(user, msg.sender, collateralToken, repayAmount, collateralSeized);
    }
}