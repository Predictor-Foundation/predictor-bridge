// SPDX-License-Identifier: MIT
pragma solidity 0.8.34;

contract MockChainalysis {
  mapping(address => bool) public sanctioned;

  function setSanctioned(address account, bool value) external {
    sanctioned[account] = value;
  }

  function isSanctioned(address account) external view returns (bool) {
    return sanctioned[account];
  }
}
