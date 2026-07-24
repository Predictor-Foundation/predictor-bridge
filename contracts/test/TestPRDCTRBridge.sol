// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import '../PRDCTRBridge.sol';

/**
 * @dev Non-mainnet variant of PRDCTRBridge used by dev/testnet deployments.
 * Core bridge behaviour is inherited unchanged; this implementation cannot be deployed on Ethereum mainnet.
 *
 * The test bridge adds owner-gated reset functions and an initializer variant that registers the
 * configured relayers during initialization. This keeps the audited
 * production bridge initializer unchanged while still supporting non-deployer owners on test networks.
 */
contract TestPRDCTRBridge is PRDCTRBridge {
  event LogReset(uint32 indexed nonce);
  event LogAuthorsReset();

  uint256 private constant ETHEREUM_MAINNET_CHAIN_ID = 1;
  uint32 public resetNonce;

  error TestBridgeNotForUseOnMainnet();

  constructor(address feed, address pool, address sanctions, address prd, address usdc, address usdt, address weth) PRDCTRBridge(feed, pool, sanctions, prd, usdc, usdt, weth) {
    if (block.chainid == ETHEREUM_MAINNET_CHAIN_ID) revert TestBridgeNotForUseOnMainnet();
  }

  /**
   * @dev Initialises the test bridge, seeds authors, registers relayers, and assigns ownership.
   * This intentionally does not alter PRDCTRBridge's audited initializer.
   *
   * @param t1Addresses Initial author T1 addresses.
   * @param t1PubKeysLHS Left-hand 32 bytes of each uncompressed T1 public key.
   * @param t1PubKeysRHS Right-hand 32 bytes of each uncompressed T1 public key.
   * @param t2PubKeys Initial author T2 public keys.
   * @param owner_ Initial contract owner.
   * @param relayers Initial relayer addresses.
   */
  function initialize(
    address[] calldata t1Addresses,
    bytes32[] calldata t1PubKeysLHS,
    bytes32[] calldata t1PubKeysRHS,
    bytes32[] calldata t2PubKeys,
    address owner_,
    address[] calldata relayers
  ) external initializer {
    __Ownable_init(owner_);
    __Ownable2Step_init();
    __Pausable_init();

    nextAuthorId = 1;

    _initialiseAuthors(t1Addresses, t1PubKeysLHS, t1PubKeysRHS, t2PubKeys);
    _initialiseRelayers(relayers);
  }

  /**
   * @dev Wipes per-run sparse bridge state. Lower ids and T2 tx ids are issued consecutively, so the
   * caller passes the highest id seen during the run and the contract clears every bitmap bucket
   * up to that id. Published root hashes are sparse with no enumeration, so the caller passes them.
   *
   * Authors and owner are preserved — use resetAuthors to swap the author set, and the existing
   * registerRelayer / deregisterRelayer functions to manage relayer balances.
   *
   * @param lastLowerId Highest lower id issued during the run.
   * @param lastT2TxId Highest T2 tx id observed during the run.
   * @param rootHashes Published root hashes to clear.
   */
  function resetState(uint32 lastLowerId, uint32 lastT2TxId, bytes32[] calldata rootHashes) external onlyOwner {
    uint256 lastBucket = uint256(lastLowerId) >> 8;
    for (uint256 b; b <= lastBucket; ) {
      delete usedLowers[b];
      unchecked {
        ++b;
      }
    }

    lastBucket = uint256(lastT2TxId) >> 8;
    for (uint256 b; b <= lastBucket; ) {
      delete usedT2TxIds[b];
      unchecked {
        ++b;
      }
    }

    for (uint256 i; i < rootHashes.length; ) {
      delete isPublishedRootHash[rootHashes[i]];
      unchecked {
        ++i;
      }
    }

    unchecked {
      ++resetNonce;
    }

    emit LogReset(resetNonce);
  }

  /**
   * @dev Clears the existing author set and re-seeds it with the supplied authors. Author state
   * is fully enumerable via nextAuthorId so no external keys are required.
   *
   * @param t1Addresses Replacement author T1 addresses.
   * @param t1PubKeysLHS Left-hand 32 bytes of each uncompressed T1 public key.
   * @param t1PubKeysRHS Right-hand 32 bytes of each uncompressed T1 public key.
   * @param t2PubKeys Replacement author T2 public keys.
   */
  function resetAuthors(address[] calldata t1Addresses, bytes32[] calldata t1PubKeysLHS, bytes32[] calldata t1PubKeysRHS, bytes32[] calldata t2PubKeys) external onlyOwner {
    uint256 next = nextAuthorId;
    for (uint256 id = 1; id < next; ) {
      delete t1AddressToId[idToT1Address[id]];
      delete t2PubKeyToId[idToT2PubKey[id]];
      delete idToT1Address[id];
      delete idToT2PubKey[id];
      unchecked {
        ++id;
      }
    }
    isAuthorBitmap = 0;
    authorIsActiveBitmap = 0;
    numActiveAuthors = 0;
    nextAuthorId = 1;

    _initialiseAuthors(t1Addresses, t1PubKeysLHS, t1PubKeysRHS, t2PubKeys);

    emit LogAuthorsReset();
  }

  function _initialiseRelayers(address[] calldata relayers) private {
    for (uint256 i; i < relayers.length; ) {
      _initialiseRelayer(relayers[i]);

      unchecked {
        ++i;
      }
    }
  }

  function _initialiseRelayer(address relayer) private {
    if (relayer == address(0)) revert AddressIsZero();
    if (relayerBalance[relayer] != 0) revert RelayerAlreadyRegistered();

    relayerBalance[relayer] = 1;

    emit LogRelayerRegistered(relayer);
  }
}
