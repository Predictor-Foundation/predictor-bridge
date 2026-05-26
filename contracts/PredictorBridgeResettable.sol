// SPDX-License-Identifier: MIT
pragma solidity 0.8.34;

import './PredictorBridge.sol';

/**
 * @dev Testnet-only variant of PredictorBridge that adds owner-gated resets for use between test runs.
 * Production behaviour is inherited unchanged.
 */
contract PredictorBridgeResettable is PredictorBridge {
  event LogReset(uint32 indexed nonce);
  event LogAuthorsReset();

  uint32 public resetNonce;

  constructor(address feed, address pool, address sanctions, address usdc, address usdt, address weth) PredictorBridge(feed, pool, sanctions, usdc, usdt, weth) {}

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
      emit LogReset(++resetNonce);
    }
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
}
