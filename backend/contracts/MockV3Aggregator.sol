// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MockV3Aggregator {
    uint8 public immutable decimals;
    int256 public answer;
    string public description;
    uint256 public updatedAt;

    constructor(uint8 _decimals, int256 _initialAnswer, string memory _description) {
        decimals = _decimals;
        answer = _initialAnswer;
        description = _description;
        updatedAt = block.timestamp;
    }

    function updateAnswer(int256 _newAnswer) public {
        require(_newAnswer >= 0, "Invalid price"); // Optional check
        answer = _newAnswer;
        updatedAt = block.timestamp;
    }

    function latestAnswer() public view returns (int256) {
        return answer;
    }

    function latestTimestamp() public view returns (uint256) {
        return updatedAt;
    }

    function latestRoundData() external view returns (
        uint80 roundId,
        int256 answer_,
        uint256 startedAt,
        uint256 updatedAt_,
        uint80 answeredInRound
    ) {
        return (0, answer, 0, updatedAt, 0);
    }
}
