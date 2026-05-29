// SPDX-License-Identifier: MIT
pragma solidity 0.8.35;

interface IChainlinkV3Aggregator {
  function latestAnswer() external view returns (int256 answer);
}
