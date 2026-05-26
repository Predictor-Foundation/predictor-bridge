// SPDX-License-Identifier: MIT
pragma solidity 0.8.34;

import '../../contracts/PredictorBridge.sol';

contract MockPredictorBridgeUpgrade is PredictorBridge {
  constructor(address feed, address pool, address sanctions, address usdc, address usdt, address weth) PredictorBridge(feed, pool, sanctions, usdc, usdt, weth) {}

  function newFunction() external pure returns (string memory) {
    return 'PredictorBridge upgraded';
  }
}
