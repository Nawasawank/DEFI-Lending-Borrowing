// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

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
        uint256 apr = this.getSupplyRate(utilization, token);
        uint256 aprScaled = apr * 1e14;
        
        uint256 n = 365;
        uint256 aprPerPeriod = aprScaled / n;
        
        uint256 base = 1e18 + aprPerPeriod; 
        uint256 result = 1e18; 
        uint256 exponent = n;
        
        while (exponent > 0) {
            if (exponent % 2 == 1) {
                result = (result * base) / 1e18;
            }
            base = (base * base) / 1e18;
            exponent /= 2;
        }
        
        uint256 apyScaled = result - 1e18;
        uint256 apy = apyScaled / 1e14;
        
        return apy;
    }

}
