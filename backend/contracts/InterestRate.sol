// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract InterestRateModel {
    struct InterestParams {
        uint256 baseRate;
        uint256 slope1;
        uint256 slope2;
        uint256 kink;
        uint256 reserveFactor;
    }

    mapping(address => InterestParams) public params;

    function setParams(
        address token,
        uint256 baseRate,
        uint256 slope1,
        uint256 slope2,
        uint256 kink,
        uint256 reserveFactor
    ) external {
        params[token] = InterestParams(baseRate, slope1, slope2, kink, reserveFactor);
    }

    function getBorrowRate(address token, uint256 utilization) public view returns (uint256) {
        InterestParams memory p = params[token];
        if (utilization <= p.kink) {
            return p.baseRate + (p.slope1 * utilization) / 1e4;
        } else {
            return p.baseRate + (p.slope1 * p.kink) / 1e4 + (p.slope2 * (utilization - p.kink)) / 1e4;
        }
    }

    function getSupplyRate(uint256 utilization, address token) public view returns (uint256) {
        uint256 borrowRate = getBorrowRate(token, utilization);
        InterestParams memory p = params[token];

        return (borrowRate * utilization * (1e4 - p.reserveFactor)) / 1e8;
    }

    function getSupplyAPY(address token, uint256 utilization) public view returns (uint256) {
        uint256 apr = getSupplyRate(utilization, token);
        uint256 aprScaled = apr * 1e14;

        uint256 apy = computeAPY(aprScaled);
        return apy;
    }

    function getBorrowAPY(address token, uint256 utilization) public view returns (uint256) {
        uint256 apr = getBorrowRate(token, utilization);
        uint256 aprScaled = apr * 1e14;

        uint256 apy = computeAPY(aprScaled);
        return apy;
    }

    function computeAPY(uint256 aprScaled) internal pure returns (uint256) {
        uint256 n = 365;
        uint256 aprPerPeriod = aprScaled / n;

        uint256 base = 1e18 + aprPerPeriod;
        uint256 result = 1e18;

        while (n > 0) {
            if (n % 2 == 1) {
                result = mulDiv(result, base, 1e18);
            }
            base = mulDiv(base, base, 1e18);
            n /= 2;
        }

        uint256 apyScaled = result - 1e18;
        uint256 apy = apyScaled / 1e14;
        return apy;
    }

    function mulDiv(uint256 a, uint256 b, uint256 denominator) internal pure returns (uint256) {
        return (a * b) / denominator;
    }
}
