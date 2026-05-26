// SPDX-License-Identifier: MIT
pragma solidity 0.8.34;

import '@openzeppelin/contracts/interfaces/IERC20.sol';

interface IWETH9 is IERC20 {
  function deposit() external payable;
  function withdraw(uint256 amount) external;
}
