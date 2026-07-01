// SPDX-License-Identifier: MIT
pragma solidity 0.8.35;

contract MockChainlinkV3Aggregator {
  uint80 private roundId = 1;
  int256 private answer;
  uint256 private startedAt;
  uint256 private updatedAt;
  uint80 private answeredInRound = 1;

  function setLatestAnswer(int256 value) external {
    answer = value;
    startedAt = block.timestamp;
    updatedAt = block.timestamp;
    answeredInRound = roundId;
  }

  function setLatestRoundData(
    uint80 roundId_,
    int256 answer_,
    uint256 startedAt_,
    uint256 updatedAt_,
    uint80 answeredInRound_
  ) external {
    roundId = roundId_;
    answer = answer_;
    startedAt = startedAt_;
    updatedAt = updatedAt_;
    answeredInRound = answeredInRound_;
  }

  function latestRoundData()
    external
    view
    returns (uint80, int256, uint256, uint256, uint80)
  {
    return (roundId, answer, startedAt, updatedAt, answeredInRound);
  }
}