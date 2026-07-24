// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import '../../contracts/PRDCTRBridge.sol';

contract MockPRDCTRBridgeUpgrade is PRDCTRBridge {
  constructor(address feed, address pool, address sanctions, address prd, address usdc, address usdt, address weth) PRDCTRBridge(feed, pool, sanctions, prd, usdc, usdt, weth) {}

  function newFunction() external pure returns (string memory) {
    return 'PRDCTRBridge upgraded';
  }
}
