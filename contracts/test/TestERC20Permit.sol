// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol';
import '@openzeppelin/contracts/access/Ownable2Step.sol';

contract TestERC20Permit is ERC20, ERC20Permit, Ownable2Step {
  uint8 private immutable _tokenDecimals;

  constructor(string memory name_, string memory symbol_, uint8 decimals_, address owner_, uint256 supply_) ERC20(name_, symbol_) ERC20Permit(name_) Ownable(owner_) {
    _tokenDecimals = decimals_;
    _mint(owner_, supply_);
  }

  function decimals() public view override returns (uint8) {
    return _tokenDecimals;
  }
}
