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

    function getSupplyRate(address token, uint256 utilization) external view returns (uint256) {
        uint256 borrowRate = getBorrowRate(token, utilization);
        InterestParams memory p = params[token];
        return (borrowRate * utilization * (1e4 - p.reserveFactor)) / 1e8;
    }

}
