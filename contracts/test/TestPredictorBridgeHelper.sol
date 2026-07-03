// SPDX-License-Identifier: MIT
pragma solidity 0.8.35;

import '../interfaces/IChainalysis.sol';
import '../interfaces/IUniswapV3Callback.sol';
import '@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol';

contract TestPredictorBridgeHelper is Initializable, IChainalysis, Ownable2StepUpgradeable, UUPSUpgradeable {
  int256 public constant CHAINLINK_ANSWER = 200000000000000; // $5000 per ETH
  uint80 public constant CHAINLINK_ROUND_ID = 1;

  mapping(address => bool) public isSanctioned;

  address public immutable PRD;
  address public immutable TOK;
  address public immutable USDC;
  address public immutable USDT;
  address public bridge;

  address private deployer;

  error OnlyDeployerCanInitBridge();
  error BridgeAlreadyInitialised();
  error BridgeAddressIsZero();

  constructor(address prd, address tok, address usdc, address usdt) {
    PRD = prd;
    TOK = tok;
    USDC = usdc;
    USDT = usdt;
    _disableInitializers();
  }

  function initialize(address _owner) public initializer {
    __Ownable_init(_owner);
    __Ownable2Step_init();
    deployer = msg.sender;
  }

  receive() external payable {}

  function initBridge(address _bridge) external {
    if (msg.sender != deployer) revert OnlyDeployerCanInitBridge();
    if (bridge != address(0)) revert BridgeAlreadyInitialised();
    if (_bridge == address(0)) revert BridgeAddressIsZero();

    bridge = _bridge;
  }

  function setBridge(address _bridge) external onlyOwner {
    if (_bridge == address(0)) revert BridgeAddressIsZero();
    bridge = _bridge;
  }

  function setSanctioned(address addr, bool _isSanctioned) external onlyOwner {
    isSanctioned[addr] = _isSanctioned;
  }

  function latestRoundData() external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound) {
    return (CHAINLINK_ROUND_ID, CHAINLINK_ANSWER, block.timestamp, block.timestamp, CHAINLINK_ROUND_ID);
  }

  function withdraw(uint256 amount) external {
    if (msg.sender != bridge) revert();

    (bool success, ) = msg.sender.call{ value: amount }('');
    assembly {
      // Intentionally ignored: this testnet helper mirrors the production callback shape without enforcing ETH liquidity.
      pop(success)
    }
  }

  function swap(address, bool, int256 usdcInAmount, uint160, bytes calldata) external returns (int256, int256) {
    if (msg.sender != bridge) revert();

    int256 ethOutAmount = (-1 * CHAINLINK_ANSWER * usdcInAmount * 99) / (100 * 1e6);
    IUniswapV3Callback(msg.sender).uniswapV3SwapCallback(usdcInAmount, 0, '');

    return (0, ethOutAmount);
  }

  function _authorizeUpgrade(address) internal override onlyOwner {}
}
