// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IInterestRateModel {
    function getSupplyRate(uint256 utilization, address token) external view returns (uint256);
    function getBorrowRate(address token,uint256 utilization) external view returns (uint256);
}

contract LendingPool is Ownable, ReentrancyGuard {
    struct DepositInfo {
        uint256 shares;
        uint256 lastUpdated;
    }
    struct TokenState {
        uint256 totalShares;
        uint256 totalBorrowShares;
        uint256 totalDeposits;
        uint256 totalBorrows;
        uint256 interestIndex;
        uint256 lastAccrueTime;
    }
    
    mapping(address => TokenState) public tokenState;
    mapping(address => mapping(address => DepositInfo)) public deposits;
    mapping(address => mapping(address => uint256)) public lastBorrowUpdate;
    mapping(address => mapping(address => uint256)) public userBorrowIndex;
    mapping(address => mapping(address => uint256)) public borrowShares;

    mapping(address => bool) public allowedTokens;
    address[] public supportedTokens;

    mapping(address => uint256) public supplyCap;
    mapping(address => uint256) public borrowCap;
    mapping(address => uint256) public maxLTV;
    mapping(address => uint256) public liquidationThreshold;
    mapping(address => uint256) public liquidationPenalty;

    IInterestRateModel public immutable interestModel;
    address public liquidationContract;

    modifier onlyLiquidation() {
        require(msg.sender == liquidationContract, "Not authorized");
        _;
    }

    event Deposit(address indexed token, address indexed lender, uint256 amount);
    event Withdraw(address indexed token, address indexed lender, uint256 amount);
    event Borrow(address indexed token, address indexed borrower, uint256 amount);
    event Repay(address indexed token, address indexed borrower, uint256 amount);
    event AllowedTokenAdded(address token);
    event AllowedTokenRemoved(address token);
    event AssetConfigSet(address token, uint256 supplyCap, uint256 borrowCap, uint256 maxLTV, uint256 liquidationThreshold, uint256 liquidationPenalty);

    constructor(address[] memory _allowedTokens, address _interestModel) Ownable(msg.sender) {
        require(_interestModel != address(0), "Invalid interest model");
        interestModel = IInterestRateModel(_interestModel);
        liquidationContract = liquidationContract;
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

        if (elapsed < 1 || t.totalDeposits == 0) return;

        uint256 rate = interestModel.getSupplyRate(getUtilization(token), token);

        uint256 interest = (t.totalDeposits * rate * elapsed) / (365 days * 1e4);

        t.totalDeposits += interest;
        t.lastAccrueTime = block.timestamp;
    }


    function deposit(address token, uint256 amount) external onlyAllowed(token) nonReentrant {
        require(amount > 0, "Amount must be > 0");
        accrueInterest(token);
        TokenState storage t = tokenState[token];
        require(t.totalDeposits + amount <= supplyCap[token], "Exceeds cap");

        uint256 shares = (t.totalShares == 0) ? amount : (amount * t.totalShares) / t.totalDeposits;
        deposits[token][msg.sender].shares += shares;
        deposits[token][msg.sender].lastUpdated = block.timestamp;
        t.totalShares += shares;
        t.totalDeposits += amount;

        require(IERC20(token).transferFrom(msg.sender, address(this), amount), "Transfer failed");
        emit Deposit(token, msg.sender, amount);
    }

    function withdraw(address token, uint256 amount) external onlyAllowed(token) nonReentrant {
        require(amount > 0, "Amount must be > 0");
        accrueInterest(token);
        TokenState storage t = tokenState[token];
        DepositInfo storage d = deposits[token][msg.sender];

        uint256 userBalance = (d.shares * t.totalDeposits) / t.totalShares;
        require(userBalance >= amount, "Insufficient balance");
        uint256 sharesToBurn = (amount * t.totalShares) / t.totalDeposits;

        d.shares -= sharesToBurn;
        t.totalShares -= sharesToBurn;
        t.totalDeposits -= amount;

        require(IERC20(token).transfer(msg.sender, amount), "Transfer failed");
        emit Withdraw(token, msg.sender, amount);
    }

    function getHealthFactor(address user, uint256[] memory tokenPricesUSD) external view returns (uint256 healthFactor) {
        uint256 totalCollateralValue = 0;
        uint256 totalBorrowValue = 0;

        require(tokenPricesUSD.length == supportedTokens.length, "Invalid token prices length");
        uint256 len = supportedTokens.length;

        for (uint256 i = 0; i < len; i++) {
            address token = supportedTokens[i];
            TokenState storage t = tokenState[token];
            DepositInfo storage d = deposits[token][user];
            uint256 price = tokenPricesUSD[i];

            if (t.totalShares > 0 && d.shares > 0) {
                uint256 collateralValue = d.shares * t.totalDeposits * price * liquidationThreshold[token];
                uint256 adjustedCollateral = collateralValue / (t.totalShares * 1e22);
                totalCollateralValue += adjustedCollateral;
            }

            uint256 userBorrowShares = borrowShares[token][user];
            if (userBorrowShares > 0 && t.totalBorrowShares > 0) {
                uint256 totalBorrows = t.totalBorrows;
                uint256 elapsed = block.timestamp - t.lastAccrueTime;

                if (elapsed > 0 && totalBorrows > 0) {
                    uint256 utilization = getUtilization(token);
                    uint256 borrowRate = interestModel.getBorrowRate(token, utilization);

                    // Combine numerator before dividing to avoid precision loss
                    uint256 scaled = borrowRate * elapsed * totalBorrows;
                    totalBorrows += scaled / (365 days * 1e4); // 1e4 = rate scale (bps)
                }

                uint256 scaledDebt = userBorrowShares * totalBorrows * price;
                uint256 debtValue = scaledDebt / (t.totalBorrowShares * 1e18);
                totalBorrowValue += debtValue;
            }
        }

        if (totalBorrowValue == 0) {
            return type(uint256).max;
        }

        healthFactor = (totalCollateralValue * 1e17) / totalBorrowValue;
    }

    function accrueBorrowInterest(address token) public {
        TokenState storage t = tokenState[token];
        uint256 elapsed = block.timestamp - t.lastAccrueTime;

        if (elapsed < 1 || t.totalDeposits == 0) return;

        uint256 utilization = getUtilization(token);
        uint256 rate = interestModel.getBorrowRate(token, utilization);

        uint256 numerator = rate * elapsed * t.totalBorrows;
        uint256 interest = numerator / (365 days * 1e4);

        t.totalBorrows += interest;

        uint256 indexNumerator = rate * elapsed * t.interestIndex;
        uint256 indexIncrease = indexNumerator / (365 days * 1e4);
        t.interestIndex += indexIncrease;

        t.lastAccrueTime = block.timestamp;
    }

    function repay(address token, uint256 amount) external onlyAllowed(token) nonReentrant {
        require(amount > 0, "Amount must be > 0");
        accrueBorrowInterest(token);
        TokenState storage t = tokenState[token];
        uint256 shares = borrowShares[token][msg.sender];
        require(shares > 0, "Nothing to repay");

        uint256 debt = (shares * t.totalBorrows) / t.totalBorrowShares;
        uint256 repayAmt = amount > debt ? debt : amount;
        uint256 repayShares = (repayAmt * t.totalBorrowShares) / t.totalBorrows;

        borrowShares[token][msg.sender] -= repayShares;
        t.totalBorrowShares -= repayShares;
        t.totalBorrows -= repayAmt;

        require(IERC20(token).transferFrom(msg.sender, address(this), repayAmt), "Transfer failed");
        emit Repay(token, msg.sender, repayAmt);
    }

function borrow(address token, uint256 amount, uint256[] memory tokenPricesUSD) external onlyAllowed(token) nonReentrant {
        require(amount > 0, "Amount must be greater than zero");

        accrueBorrowInterest(token);

        TokenState storage t = tokenState[token];
        require(t.totalDeposits - t.totalBorrows >= amount, "Not enough liquidity");
        require(t.totalBorrows + amount <= borrowCap[token], "Exceeds borrow cap");
        require(tokenPricesUSD.length == supportedTokens.length, "Invalid token prices length");

        uint256 totalBorrowableValue = 0;
        uint256 len = supportedTokens.length;
        for (uint256 i = 0; i < len; i++) {
            address colToken = supportedTokens[i];
            TokenState storage colState = tokenState[colToken];
            DepositInfo storage colDeposit = deposits[colToken][msg.sender];

            if (colState.totalShares == 0 || colDeposit.shares == 0) continue;

            uint256 balance = (colDeposit.shares * colState.totalDeposits) / colState.totalShares;
            uint256 collateralValueUSD = (balance * tokenPricesUSD[i]) / 1e18;
            uint256 borrowable = (collateralValueUSD * maxLTV[colToken]) / 1e4;

            totalBorrowableValue += borrowable;
        }

        uint256 borrowTokenIndex = 0;
        for (uint256 i = 0; i < len; i++) {
            if (supportedTokens[i] == token) {
                borrowTokenIndex = i;
                break;
            }
        }

        uint256 borrowTokenPriceUSD = tokenPricesUSD[borrowTokenIndex];
        uint256 borrowValueUSD = (amount * borrowTokenPriceUSD) / 1e18;
        require(borrowValueUSD <= totalBorrowableValue, "Exceeds collateral-based limit");

        uint256 healthFactor = this.getHealthFactor(msg.sender, tokenPricesUSD);
        require(healthFactor > 0, "Health factor too low");

        uint256 shares = (t.totalBorrowShares == 0 || t.totalBorrows == 0)
            ? amount
            : (amount * t.totalBorrowShares) / t.totalBorrows;

        borrowShares[token][msg.sender] += shares;
        t.totalBorrowShares += shares;
        t.totalBorrows += amount;

        require(IERC20(token).transfer(msg.sender, amount), "Transfer failed");

        emit Borrow(token, msg.sender, amount);
    }

    function repayBalanceOf(address token, address borrower) public view returns (uint256) {
        TokenState storage t = tokenState[token];
        uint256 userShares = borrowShares[token][borrower];

        if (userShares == 0 || t.totalBorrowShares == 0) return 0;

        return (userShares * t.totalBorrows) / t.totalBorrowShares;
    }

    function balanceOf(address token, address lender) external view returns (uint256) {
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
        uint256 supplyCap_,
        uint256 borrowCap_,
        uint256 maxLtv,
        uint256 liquidationThreshold_,
        uint256 liquidationPenalty_
    ) external onlyOwner {
        require(token != address(0), "Invalid token");
        require(maxLtv <= liquidationThreshold_, "LTV must be <= threshold");
        require(liquidationPenalty_ <= 2000, "Penalty too high (max 20%)");

        supplyCap[token] = supplyCap_;
        borrowCap[token] = borrowCap_;
        maxLTV[token] = maxLtv;
        liquidationThreshold[token] = liquidationThreshold_;
        liquidationPenalty[token] = liquidationPenalty_;

        emit AssetConfigSet(token, supplyCap_, borrowCap_, maxLtv, liquidationThreshold_, liquidationPenalty_);
    }

    function addAllowedToken(address token) external onlyOwner {
        require(token != address(0), "Invalid token");
        allowedTokens[token] = true;
        supportedTokens.push(token);

        TokenState storage t = tokenState[token];
        if (t.lastAccrueTime == 0) {
            t.lastAccrueTime = block.timestamp;
        }
        supplyCap[token] = type(uint256).max;
        borrowCap[token] = type(uint256).max;
        maxLTV[token] = 5000;         
        liquidationThreshold[token] = 6000; 
        liquidationPenalty[token] = 1000;  

        emit AllowedTokenAdded(token);
        emit AssetConfigSet(token, type(uint256).max, type(uint256).max, 5000, 6000, 1000);
    }

    function getAvailableLiquidity(address token) external view returns (uint256) {
        TokenState storage t = tokenState[token];
        if (t.totalDeposits < t.totalBorrows) {
            return 0;
        }
        return t.totalDeposits - t.totalBorrows;
    }

    function getTotalSupplyAPY(address user) external view returns (uint256 totalAPY) {
        uint256 totalValue = 0;
        uint256 weightedAPY = 0;

        uint256 len = supportedTokens.length;
        for (uint256 i = 0; i < len; i++) {
            address token = supportedTokens[i];
            DepositInfo storage d = deposits[token][user];
            TokenState storage t = tokenState[token];

            if (t.totalShares == 0 || d.shares == 0 || t.totalDeposits == 0) continue;

            uint256 utilization = getUtilization(token);
            uint256 apy = interestModel.getSupplyRate(utilization, token);

            uint256 weightedNumerator = d.shares * t.totalDeposits * apy;
            uint256 valueNumerator = d.shares * t.totalDeposits;

            weightedAPY += weightedNumerator / t.totalShares;
            totalValue += valueNumerator / t.totalShares;
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
            TokenState storage t = tokenState[token];
            uint256 shares = borrowShares[token][user];
            amounts[i] = (t.totalBorrowShares == 0) ? 0 : (shares * t.totalBorrows) / t.totalBorrowShares;
            tokens[i] = token;
        }
    }

    function getLiquidationParams(address token) external view returns (
        uint256 penalty,
        uint256 threshold,
        uint256 ltv
    ) {
        return (
            liquidationPenalty[token],
            liquidationThreshold[token],
            maxLTV[token]
        );
    }

    function approveLiquidation(address token, address liquidator, uint256 amount) external onlyOwner {
        require(allowedTokens[token], "Token not allowed");
        require(liquidator != address(0), "Invalid liquidator address");
        require(amount > 0, "Amount must be greater than zero");

        require(IERC20(token).approve(liquidator, amount), "Approval failed");

    }

    function getSupportedTokens() external view returns (address[] memory) {
        return supportedTokens;
    }

    function previewHealthFactorAfterBorrow(
        address user,
        address token,
        uint256 borrowAmount,
        uint256[] memory tokenPricesUSD
    ) external view returns (uint256 healthFactor) {
        uint256 totalCollateralValue = 0;
        uint256 totalBorrowValue = 0;

        require(tokenPricesUSD.length == supportedTokens.length, "Invalid token prices length");

        uint256 len = supportedTokens.length;
        for (uint256 i = 0; i < len; i++) {
            address colToken = supportedTokens[i];
            TokenState storage t = tokenState[colToken];
            DepositInfo storage d = deposits[colToken][user];
            uint256 price = tokenPricesUSD[i];

            if (t.totalShares > 0 && d.shares > 0) {
                uint256 userBalance = (d.shares * t.totalDeposits) / t.totalShares;
                uint256 collateralValue = (userBalance * price) / 1e18;
                uint256 adjustedCollateralValue = (collateralValue * liquidationThreshold[colToken]) / 1e4;
                totalCollateralValue += adjustedCollateralValue;
            }

            uint256 userBorrowShares = borrowShares[colToken][user];
            if (userBorrowShares > 0 && t.totalBorrowShares > 0) {
                uint256 userDebt = (userBorrowShares * t.totalBorrows) / t.totalBorrowShares;
                totalBorrowValue += (userDebt * price) / 1e18;
            }
        }

        uint256 borrowTokenIndex = 0;
        for (uint256 i = 0; i < len; i++) {
            if (supportedTokens[i] == token) {
                borrowTokenIndex = i;
                break;
            }
        }

        uint256 borrowTokenPriceUSD = tokenPricesUSD[borrowTokenIndex];
        uint256 borrowValueUSD = (borrowAmount * borrowTokenPriceUSD) / 1e18;
        totalBorrowValue += borrowValueUSD;

        if (totalBorrowValue == 0) {
            return type(uint256).max; // No borrows, health factor is infinite
        }

        healthFactor = (totalCollateralValue * 1e17) / totalBorrowValue;
    }

    function previewHealthFactorAfterRepay(
        address user,
        address token,
        uint256 repayAmount,
        uint256[] memory tokenPricesUSD
    ) external view returns (uint256 healthFactor) {
        uint256 totalCollateralValue = 0;
        uint256 totalBorrowValue = 0;

        require(tokenPricesUSD.length == supportedTokens.length, "Invalid token prices length");

        uint256 len = supportedTokens.length;
        for (uint256 i = 0; i < len; i++) {
            address colToken = supportedTokens[i];
            TokenState storage t = tokenState[colToken];
            DepositInfo storage d = deposits[colToken][user];
            uint256 price = tokenPricesUSD[i];

            if (t.totalShares > 0 && d.shares > 0) {
                uint256 userBalance = (d.shares * t.totalDeposits) / t.totalShares;
                uint256 collateralValue = (userBalance * price) / 1e18;
                uint256 adjustedCollateralValue = (collateralValue * liquidationThreshold[colToken]) / 1e4;
                totalCollateralValue += adjustedCollateralValue;
            }

            uint256 userBorrowShares = borrowShares[colToken][user];
            if (userBorrowShares > 0 && t.totalBorrowShares > 0) {
                uint256 userDebt = (userBorrowShares * t.totalBorrows) / t.totalBorrowShares;
                
                if (colToken == token) {
                    uint256 actualRepayAmount = repayAmount > userDebt ? userDebt : repayAmount;
                    userDebt = userDebt - actualRepayAmount;
                }
                
                totalBorrowValue += (userDebt * price) / 1e18;
            }
        }

        if (totalBorrowValue == 0) {
            return 1e36; 
        }
        healthFactor = (totalCollateralValue * 1e17) / totalBorrowValue;
    }

        function setLiquidationContract(address _liquidationContract) external onlyOwner {
        require(_liquidationContract != address(0), "Invalid address");
        liquidationContract = _liquidationContract;
    }

    function seizeCollateral(address token, address to, uint256 amount) external onlyLiquidation {
        require(allowedTokens[token], "Invalid token");
        require(IERC20(token).transfer(to, amount), "Transfer failed");
    }


}

