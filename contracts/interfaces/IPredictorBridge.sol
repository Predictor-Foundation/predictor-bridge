// SPDX-License-Identifier: MIT
pragma solidity 0.8.34;

interface IPredictorBridge {
  struct LowerCheck {
    address token;
    uint256 amount;
    address recipient;
    uint32 lowerId;
    bytes32 t2Sender;
    uint64 t2Timestamp;
    uint256 confirmationsRequired;
    uint256 confirmationsProvided;
    bool proofIsValid;
    bool lowerIsUsed;
  }

  // ============================================================
  // Events
  // ============================================================

  event LogAuthorAdded(address indexed t1Address, bytes32 indexed t2PubKey, uint32 indexed t2TxId);
  event LogAuthorRemoved(address indexed t1Address, bytes32 indexed t2PubKey, uint32 indexed t2TxId);
  event LogLifted(address indexed token, bytes32 indexed t2PubKey, uint256 amount);
  event LogLiftedToPredictionMarket(address indexed token, bytes32 indexed t2PubKey, uint256 amount);
  event LogLowerClaimed(uint32 indexed lowerId);
  event LogLowerReverted(address indexed token, bytes32 indexed t2PubKey, address indexed originalRecipient, uint256 amount, uint32 lowerId);
  event LogRelayerDeregistered(address indexed relayer);
  event LogRefundFailed(address indexed relayer, int256 balance);
  event LogRelayerLowered(uint32 indexed lowerId, uint256 amount);
  event LogRelayerRegistered(address indexed relayer);
  event LogRootPublished(bytes32 indexed rootHash, uint32 indexed t2TxId);

  // ============================================================
  // Write functions
  // ============================================================

  function addAuthor(bytes calldata t1PubKey, bytes32 t2PubKey, uint256 expiry, uint32 t2TxId, bytes calldata confirmations) external;
  function claimLower(bytes calldata proof) external;
  function deregisterRelayer(address relayer) external;
  function initialize(address[] calldata t1Addresses, bytes32[] calldata t1PubKeysLHS, bytes32[] calldata t1PubKeysRHS, bytes32[] calldata t2PubKeys, address owner_) external;
  function lift(address token, bytes32 t2PubKey, uint256 amount) external;
  function pause() external;
  function publishRoot(bytes32 rootHash, uint256 expiry, uint32 t2TxId, bytes calldata confirmations) external;
  function permitLift(address token, bytes32 t2PubKey, uint256 amount, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external;
  function predictionMarketLift(address token, uint256 amount) external;
  function predictionMarketPermitLift(uint256 amount, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external;
  function predictionMarketRecipientLift(address token, bytes32 t2PubKey, uint256 amount) external;
  function registerRelayer(address relayer) external;
  function relayerLift(uint256 gasCost, uint256 amount, address user, uint8 v, bytes32 r, bytes32 s, bool triggerRefund) external;
  function relayerLower(uint256 gasCost, bytes calldata proof, bool triggerRefund) external;
  function removeAuthor(bytes32 t2PubKey, bytes calldata t1PubKey, uint256 expiry, uint32 t2TxId, bytes calldata confirmations) external;
  function revertLower(bytes calldata proof) external;
  function unpause() external;

  // ============================================================
  // Read functions
  // ============================================================

  function authorIsActive(uint256 id) external view returns (bool);
  function checkLower(bytes calldata proof) external view returns (LowerCheck memory);
  function confirmTransaction(bytes32 leafHash, bytes32[] calldata merklePath) external view returns (bool);
  function corroborate(uint32 t2TxId, uint256 expiry) external view returns (int8);
  function deriveT2PublicKey(address t1Address) external pure returns (bytes32);
  function idToT1Address(uint256 id) external view returns (address);
  function idToT2PubKey(uint256 id) external view returns (bytes32);
  function isAuthor(uint256 id) external view returns (bool);
  function isPublishedRootHash(bytes32 rootHash) external view returns (bool);
  function isUsedLower(uint32 lowerId) external view returns (bool);
  function name() external pure returns (string memory);
  function nextAuthorId() external view returns (uint256);
  function numActiveAuthors() external view returns (uint256);
  function relayerBalance(address relayer) external view returns (int256);
  function t1AddressToId(address t1Address) external view returns (uint256);
  function t2PubKeyToId(bytes32 t2PubKey) external view returns (uint256);
  function usdcEth() external view returns (uint256 price);
}
