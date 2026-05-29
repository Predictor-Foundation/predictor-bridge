// SPDX-License-Identifier: MIT
pragma solidity 0.8.35;

interface IBridge {
  function relayerLift(
    uint256 gasCost,
    uint256 amount,
    address user,
    uint8 v,
    bytes32 r,
    bytes32 s,
    bool triggerRefund
  ) external;
}

contract MockETHRejectingRelayer {
  receive() external payable {
    revert("NO_ETH");
  }

  function relayerLift(
    address bridge,
    uint256 gasCost,
    uint256 amount,
    address user,
    uint8 v,
    bytes32 r,
    bytes32 s,
    bool triggerRefund
  ) external {
    IBridge(bridge).relayerLift(
      gasCost,
      amount,
      user,
      v,
      r,
      s,
      triggerRefund
    );
  }
}