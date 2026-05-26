// SPDX-License-Identifier: MIT
pragma solidity 0.8.34;

contract MockChainlinkV3Aggregator {
  int256 private answer;

  function setLatestAnswer(int256 value) external {
    answer = value;
  }

  function latestAnswer() external view returns (int256) {
    return answer;
  }
}
