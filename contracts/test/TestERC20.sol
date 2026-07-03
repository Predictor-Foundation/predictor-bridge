// SPDX-License-Identifier: MIT
pragma solidity 0.8.35;

import '@openzeppelin/contracts/access/Ownable2Step.sol';
import '@openzeppelin/contracts/token/ERC20/ERC20.sol';

contract TestERC20 is ERC20, Ownable2Step {
  uint8 private immutable tokenDecimals;

  constructor(string memory name_, string memory symbol_, uint8 decimals_, address owner_, uint256 supply_) ERC20(name_, symbol_) Ownable(owner_) {
    tokenDecimals = decimals_;
    _mint(owner_, supply_);
  }

  function decimals() public view override returns (uint8) {
    return tokenDecimals;
  }
}
