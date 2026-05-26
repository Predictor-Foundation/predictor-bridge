// SPDX-License-Identifier: MIT
pragma solidity 0.8.34;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol';

contract MockBurnOnTransferERC20Permit is ERC20, ERC20Permit {
  uint256 public immutable burnBps; // 10000 = 100%

  constructor(
    string memory name_,
    string memory symbol_,
    uint8,
    address initialHolder,
    uint256 initialSupply,
    uint256 burnBps_
  ) ERC20(name_, symbol_) ERC20Permit(name_) {
    burnBps = burnBps_;
    _mint(initialHolder, initialSupply);
  }

  function _update(address from, address to, uint256 value) internal override {
    if (from == address(0) || to == address(0) || burnBps == 0) {
      super._update(from, to, value);
      return;
    }

    uint256 burned = (value * burnBps) / 10000;
    uint256 received = value - burned;

    if (burned != 0) super._update(from, address(0), burned);
    if (received != 0) super._update(from, to, received);
  }
}
