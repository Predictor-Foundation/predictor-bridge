// SPDX-License-Identifier: MIT
pragma solidity 0.8.34;

import '../../contracts/interfaces/IUniswapV3Callback.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

contract MockUniswapV3Pool {
  address public immutable token0; // USDC
  address public immutable token1; // WETH

  int256 public nextAmount0Delta;
  int256 public nextAmount1Delta;
  uint256 public nextWethOut;
  bool public shouldRevert;

  constructor(address token0_, address token1_) {
    token0 = token0_;
    token1 = token1_;
  }

  function setSwapResult(int256 amount0Delta_, int256 amount1Delta_, uint256 wethOut_) external {
    nextAmount0Delta = amount0Delta_;
    nextAmount1Delta = amount1Delta_;
    nextWethOut = wethOut_;
  }

  function setShouldRevert(bool value) external {
    shouldRevert = value;
  }

  function swap(address recipient, bool, int256, uint160, bytes calldata data) external returns (int256 amount0, int256 amount1) {
    require(!shouldRevert, 'swap failed');

    IUniswapV3Callback(recipient).uniswapV3SwapCallback(nextAmount0Delta, nextAmount1Delta, data);

    if (nextWethOut != 0) {
      IERC20(token1).transfer(recipient, nextWethOut);
    }

    return (nextAmount0Delta, nextAmount1Delta);
  }
}
