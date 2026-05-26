// SPDX-License-Identifier: MIT
pragma solidity 0.8.34;

interface IUniswapV3Callback {
  function uniswapV3SwapCallback(int256 amount0Delta, int256 amount1Delta, bytes calldata data) external;
}
