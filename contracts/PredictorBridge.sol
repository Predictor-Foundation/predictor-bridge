// SPDX-License-Identifier: MIT
pragma solidity 0.8.34;

import './interfaces/IChainalysis.sol';
import './interfaces/IChainlinkV3Aggregator.sol';
import './interfaces/IPredictorBridge.sol';
import './interfaces/IUniswapV3Callback.sol';
import './interfaces/IUniswapV3Pool.sol';
import './interfaces/IWETH9.sol';
import '@openzeppelin/contracts/interfaces/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol';
import '@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol';
import '@openzeppelin/contracts/utils/ReentrancyGuardTransient.sol';

contract PredictorBridge is IPredictorBridge, Initializable, IUniswapV3Callback, Ownable2StepUpgradeable, PausableUpgradeable, ReentrancyGuardTransient, UUPSUpgradeable {
  using SafeERC20 for IERC20;

  // ============================================================
  // Constants
  // ============================================================

  string private constant NAME = 'PredictorBridge';
  string private constant EIP712_PREFIX = '\x19\x01';

  bytes32 private constant NAME_HASH = keccak256(bytes(NAME));
  bytes32 private constant VERSION_HASH = keccak256('1');

  bytes32 private constant ADD_AUTHOR_TYPEHASH = keccak256('AddAuthor(bytes t1PubKey,bytes32 t2PubKey,uint256 expiry,uint32 t2TxId)');
  bytes32 private constant DOMAIN_TYPEHASH = keccak256('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)');
  bytes32 private constant LOWER_DATA_TYPEHASH = keccak256('LowerData(address token,uint256 amount,address recipient,uint32 lowerId,bytes32 t2Sender,uint64 t2Timestamp)');
  bytes32 private constant PUBLISH_ROOT_TYPEHASH = keccak256('PublishRoot(bytes32 rootHash,uint256 expiry,uint32 t2TxId)');
  bytes32 private constant REMOVE_AUTHOR_TYPEHASH = keccak256('RemoveAuthor(bytes32 t2PubKey,bytes t1PubKey,uint256 expiry,uint32 t2TxId)');

  uint256 private constant ETH_SIG_LENGTH = 65;
  uint256 private constant LOWER_DATA_LENGTH = 20 + 32 + 20 + 4 + 32 + 8;
  uint256 private constant MAX_AUTHORS = 255;
  uint256 private constant MIN_AUTHORS = 4;
  uint256 private constant MINIMUM_LOWER_PROOF_LENGTH = LOWER_DATA_LENGTH + ETH_SIG_LENGTH * 2;
  uint160 private constant MIN_SQRT_RATIO = 4295128739;
  uint256 private constant OWNER_REVERT_LOWER_DELAY = 3 days;
  uint256 private constant T2_TOKEN_LIMIT = type(uint128).max;

  int8 private constant TX_SUCCEEDED = 1;
  int8 private constant TX_PENDING = 0;
  int8 private constant TX_FAILED = -1;

  // ============================================================
  // Immutable config
  // ============================================================

  /**
   * @dev Immutable variables are stored in the implementation bytecode rather than proxy storage.
   * They therefore do not consume storage slots in the proxy and do not affect append-only storage layout rules.
   */
  address public immutable CHAINLINK_USDC_ETH_FEED;
  address public immutable UNISWAP_V3_USDC_WETH_POOL;
  address public immutable CHAINALYSIS_SANCTIONS;
  address public immutable USDC;
  address public immutable USDT;
  address public immutable WETH;

  // ============================================================
  // Storage
  // ============================================================

  /**
   * @dev Proxy storage begins here.
   * For upgrade safety, new storage variables MUST be appended only.
   * Existing storage declarations MUST NOT be reordered, removed, or have their types changed.
   */
  uint256 internal isAuthorBitmap;
  uint256 internal authorIsActiveBitmap;
  mapping(address => uint256) public t1AddressToId;
  mapping(bytes32 => uint256) public t2PubKeyToId;
  mapping(uint256 => address) public idToT1Address;
  mapping(uint256 => bytes32) public idToT2PubKey;
  mapping(bytes32 => bool) public isPublishedRootHash;
  mapping(address => int256) public relayerBalance;
  mapping(uint256 => uint256) internal usedLowers;
  mapping(uint256 => uint256) internal usedT2TxIds;
  uint256 public numActiveAuthors;
  uint256 public nextAuthorId;

  // ============================================================
  // Custom errors
  // ============================================================

  error AddressBlocked(address); // 0x71fa9c99
  error AddressIsZero(); // 0x867915ab
  error AddressMismatch(); // 0x4cd87fb5
  error AlreadyAdded(); // 0xf411c327
  error AmountIsZero(); // 0x43ad20fc
  error AmountTooLow(); // 0x1fbaba35
  error BadConfirmations(); // 0x409c8aac
  error CannotChangeT2Key(bytes32); // 0x140c6815
  error InvalidCaller(); // 0x48f5c3ed
  error InvalidProof(); // 0x09bde339
  error InvalidT1Key(); // 0x4b0218a8
  error InvalidT2Key(); // 0xf4fc87a4
  error InvalidToken(); // 0xc1ab6dc1
  error LegacyLower(); // 0x9e79b036
  error LiftFailed(); // 0xb19ed519
  error LiftLimitHit(); // 0xc36d2830
  error LowerIsUsed(); // 0x24c1c1ce
  error MissingKeys(); // 0x097ec09e
  error NotAnAuthor(); // 0x157b0512
  error NotEnoughAuthors(); // 0x3a6a875c
  error PermissionDenied(); // 0x1e092104
  error RelayerOnly(); // 0x7378cebb
  error RelayerAlreadyRegistered();
  error RelayerNotRegistered();
  error RootHashIsUsed(); // 0x2c8a3b6e
  error T1AddressInUse(address); // 0x78f22dd1
  error T2KeyInUse(bytes32); // 0x02f3935c
  error TooManyAuthors(); // 0x7e8db19d
  error TxIdIsUsed(); // 0x7edd16f0
  error WindowExpired(); // 0x7bbfb6fe

  // ============================================================
  // Constructor
  // ============================================================

  constructor(address feed, address pool, address sanctions, address usdc, address usdt, address weth) {
    if (feed == address(0) || pool == address(0) || sanctions == address(0) || usdc == address(0) || usdt == address(0) || weth == address(0)) {
      revert AddressIsZero();
    }

    CHAINLINK_USDC_ETH_FEED = feed;
    UNISWAP_V3_USDC_WETH_POOL = pool;
    CHAINALYSIS_SANCTIONS = sanctions;
    USDC = usdc;
    USDT = usdt;
    WETH = weth;

    _disableInitializers();
  }

  // ============================================================
  // Modifiers
  // ============================================================

  modifier checkAddress(address account) {
    if (IChainalysis(CHAINALYSIS_SANCTIONS).isSanctioned(account)) revert AddressBlocked(account);
    _;
  }

  modifier withinCallWindow(uint256 expiry) {
    if (block.timestamp > expiry) revert WindowExpired();
    _;
  }

  // ============================================================
  // Write functions
  // ============================================================

  /**
   * @dev Adds or reactivates an author, permanently linking the supplied T1 and T2 keys.
   * The new author is activated when a valid confirmation from that author is first observed.
   *
   * @param t1PubKey Uncompressed 64-byte T1 public key.
   * @param t2PubKey Corresponding T2 public key.
   * @param expiry Timestamp after which the request is no longer valid.
   * @param t2TxId Unique T2 transaction identifier for replay protection.
   * @param confirmations Concatenated author confirmations over the request payload.
   */
  function addAuthor(bytes calldata t1PubKey, bytes32 t2PubKey, uint256 expiry, uint32 t2TxId, bytes calldata confirmations) external whenNotPaused withinCallWindow(expiry) {
    if (t1PubKey.length != 64) revert InvalidT1Key();
    if (t2PubKey == bytes32(0)) revert InvalidT2Key();

    address t1Address = _toAddress(t1PubKey);
    uint256 id = t1AddressToId[t1Address];
    if (isAuthor(id)) revert AlreadyAdded();

    _verifyConfirmations(false, _toAddAuthorProofHash(t1PubKey, t2PubKey, expiry, t2TxId), confirmations);
    _storeT2TxId(t2TxId);

    if (id == 0) {
      _addNewAuthor(t1Address, t2PubKey);
    } else {
      if (t2PubKey != idToT2PubKey[id]) revert CannotChangeT2Key(idToT2PubKey[id]);
      _setAuthor(id);
    }

    emit LogAuthorAdded(t1Address, t2PubKey, t2TxId);
  }

  /**
   * @dev Claims funds for the recipient specified in a valid lower proof.
   *
   * @param lowerProof Encoded lower data followed by author confirmations.
   */
  function claimLower(bytes calldata lowerProof) external whenNotPaused nonReentrant {
    (address token, uint256 amount, address recipient, uint32 lowerId, bytes32 t2Sender, uint64 t2Timestamp) = _extractLowerData(lowerProof);
    if (recipient == address(0)) revert AddressIsZero();

    _processLower(token, amount, recipient, lowerId, t2Sender, t2Timestamp, lowerProof);
    IERC20(token).safeTransfer(recipient, amount);
    emit LogLowerClaimed(lowerId);
  }

  /**
   * @dev Deregisters a relayer and returns any unclaimed USDC balance to it.
   *
   * @param relayer Relayer address to deregister.
   */
  function deregisterRelayer(address relayer) external onlyOwner nonReentrant {
    int256 balance = relayerBalance[relayer];
    if (balance == 0) revert RelayerNotRegistered();
    relayerBalance[relayer] = 0;
    if (balance > 1) IERC20(USDC).safeTransfer(relayer, uint256(balance - 1));
    emit LogRelayerDeregistered(relayer);
  }

  /**
   * @dev Derives the default prediction market T2 public key for a T1 address.
   *
   * @param t1Address T1 address to derive from.
   * @return Derived T2 public key.
   */
  function deriveT2PublicKey(address t1Address) public pure returns (bytes32) {
    return keccak256(abi.encodePacked(t1Address));
  }

  /**
   * @dev Initialises the contract and seeds the initial author set.
   *
   * @param t1Addresses Initial author T1 addresses.
   * @param t1PubKeysLHS Left-hand 32 bytes of each uncompressed T1 public key.
   * @param t1PubKeysRHS Right-hand 32 bytes of each uncompressed T1 public key.
   * @param t2PubKeys Initial author T2 public keys.
   * @param owner_ Initial contract owner.
   */
  function initialize(
    address[] calldata t1Addresses,
    bytes32[] calldata t1PubKeysLHS,
    bytes32[] calldata t1PubKeysRHS,
    bytes32[] calldata t2PubKeys,
    address owner_
  ) external initializer {
    __Ownable_init(owner_);
    __Ownable2Step_init();
    __Pausable_init();
    nextAuthorId = 1;
    _initialiseAuthors(t1Addresses, t1PubKeysLHS, t1PubKeysRHS, t2PubKeys);
  }

  /**
   * @dev Lifts approved tokens from the caller to the specified T2 recipient.
   *
   * @param token Token to lift.
   * @param t2PubKey Destination T2 public key.
   * @param amount Amount requested for lifting.
   */
  function lift(address token, bytes32 t2PubKey, uint256 amount) external whenNotPaused nonReentrant checkAddress(msg.sender) {
    if (t2PubKey == bytes32(0)) revert InvalidT2Key();
    emit LogLifted(token, t2PubKey, _lift(msg.sender, token, amount));
  }

  /**
   * @dev Pauses state-changing bridge operations.
   */
  function pause() external onlyOwner whenNotPaused {
    _pause();
  }

  /**
   * @dev Publishes a confirmed T2 Merkle root to Ethereum.
   *
   * @param rootHash Published root hash.
   * @param expiry Timestamp after which the request is no longer valid.
   * @param t2TxId Unique T2 transaction identifier for replay protection.
   * @param confirmations Concatenated author confirmations over the request payload.
   */
  function publishRoot(bytes32 rootHash, uint256 expiry, uint32 t2TxId, bytes calldata confirmations) external whenNotPaused withinCallWindow(expiry) {
    if (isPublishedRootHash[rootHash]) revert RootHashIsUsed();

    _verifyConfirmations(false, _toPublishRootProofHash(rootHash, expiry, t2TxId), confirmations);
    _storeT2TxId(t2TxId);
    isPublishedRootHash[rootHash] = true;

    emit LogRootPublished(rootHash, t2TxId);
  }

  /**
   * @dev Lifts tokens using an ERC-2612 permit instead of prior approval.
   *
   * @param token Token to lift.
   * @param t2PubKey Destination T2 public key.
   * @param amount Amount requested for lifting.
   * @param deadline Permit deadline.
   * @param v Signature v value.
   * @param r Signature r value.
   * @param s Signature s value.
   */
  function permitLift(
    address token,
    bytes32 t2PubKey,
    uint256 amount,
    uint256 deadline,
    uint8 v,
    bytes32 r,
    bytes32 s
  ) external whenNotPaused nonReentrant checkAddress(msg.sender) {
    if (t2PubKey == bytes32(0)) revert InvalidT2Key();
    IERC20Permit(token).permit(msg.sender, address(this), amount, deadline, v, r, s);
    emit LogLifted(token, t2PubKey, _lift(msg.sender, token, amount));
  }

  /**
   * @dev Lifts approved USDC or USDT tokens to the caller's derived prediction market T2 account.
   *
   * @param token Token to lift - USDC or USDT only.
   * @param amount Amount requested for lifting.
   */
  function predictionMarketLift(address token, uint256 amount) external whenNotPaused nonReentrant checkAddress(msg.sender) {
    if (!_isPredictionMarketToken(token)) revert InvalidToken();
    emit LogLiftedToPredictionMarket(token, deriveT2PublicKey(msg.sender), _lift(msg.sender, token, amount));
  }

  /**
   * @dev Lifts USDC to the caller's derived prediction market T2 account using an ERC-2612 permit.
   *
   * @param amount Amount requested for lifting.
   * @param deadline Permit deadline.
   * @param v Signature v value.
   * @param r Signature r value.
   * @param s Signature s value.
   */
  function predictionMarketPermitLift(uint256 amount, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external whenNotPaused nonReentrant checkAddress(msg.sender) {
    IERC20Permit(USDC).permit(msg.sender, address(this), amount, deadline, v, r, s);
    emit LogLiftedToPredictionMarket(USDC, deriveT2PublicKey(msg.sender), _lift(msg.sender, USDC, amount));
  }

  /**
   * @dev Lifts approved USDC or USDT tokens to a specified prediction market T2 account.
   *
   * @param token Token to lift - USDC or USDT only.
   * @param t2PubKey Destination T2 public key.
   * @param amount Amount requested for lifting.
   */
  function predictionMarketRecipientLift(address token, bytes32 t2PubKey, uint256 amount) external whenNotPaused nonReentrant checkAddress(msg.sender) {
    if (!_isPredictionMarketToken(token)) revert InvalidToken();
    if (t2PubKey == bytes32(0)) revert InvalidT2Key();
    emit LogLiftedToPredictionMarket(token, t2PubKey, _lift(msg.sender, token, amount));
  }

  /**
   * @dev Allows the contract to receive ETH, primarily from WETH unwrapping during relayer refunds.
   */
  receive() external payable {}

  /**
   * @dev Registers a relayer for sponsored prediction market USDC bridge operations.
   *
   * @param relayer Relayer address to register.
   */
  function registerRelayer(address relayer) external onlyOwner {
    if (relayer == address(0)) revert AddressIsZero();
    if (relayerBalance[relayer] != 0) revert RelayerAlreadyRegistered();
    relayerBalance[relayer] = 1;
    emit LogRelayerRegistered(relayer);
  }

  /**
   * @dev Lets a registered relayer lift USDC on behalf of a user and deduct its tx cost from the bridged amount.
   *
   * @param gasCost Relayer-supplied gas usage figure for reimbursement.
   * @param amount Amount approved by the user.
   * @param user User authorising the lift.
   * @param v Signature v value for the USDC permit.
   * @param r Signature r value for the USDC permit.
   * @param s Signature s value for the USDC permit.
   * @param triggerRefund Whether to immediately attempt conversion of accumulated USDC fees into ETH for refund.
   */
  function relayerLift(
    uint256 gasCost,
    uint256 amount,
    address user,
    uint8 v,
    bytes32 r,
    bytes32 s,
    bool triggerRefund
  ) external whenNotPaused nonReentrant checkAddress(user) {
    int256 balance = relayerBalance[msg.sender];
    if (balance < 1) revert RelayerOnly();

    uint256 txCost = (gasCost * tx.gasprice) / usdcEth();
    if (txCost > amount) revert AmountTooLow();

    IERC20Permit(USDC).permit(user, address(this), amount, type(uint256).max, v, r, s);
    IERC20(USDC).safeTransferFrom(user, address(this), amount);

    unchecked {
      amount -= txCost;
      balance += int256(txCost);
    }

    if (triggerRefund) _attemptRelayerRefund(balance);
    else relayerBalance[msg.sender] = balance;

    emit LogLiftedToPredictionMarket(USDC, deriveT2PublicKey(user), amount);
  }

  /**
   * @dev Lets a registered relayer complete a USDC lower for the recipient specified in the proof and deduct its tx cost from the lowered amount.
   *
   *
   * @param gasCost Relayer-supplied gas usage figure for reimbursement.
   * @param lowerProof Encoded lower data followed by author confirmations.
   * @param triggerRefund Whether to immediately attempt conversion of accumulated USDC fees into ETH for refund.
   */
  function relayerLower(uint256 gasCost, bytes calldata lowerProof, bool triggerRefund) external whenNotPaused nonReentrant {
    int256 balance = relayerBalance[msg.sender];
    if (balance < 1) revert RelayerOnly();

    (address token, uint256 amount, address user, uint32 lowerId, bytes32 t2Sender, uint64 t2Timestamp) = _extractLowerData(lowerProof);
    if (token != USDC) revert InvalidToken();

    uint256 txCost = (gasCost * tx.gasprice) / usdcEth();
    if (txCost > amount) revert AmountTooLow();

    _processLower(token, amount, user, lowerId, t2Sender, t2Timestamp, lowerProof);

    unchecked {
      amount -= txCost;
      balance += int256(txCost);
    }

    IERC20(USDC).safeTransfer(user, amount);

    if (triggerRefund) _attemptRelayerRefund(balance);
    else relayerBalance[msg.sender] = balance;

    emit LogRelayerLowered(lowerId, amount);
  }

  /**
   * @dev Removes an author, immediately revoking its authority in the bridge.
   *
   * @param t2PubKey T2 public key of the author to remove.
   * @param t1PubKey Uncompressed 64-byte T1 public key of the author to remove.
   * @param expiry Timestamp after which the request is no longer valid.
   * @param t2TxId Unique T2 transaction identifier for replay protection.
   * @param confirmations Concatenated author confirmations over the request payload.
   */
  function removeAuthor(
    bytes32 t2PubKey,
    bytes calldata t1PubKey,
    uint256 expiry,
    uint32 t2TxId,
    bytes calldata confirmations
  ) external whenNotPaused withinCallWindow(expiry) {
    if (t1PubKey.length != 64) revert InvalidT1Key();

    uint256 id = t2PubKeyToId[t2PubKey];
    if (!isAuthor(id)) revert NotAnAuthor();

    _verifyConfirmations(false, _toRemoveAuthorProofHash(t2PubKey, t1PubKey, expiry, t2TxId), confirmations);

    if (numActiveAuthors <= MIN_AUTHORS) revert NotEnoughAuthors();

    _storeT2TxId(t2TxId);
    _clearAuthor(id);

    if (authorIsActive(id)) {
      _clearAuthorActive(id);
      unchecked {
        --numActiveAuthors;
      }
    }

    emit LogAuthorRemoved(idToT1Address[id], t2PubKey, t2TxId);
  }

  /**
   * @dev Reverts a valid lower instead of claiming it, returning the funds to the originating T2 sender.
   * The intended recipient may revert at any time. The owner may revert on their behalf after 72 hours have elapsed.
   *
   * @param lowerProof Encoded lower data followed by author confirmations.
   */
  function revertLower(bytes calldata lowerProof) external whenNotPaused nonReentrant {
    (address token, uint256 amount, address recipient, uint32 lowerId, bytes32 t2Sender, uint64 t2Timestamp) = _extractLowerData(lowerProof);

    bool canRevert = msg.sender == recipient || (msg.sender == owner() && block.timestamp > t2Timestamp + OWNER_REVERT_LOWER_DELAY);
    if (!canRevert) revert PermissionDenied();
    if (t2Sender == bytes32(0)) revert LegacyLower();

    _processLower(token, amount, recipient, lowerId, t2Sender, t2Timestamp, lowerProof);
    emit LogLowerReverted(token, t2Sender, recipient, amount, lowerId);
  }

  /**
   * @dev Unpauses state-changing bridge operations.
   */
  function unpause() external onlyOwner whenPaused {
    _unpause();
  }

  // ============================================================
  // Read functions
  // ============================================================

  /**
   * @dev Returns whether an author id is currently active.
   *
   * @param id Author identifier.
   * @return True if the author is active.
   */
  function authorIsActive(uint256 id) public view returns (bool) {
    return _isBitSet(authorIsActiveBitmap, _authorBit(id));
  }

  /**
   * @dev Checks a lower proof and returns its decoded data, confirmation status, and usage status.
   *
   * @param lowerProof Encoded lower data followed by author confirmations.
   * @return result Struct containing decoded lower data, confirmation counts, validity, and usage status.
   */
  function checkLower(bytes calldata lowerProof) external view returns (LowerCheck memory result) {
    if (!_isCorrectLength(lowerProof)) return result;

    (result.token, result.amount, result.recipient, result.lowerId, result.t2Sender, result.t2Timestamp) = _extractLowerData(lowerProof);
    bytes32 proofHash = _toLowerDataProofHash(result.token, result.amount, result.recipient, result.lowerId, result.t2Sender, result.t2Timestamp);
    uint256 numConfirmationsProvided = (lowerProof.length - LOWER_DATA_LENGTH) / ETH_SIG_LENGTH;
    uint256 confirmedBitmap;
    uint256 confirmationsOffset;

    result.lowerIsUsed = isUsedLower(result.lowerId);
    result.confirmationsProvided = numConfirmationsProvided;
    result.confirmationsRequired = _requiredConfirmations();

    assembly {
      confirmationsOffset := add(lowerProof.offset, LOWER_DATA_LENGTH)
    }

    for (uint256 i; i < numConfirmationsProvided; ++i) {
      uint256 id = _recoverAuthorId(proofHash, confirmationsOffset, i);
      uint256 bit = _authorBit(id);
      if (authorIsActive(id) && !_isBitSet(confirmedBitmap, bit)) confirmedBitmap |= bit;
      else result.confirmationsProvided--;
    }

    result.proofIsValid = result.confirmationsProvided >= result.confirmationsRequired;
  }

  /**
   * @dev Verifies whether a leaf belongs to a previously published root.
   *
   * @param leafHash Leaf hash to verify.
   * @param merklePath Merkle proof path from the leaf to the published root.
   * @return True if the leaf resolves to a published root.
   */
  function confirmTransaction(bytes32 leafHash, bytes32[] calldata merklePath) external view returns (bool) {
    for (uint256 i; i < merklePath.length; ) {
      bytes32 node = merklePath[i];
      leafHash = leafHash < node ? keccak256(abi.encode(leafHash, node)) : keccak256(abi.encode(node, leafHash));
      unchecked {
        ++i;
      }
    }

    return isPublishedRootHash[leafHash];
  }

  /**
   * @dev Returns the observed status of a T2 transaction identifier.
   *
   * @param t2TxId T2 transaction identifier.
   * @param expiry Expiry timestamp associated with the originating request.
   * @return Current status: pending, succeeded, or failed.
   */
  function corroborate(uint32 t2TxId, uint256 expiry) external view returns (int8) {
    (uint256 bucket, uint256 mask) = _idToBitmap(t2TxId);
    if ((usedT2TxIds[bucket] & mask) != 0) return TX_SUCCEEDED;
    if (block.timestamp > expiry) return TX_FAILED;
    return TX_PENDING;
  }

  /**
   * @dev Returns whether an author id currently exists in the author set.
   *
   * @param id Author identifier.
   * @return True if the author exists.
   */
  function isAuthor(uint256 id) public view returns (bool) {
    return _isBitSet(isAuthorBitmap, _authorBit(id));
  }

  /**
   * @dev Returns whether a lower identifier has already been processed.
   *
   * @param lowerId Lower identifier to check.
   * @return True if the lower has already been used (claimed or reverted).
   */
  function isUsedLower(uint32 lowerId) public view returns (bool) {
    (uint256 bucket, uint256 mask) = _idToBitmap(lowerId);
    return (usedLowers[bucket] & mask) != 0;
  }

  /**
   * @dev EIP-712 domain name used by the contract.
   *
   * @return Contract domain name.
   */
  function name() external pure returns (string memory) {
    return NAME;
  }

  /**
   * @dev Disabled. Ownership cannot be renounced.
   */
  function renounceOwnership() public view override onlyOwner {
    revert('Disabled');
  }

  /**
   * @dev Returns the current Wei value of one USDC using the configured Chainlink feed.
   *
   * @return price Wei-denominated value of 1 USDC.
   */
  function usdcEth() public view returns (uint256 price) {
    unchecked {
      price = uint256(IChainlinkV3Aggregator(CHAINLINK_USDC_ETH_FEED).latestAnswer()) / 1e6;
    }
  }

  // ============================================================
  // Callback functions
  // ============================================================

  /**
   * @dev Internal callback entry point used to convert accumulated relayer USDC fees into ETH.
   * Can only be called by this contract.
   *
   * @param relayer Relayer receiving the refund.
   * @param balance USDC balance to convert.
   */
  function refundRelayerCallback(address relayer, int256 balance) external {
    if (msg.sender != address(this)) revert InvalidCaller();
    (, int256 amount1) = IUniswapV3Pool(UNISWAP_V3_USDC_WETH_POOL).swap(address(this), true, balance, MIN_SQRT_RATIO + 1, '');

    unchecked {
      uint256 ethAmount = uint256(amount1 * -1);
      if (ethAmount < (uint256(balance) * usdcEth() * 987) / 1000) revert();
      IWETH9(WETH).withdraw(ethAmount);
      (bool success, ) = relayer.call{ value: ethAmount }('');
      assembly {
        pop(success)
      }
    }
  }

  /**
   * @dev Uniswap V3 swap callback used during relayer fee refunds.
   * Can only be called by the configured pool.
   *
   * @param amount0Delta Amount of token0 owed to the pool.
   * @param amount1Delta Amount of token1 delta supplied by Uniswap.
   * @param data Arbitrary callback data.
   */
  function uniswapV3SwapCallback(int256 amount0Delta, int256 amount1Delta, bytes calldata data) external override {
    amount1Delta;
    data;

    if (msg.sender != UNISWAP_V3_USDC_WETH_POOL) revert InvalidCaller();
    IERC20(USDC).safeTransfer(msg.sender, uint256(amount0Delta));
  }

  // ============================================================
  // Private functions
  // ============================================================

  function _activateAuthor(uint256 id) private {
    _setAuthorActive(id);
    unchecked {
      ++numActiveAuthors;
    }
  }

  function _addNewAuthor(address t1Address, bytes32 t2PubKey) private returns (uint256 id) {
    if (nextAuthorId > MAX_AUTHORS) revert TooManyAuthors();

    unchecked {
      id = nextAuthorId++;
    }

    if (t2PubKeyToId[t2PubKey] != 0) revert T2KeyInUse(t2PubKey);

    idToT1Address[id] = t1Address;
    idToT2PubKey[id] = t2PubKey;
    t1AddressToId[t1Address] = id;
    t2PubKeyToId[t2PubKey] = id;
    _setAuthor(id);
  }

  function _attemptRelayerRefund(int256 balance) private {
    try this.refundRelayerCallback(msg.sender, balance - 1) {
      relayerBalance[msg.sender] = 1;
    } catch {
      relayerBalance[msg.sender] = balance;
      emit LogRefundFailed(msg.sender, balance);
    }
  }

  function _authorBit(uint256 id) private pure returns (uint256) {
    return 1 << id;
  }

  function _authorizeUpgrade(address) internal override onlyOwner {}

  function _clearAuthor(uint256 id) private {
    isAuthorBitmap &= ~_authorBit(id);
  }

  function _clearAuthorActive(uint256 id) private {
    authorIsActiveBitmap &= ~_authorBit(id);
  }

  function _domainSeparator() private view returns (bytes32) {
    return keccak256(abi.encode(DOMAIN_TYPEHASH, NAME_HASH, VERSION_HASH, block.chainid, address(this)));
  }

  function _extractLowerData(
    bytes calldata lowerProof
  ) private pure returns (address token, uint256 amount, address recipient, uint32 lowerId, bytes32 t2Sender, uint64 t2Timestamp) {
    if (!_isCorrectLength(lowerProof)) revert InvalidProof();

    assembly {
      token := shr(96, calldataload(lowerProof.offset))
      amount := calldataload(add(lowerProof.offset, 20))
      recipient := shr(96, calldataload(add(lowerProof.offset, 52)))
      lowerId := shr(224, calldataload(add(lowerProof.offset, 72)))
      t2Sender := calldataload(add(lowerProof.offset, 76))
      t2Timestamp := shr(192, calldataload(add(lowerProof.offset, 108)))
    }
  }

  function _idToBitmap(uint32 id) private pure returns (uint256 bucket, uint256 mask) {
    bucket = uint256(id) >> 8;
    mask = 1 << (uint256(id) & 255);
  }

  function _initialiseAuthors(address[] calldata t1Addresses, bytes32[] calldata t1PubKeysLHS, bytes32[] calldata t1PubKeysRHS, bytes32[] calldata t2PubKeys) internal {
    uint256 numAuth = t1Addresses.length;
    if (numAuth < MIN_AUTHORS) revert NotEnoughAuthors();
    if (numAuth > MAX_AUTHORS) revert TooManyAuthors();
    if (t1PubKeysLHS.length != numAuth || t1PubKeysRHS.length != numAuth || t2PubKeys.length != numAuth) revert MissingKeys();

    for (uint256 i; i < numAuth; ) {
      address t1Address = t1Addresses[i];
      if (t1Address == address(0)) revert AddressIsZero();

      bytes memory t1PubKey = abi.encode(t1PubKeysLHS[i], t1PubKeysRHS[i]);
      if (_toAddress(t1PubKey) != t1Address) revert AddressMismatch();
      if (t1AddressToId[t1Address] != 0) revert T1AddressInUse(t1Address);

      _activateAuthor(_addNewAuthor(t1Address, t2PubKeys[i]));

      unchecked {
        ++i;
      }
    }
  }

  function _isBitSet(uint256 bitmap, uint256 bit) private pure returns (bool) {
    return (bitmap & bit) != 0;
  }

  function _isCorrectLength(bytes calldata proof) private pure returns (bool) {
    if (proof.length < MINIMUM_LOWER_PROOF_LENGTH) return false;
    return (proof.length - LOWER_DATA_LENGTH) % ETH_SIG_LENGTH == 0;
  }

  function _isPredictionMarketToken(address token) private view returns (bool) {
    return token == USDC || token == USDT;
  }

  function _lift(address lifter, address token, uint256 amount) private returns (uint256 liftedAmount) {
    if (amount == 0) revert AmountIsZero();

    uint256 existingBalance = IERC20(token).balanceOf(address(this));
    IERC20(token).safeTransferFrom(lifter, address(this), amount);
    uint256 newBalance = IERC20(token).balanceOf(address(this));

    if (newBalance <= existingBalance) revert LiftFailed();
    if (newBalance > T2_TOKEN_LIMIT) revert LiftLimitHit();

    liftedAmount = newBalance - existingBalance;
  }

  function _processLower(address token, uint256 amount, address recipient, uint32 lowerId, bytes32 t2Sender, uint64 t2Timestamp, bytes calldata lowerProof) private {
    (uint256 bucket, uint256 mask) = _idToBitmap(lowerId);
    if ((usedLowers[bucket] & mask) != 0) revert LowerIsUsed();
    usedLowers[bucket] |= mask;

    bytes32 proofHash = _toLowerDataProofHash(token, amount, recipient, lowerId, t2Sender, t2Timestamp);
    _verifyConfirmations(true, proofHash, lowerProof[LOWER_DATA_LENGTH:]);
  }

  function _recoverAuthorId(bytes32 msgHash, uint256 confirmationsOffset, uint256 confirmationsIndex) private view returns (uint256 id) {
    bytes32 r;
    bytes32 s;
    uint8 v;

    assembly {
      let sig := add(confirmationsOffset, mul(confirmationsIndex, ETH_SIG_LENGTH))
      r := calldataload(sig)
      s := calldataload(add(sig, 32))
      v := byte(0, calldataload(add(sig, 64)))
    }

    if (v < 27) {
      unchecked {
        v += 27;
      }
    }

    id = v < 29 && uint256(s) <= 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0 ? t1AddressToId[ecrecover(msgHash, v, r, s)] : 0;
  }

  function _requiredConfirmations() private view returns (uint256 required) {
    unchecked {
      required = (numActiveAuthors / 2) + 1;
    }
  }

  function _setAuthor(uint256 id) private {
    isAuthorBitmap |= _authorBit(id);
  }

  function _setAuthorActive(uint256 id) private {
    authorIsActiveBitmap |= _authorBit(id);
  }

  function _storeT2TxId(uint32 t2TxId) private {
    (uint256 bucket, uint256 mask) = _idToBitmap(t2TxId);
    if ((usedT2TxIds[bucket] & mask) != 0) revert TxIdIsUsed();
    usedT2TxIds[bucket] |= mask;
  }

  function _toAddAuthorProofHash(bytes calldata t1PubKey, bytes32 t2PubKey, uint256 expiry, uint32 t2TxId) private view returns (bytes32) {
    bytes32 t1PubKeyHash = keccak256(t1PubKey);
    bytes32 structHash = keccak256(abi.encode(ADD_AUTHOR_TYPEHASH, t1PubKeyHash, t2PubKey, expiry, t2TxId));
    return keccak256(abi.encodePacked(EIP712_PREFIX, _domainSeparator(), structHash));
  }

  function _toAddress(bytes memory t1PubKey) private pure returns (address) {
    return address(uint160(uint256(keccak256(t1PubKey))));
  }

  function _toLowerDataProofHash(address token, uint256 amount, address recipient, uint32 lowerId, bytes32 t2Sender, uint64 t2Timestamp) private view returns (bytes32) {
    bytes32 structHash = keccak256(abi.encode(LOWER_DATA_TYPEHASH, token, amount, recipient, lowerId, t2Sender, t2Timestamp));
    return keccak256(abi.encodePacked(EIP712_PREFIX, _domainSeparator(), structHash));
  }

  function _toPublishRootProofHash(bytes32 rootHash, uint256 expiry, uint32 t2TxId) private view returns (bytes32) {
    bytes32 structHash = keccak256(abi.encode(PUBLISH_ROOT_TYPEHASH, rootHash, expiry, t2TxId));
    return keccak256(abi.encodePacked(EIP712_PREFIX, _domainSeparator(), structHash));
  }

  function _toRemoveAuthorProofHash(bytes32 t2PubKey, bytes calldata t1PubKey, uint256 expiry, uint32 t2TxId) private view returns (bytes32) {
    bytes32 t1PubKeyHash = keccak256(t1PubKey);
    bytes32 structHash = keccak256(abi.encode(REMOVE_AUTHOR_TYPEHASH, t2PubKey, t1PubKeyHash, expiry, t2TxId));
    return keccak256(abi.encodePacked(EIP712_PREFIX, _domainSeparator(), structHash));
  }

  function _verifyConfirmations(bool isLower, bytes32 msgHash, bytes calldata confirmations) private {
    uint256 confirmedBitmap;
    uint256 requiredConfirmations = _requiredConfirmations();
    uint256 numConfirmationsProvided = confirmations.length / ETH_SIG_LENGTH;
    uint256 confirmationsOffset;
    uint256 confirmationsIndex;
    uint256 validConfirmations;
    uint256 authorId;

    assembly {
      confirmationsOffset := confirmations.offset
    }

    if (isLower) {
      // For lowers, all confirmations are explicit, so the first authorId is extracted from the first confirmation
      authorId = _recoverAuthorId(msgHash, confirmationsOffset, confirmationsIndex);
      confirmationsIndex = 1;
    } else {
      // For non-lowers, optimistically assume the sender is an author
      authorId = t1AddressToId[msg.sender];
      unchecked {
        ++numConfirmationsProvided;
      }
    }

    do {
      uint256 bit = _authorBit(authorId);

      if (!authorIsActive(authorId)) {
        if (isAuthor(authorId)) {
          _activateAuthor(authorId);
          unchecked {
            ++validConfirmations;
          }
          requiredConfirmations = _requiredConfirmations();
          if (validConfirmations == requiredConfirmations) return;
          confirmedBitmap |= bit;
        }
      } else if (!_isBitSet(confirmedBitmap, bit)) {
        unchecked {
          ++validConfirmations;
        }
        if (validConfirmations == requiredConfirmations) return;
        confirmedBitmap |= bit;
      }

      authorId = _recoverAuthorId(msgHash, confirmationsOffset, confirmationsIndex);
      unchecked {
        ++confirmationsIndex;
      }
    } while (confirmationsIndex <= numConfirmationsProvided);

    revert BadConfirmations();
  }
}
