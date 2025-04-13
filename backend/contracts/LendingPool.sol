// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IInterestRateModel {
    function getSupplyRate(uint256 utilization, address token) external view returns (uint256);
    // function getBorrowRate(uint256 utilization, address token) external view returns (uint256);
}

contract LendingPool is Ownable, ReentrancyGuard {
    struct DepositInfo {
        uint256 shares;
        uint256 lastUpdated;
    }

    struct TokenState {
        uint256 totalShares;
        uint256 totalDeposits;
        uint256 totalBorrows;
        uint256 interestIndex;
        uint256 lastAccrueTime;
    }
    
    mapping(address => TokenState) public tokenState;
    mapping(address => mapping(address => DepositInfo)) public deposits;
    mapping(address => mapping(address => uint256)) public borrows;

    mapping(address => bool) public allowedTokens;
    address[] public supportedTokens;

    mapping(address => uint256) public supplyCap;
    mapping(address => uint256) public borrowCap;
    mapping(address => uint256) public maxLTV;
    mapping(address => uint256) public liquidationThreshold;
    mapping(address => uint256) public liquidationPenalty;

    IInterestRateModel public interestModel;

    event Deposit(address indexed token, address indexed lender, uint256 amount);
    event Withdraw(address indexed token, address indexed lender, uint256 amount);
    event Borrow(address indexed token, address indexed borrower, uint256 amount);
    event Repay(address indexed token, address indexed borrower, uint256 amount);
    event AllowedTokenAdded(address token);
    event AllowedTokenRemoved(address token);
    event AssetConfigSet(address token, uint256 supplyCap, uint256 borrowCap, uint256 maxLTV, uint256 liquidationThreshold, uint256 liquidationPenalty);

    constructor(address[] memory _allowedTokens, address _interestModel) Ownable(msg.sender) {
        interestModel = IInterestRateModel(_interestModel);
        for (uint256 i = 0; i < _allowedTokens.length; i++) {
            allowedTokens[_allowedTokens[i]] = true;
            supportedTokens.push(_allowedTokens[i]);
            emit AllowedTokenAdded(_allowedTokens[i]);
        }
    }

    modifier onlyAllowed(address token) {
        require(allowedTokens[token], "Token not allowed");
        _;
    }

    function getUtilization(address token) public view returns (uint256) {
        TokenState storage t = tokenState[token];
        if (t.totalDeposits == 0) return 0;
        return (t.totalBorrows * 1e4) / t.totalDeposits;
    }

    function accrueInterest(address token) public {
        TokenState storage t = tokenState[token];
        uint256 elapsed = block.timestamp - t.lastAccrueTime;

        if (elapsed == 0 || t.totalDeposits == 0) return;

        uint256 utilization = getUtilization(token);
        uint256 supplyRate = interestModel.getSupplyRate(utilization, token);

        uint256 ratePerSecond = (supplyRate * 1e18) / (365 days * 1e4);
        uint256 interestEarned = (t.totalDeposits * ratePerSecond * elapsed) / 1e18;

        t.totalDeposits += interestEarned;
        t.lastAccrueTime = block.timestamp;
    }

    function deposit(address token, uint256 amount) external onlyAllowed(token) nonReentrant {
        require(amount > 0, "Amount must be greater than zero");

        accrueInterest(token);

        TokenState storage t = tokenState[token];
        require(t.totalDeposits + amount <= supplyCap[token], "Exceeds supply cap");
        require(IERC20(token).transferFrom(msg.sender, address(this), amount), "Transfer failed");

        uint256 shares = (t.totalShares == 0 || t.totalDeposits == 0)
            ? amount
            : (amount * t.totalShares) / t.totalDeposits;

        deposits[token][msg.sender].shares += shares;
        deposits[token][msg.sender].lastUpdated = block.timestamp;

        t.totalShares += shares;
        t.totalDeposits += amount;
        if (t.interestIndex == 0) t.interestIndex = 1e18;
        if (t.lastAccrueTime == 0) t.lastAccrueTime = block.timestamp;

        emit Deposit(token, msg.sender, amount);
    }

    function withdraw(address token, uint256 amount) external onlyAllowed(token) nonReentrant {
        require(amount > 0, "Amount must be greater than zero");

        accrueInterest(token);

        TokenState storage t = tokenState[token];
        DepositInfo storage user = deposits[token][msg.sender];

        uint256 userBalance = (user.shares * t.totalDeposits) / t.totalShares;
        require(userBalance >= amount, "Insufficient balance");

        uint256 shareAmount = (amount * t.totalShares) / t.totalDeposits;

        user.shares -= shareAmount;
        t.totalShares -= shareAmount;
        t.totalDeposits -= amount;

        require(IERC20(token).transfer(msg.sender, amount), "Transfer failed");

        emit Withdraw(token, msg.sender, amount);
    }

    function getHealthFactor(address user) external view returns (uint256 healthFactor) {
        uint256 totalCollateralValue = 0;
        uint256 totalBorrowValue = 0;

        for (uint256 i = 0; i < supportedTokens.length; i++) {
            address token = supportedTokens[i];
            TokenState storage t = tokenState[token];
            DepositInfo storage d = deposits[token][user];

            if (t.totalShares > 0) {
                uint256 userBalance = (d.shares * t.totalDeposits) / t.totalShares;
                totalCollateralValue += (userBalance * liquidationThreshold[token]) / 1e4;
            }

            totalBorrowValue += borrows[token][user];
        }

        if (totalBorrowValue == 0) {
            return type(uint256).max; // No borrows, health factor is infinite
        }

        healthFactor = (totalCollateralValue * 1e18) / totalBorrowValue;
    }
    function accrueBorrowInterest(address token) public {
        TokenState storage t = tokenState[token];
        uint256 elapsed = block.timestamp - t.lastAccrueTime;

        if (elapsed == 0 || t.totalBorrows == 0) return;

        uint256 utilization = getUtilization(token);
        // uint256 borrowRate = interestModel.getBorrowRate(utilization, token);
        uint256 borrowRate = interestModel.getSupplyRate(utilization, token); // Assuming borrow rate is derived similarly

        uint256 ratePerSecond = (borrowRate * 1e18) / (365 days * 1e4);
        uint256 interestAccrued = (t.totalBorrows * ratePerSecond * elapsed) / 1e18;

        t.totalBorrows += interestAccrued;
        t.lastAccrueTime = block.timestamp;
    }

    function repay(address token, uint256 amount) external onlyAllowed(token) nonReentrant {
        require(amount > 0, "Amount must be greater than zero");

        // Accrue interest for the borrower's debt
        accrueBorrowInterest(token);

        TokenState storage t = tokenState[token];
        uint256 owed = borrows[token][msg.sender];

        require(owed > 0, "Nothing to repay");

        // Calculate interest dynamically for the borrower's debt
        uint256 elapsed = block.timestamp - t.lastAccrueTime;
        if (elapsed > 0) {
            uint256 utilization = getUtilization(token);
            // uint256 borrowRate = interestModel.getBorrowRate(utilization, token);
            uint256 borrowRate = interestModel.getSupplyRate(utilization, token); // Assuming borrow rate is derived similarly
            uint256 ratePerSecond = (borrowRate * 1e18) / (365 days * 1e4);
            uint256 interestAccrued = (owed * ratePerSecond * elapsed) / 1e18;
            owed += interestAccrued;
        }

        uint256 repayAmount = amount > owed ? owed : amount;

        // Deduct repayment amount from the user's collateral
        DepositInfo storage userDeposit = deposits[token][msg.sender];
        uint256 userCollateral = (userDeposit.shares * t.totalDeposits) / t.totalShares;
        require(userCollateral >= repayAmount, "Insufficient collateral to repay");

        uint256 sharesToDeduct = (repayAmount * t.totalShares) / t.totalDeposits;
        userDeposit.shares -= sharesToDeduct;
        t.totalShares -= sharesToDeduct;
        t.totalDeposits -= repayAmount;

        // Update borrower's debt
        borrows[token][msg.sender] = owed - repayAmount;
        t.totalBorrows -= repayAmount;

        emit Repay(token, msg.sender, repayAmount);
    }
        

    function borrow(address token, uint256 amount) external onlyAllowed(token) nonReentrant {
        accrueBorrowInterest(token);

        TokenState storage t = tokenState[token];
        require(t.totalDeposits - t.totalBorrows >= amount, "Not enough liquidity");
        require(t.totalBorrows + amount <= borrowCap[token], "Exceeds borrow cap");

        uint256 totalCollateralValue = 0;
        for (uint256 i = 0; i < supportedTokens.length; i++) {
            address colToken = supportedTokens[i];
            TokenState storage colState = tokenState[colToken];
            DepositInfo storage colDeposit = deposits[colToken][msg.sender];

            if (colState.totalShares == 0) continue;

            uint256 balance = (colDeposit.shares * colState.totalDeposits) / colState.totalShares;
            totalCollateralValue += balance;
        }

        uint256 maxBorrow = (totalCollateralValue * maxLTV[token]) / 1e4;
        require(borrows[token][msg.sender] + amount <= maxBorrow, "Exceeds max LTV");

        // Check user's health factor
        uint256 healthFactor = this.getHealthFactor(msg.sender);
        require(healthFactor > 0, "Health factor too low to borrow");

        borrows[token][msg.sender] += amount;
        t.totalBorrows += amount;

        require(IERC20(token).transfer(msg.sender, amount), "Transfer failed");

        emit Borrow(token, msg.sender, amount);
    }


    function repayBalanceOf(address token, address borrower) external returns (uint256) {
        accrueBorrowInterest(token);

        uint256 owed = borrows[token][borrower];
        TokenState storage t = tokenState[token];

        if (owed > 0) {
            uint256 elapsed = block.timestamp - t.lastAccrueTime;
            uint256 utilization = getUtilization(token);
            // uint256 borrowRate = interestModel.getSupplyRate(utilization, token);
            uint256 borrowRate = interestModel.getSupplyRate(utilization, token); // Assuming borrow rate is derived similarly

            uint256 ratePerSecond = (borrowRate * 1e18) / (365 days * 1e4);
            uint256 interestAccrued = (owed * ratePerSecond * elapsed) / 1e18;

            owed += interestAccrued;

            // Update the borrower's debt with the accrued interest
            borrows[token][borrower] = owed;
        }

        return owed;
    }

    // function repayBalanceOf(address token, address borrower) external returns (uint256) {
    //    accrueBorrowInterest(token);

    //    TokenState storage t = tokenState[token];
    //    return borrows[token][borrower] > 0
    //        ? borrows[token][borrower] + ((borrows[token][borrower] * ((interestModel.getBorrowRate(getUtilization(token), token) * 1e18) / (365 days * 1e4)) * (block.timestamp - t.lastAccrueTime)) / 1e18)
    //        : 0;
    //}

    

    function balanceOf(address token, address lender) external returns (uint256) {
        accrueInterest(token);

        TokenState storage t = tokenState[token];
        DepositInfo storage d = deposits[token][lender];
        if (t.totalShares == 0) return 0;

        return (d.shares * t.totalDeposits) / t.totalShares;
    }

    function getUserCollateral(address user) external view returns (address[] memory tokens, uint256[] memory balances) {
        uint256 length = supportedTokens.length;
        tokens = new address[](length);
        balances = new uint256[](length);

        for (uint256 i = 0; i < length; i++) {
            address token = supportedTokens[i];
            DepositInfo storage d = deposits[token][user];
            TokenState storage t = tokenState[token];

            uint256 userBalance = (t.totalShares == 0)
                ? 0
                : (d.shares * t.totalDeposits) / t.totalShares;

            tokens[i] = token;
            balances[i] = userBalance;
        }
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

    function addAllowedToken(address token) external onlyOwner {
        allowedTokens[token] = true;
        supportedTokens.push(token);
        emit AllowedTokenAdded(token);
    }

    function removeAllowedToken(address token) external onlyOwner {
        allowedTokens[token] = false;
        for (uint256 i = 0; i < supportedTokens.length; i++) {
            if (supportedTokens[i] == token) {
                supportedTokens[i] = supportedTokens[supportedTokens.length - 1];
                supportedTokens.pop();
                break;
            }
        }
        emit AllowedTokenRemoved(token);
    }

    function getAvailableLiquidity(address token) external view returns (uint256) {
        TokenState storage t = tokenState[token];
        if (t.totalDeposits < t.totalBorrows) {
            return 0;
        }
        return t.totalDeposits - t.totalBorrows;
    }

    // function getTotalSupplied(address user) external view returns (uint256 totalSupplied) {
    //     totalSupplied = 0;
    //     for (uint256 i = 0; i < supportedTokens.length; i++) {
    //         address token = supportedTokens[i];
    //         TokenState storage t = tokenState[token];
    //         DepositInfo storage depositinfo = deposits[token][user];

    //         // Convert shares to actual balance
    //         uint256 userBalance = (depositinfo.shares * t.totalDeposits) / t.totalShares;
    //         totalSupplied += userBalance;
    //     }
    // }

    function getTotalSupplyAPY(address user) external view returns (uint256 totalAPY) {
        uint256 totalValue = 0;
        uint256 weightedAPY = 0;

        for (uint256 i = 0; i < supportedTokens.length; i++) {
            address token = supportedTokens[i];
            DepositInfo storage d = deposits[token][user];
            TokenState storage t = tokenState[token];

            if (t.totalShares == 0 || d.shares == 0 || t.totalDeposits == 0) continue;

            uint256 userBalance = (d.shares * t.totalDeposits) / t.totalShares;
            uint256 utilization = getUtilization(token);
            uint256 apy = interestModel.getSupplyRate(utilization, token);

            weightedAPY += userBalance * apy;
            totalValue += userBalance;
        }

        if (totalValue == 0) return 0;
        totalAPY = weightedAPY / totalValue;
    }

    function getUserBorrow(address user) external view returns (address[] memory tokens, uint256[] memory amounts) {
        uint256 length = supportedTokens.length;
        tokens = new address[](length);
        amounts = new uint256[](length);

        for (uint256 i = 0; i < length; i++) {
            address token = supportedTokens[i];
            tokens[i] = token;
            amounts[i] = borrows[token][user];
        }
    }
}

