// SPDX-License-Identifier: MIT
pragma solidity 0.8.35;

import '../../contracts/PredictorBridge.sol';

contract MockPredictorBridgeUpgrade is PredictorBridge {
  constructor(address feed, address pool, address sanctions, address prd, address usdc, address usdt, address weth) PredictorBridge(feed, pool, sanctions, prd, usdc, usdt, weth) {}

  function newFunction() external pure returns (string memory) {
    return 'PredictorBridge upgraded';
  }
}
