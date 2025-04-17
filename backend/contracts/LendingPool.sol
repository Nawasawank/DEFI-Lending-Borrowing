// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IInterestRateModel {
    function getSupplyRate(uint256 utilization, address token) external view returns (uint256);
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
    mapping(address => bool) public allowedTokens;
    mapping(address => mapping(address => uint256)) public borrows;

    address[] public supportedTokens;
    

    mapping(address => uint256) public supplyCap;
    mapping(address => uint256) public borrowCap;
    mapping(address => uint256) public maxLTV;
    mapping(address => uint256) public liquidationThreshold;
    mapping(address => uint256) public liquidationPenalty;

    IInterestRateModel public interestModel;

    event Deposit(address indexed token, address indexed lender, uint256 amount);
    event Withdraw(address indexed token, address indexed lender, uint256 amount);
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

    function balanceOf(address token, address lender) external view returns (uint256) {
        TokenState storage t = tokenState[token];
        DepositInfo storage d = deposits[token][lender];
        if (t.totalShares == 0) return 0;

        return (d.shares * t.totalDeposits) / t.totalShares;
    }

    function getUserCollateral(address user) external view returns (
        address[] memory tokens,
        uint256[] memory balances
    ) {
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
        // Remove the token from supportedTokens
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
    function getUserBorrow(address user) external view returns (
        address[] memory tokens,
        uint256[] memory amounts
    ) {
        uint256 length = supportedTokens.length;
        tokens = new address[](length);
        amounts = new uint256[](length);

        for (uint256 i = 0; i < length; i++) {
            address token = supportedTokens[i];
            uint256 borrowed = borrows[token][user];

            tokens[i] = token;
            amounts[i] = borrowed;
        }
    }


}
