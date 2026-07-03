# Predictor Bridge

Upgradeable Ethereum bridge contract for moving ERC-20 assets between Ethereum and Predictor Network.

The production bridge is `PredictorBridge`. Dev and testnet deployments use `TestPredictorBridge`, a non-mainnet wrapper around the audited bridge that adds test reset helpers and registers relayers during initialization without changing the production contract.

## Overview

The bridge operates in two directions:

- **Lift**: tokens are transferred into the bridge on Ethereum and represented on Predictor Network for the selected T2 recipient.
- **Lower**: proof of token burn on Predictor Network is supplied to the bridge, which releases the corresponding tokens on Ethereum.

The bridge is secured by a threshold of Predictor Network authors, who collectively approve author set changes, publish transaction checkpoints as Merkle roots, and authorise token releases back to Ethereum.

## Features

- UUPS-upgradeable bridge deployed behind an `ERC1967Proxy`
- Author-managed threshold confirmation model
- ERC-20 lifts and lowers between Ethereum and Predictor Network
- ERC-2612 permit-based lifting for supported tokens
- PRD-specific permit lifting via `permitLiftPRD`
- Prediction-market lifts for USDC / USDT
- Sponsored USDC lifts and lowers through registered relayers
- Chainalysis sanctions checks on supported user entrypoints
- Mainnet-only deployment path for `PredictorBridge`
- Dev/testnet deployment path using `TestPredictorBridge` and `TestPredictorBridgeHelper`

## Lift methods

| Method                          | User TX Required | Caller  | Allowed Tokens      | Destination Account Format  | Account Type      |
| ------------------------------- | :--------------: | :-----: | ------------------- | --------------------------- | ----------------- |
| `lift`                          |        2         |  User   | Any ERC-20          | Explicit `bytes32`          | Base account      |
| `liftPRD`                       |        2         |  User   | PRD                 | Explicit `bytes32`          | Base account      |
| `permitLift`                    |        1         |  User   | Any EIP-2612 ERC-20 | Explicit `bytes32`          | Base account      |
| `permitLiftPRD`                 |        1         |  User   | PRD                 | Explicit `bytes32`          | Base account      |
| `predictionMarketLift`          |        2         |  User   | USDC / USDT         | Derived from caller address | Prediction market |
| `predictionMarketPermitLift`    |        1         |  User   | USDC                | Derived from caller address | Prediction market |
| `predictionMarketRecipientLift` |        2         |  User   | USDC / USDT         | Explicit `bytes32`          | Prediction market |
| `relayerLift`                   |        0         | Relayer | USDC                | Derived from user address   | Prediction market |

## External mainnet dependencies

Mainnet deployments use real external contracts from `bridge.config.js`.

| Dependency                | Address                                                                                                               |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Chainlink USDC/ETH Feed   | [0x986b5E1e1755e3C2440e960477f25201B0a8bbD4](https://etherscan.io/address/0x986b5E1e1755e3C2440e960477f25201B0a8bbD4) |
| Uniswap V3 USDC/WETH Pool | [0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640](https://etherscan.io/address/0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640) |
| Chainalysis Sanctions     | [0x40C57923924B5c5c5455c48D93317139ADDaC8fb](https://etherscan.io/address/0x40C57923924B5c5c5455c48D93317139ADDaC8fb) |
| PRD                       | [0x50Ce6df72cFFCA748c2D9Cf80F1af693C36d176c](https://etherscan.io/address/0x50Ce6df72cFFCA748c2D9Cf80F1af693C36d176c) |
| USDC                      | [0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48](https://etherscan.io/address/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48) |
| USDT                      | [0xdAC17F958D2ee523a2206206994597C13D831ec7](https://etherscan.io/address/0xdAC17F958D2ee523a2206206994597C13D831ec7) |
| WETH                      | [0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2](https://etherscan.io/address/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2) |

## Development

Install dependencies:

```bash
npm i
```

Run tests:

```bash
npm run test
```

Coverage:

```bash
npm run coverage
```

Gas report:

```bash
npm run gas
```

Formatting:

```bash
npm run format
```

## Environment variables

Create a local `.env` file before deploying.

```bash
ETHERSCAN_API_KEY=
SEPOLIA_RPC_URL=
SEPOLIA_PRIVATE_KEY=
MAINNET_RPC_URL=
MAINNET_LEDGER_ADDRESS=
```

Sepolia deployments use `SEPOLIA_PRIVATE_KEY`. Mainnet deployments are configured to use the Ledger account specified by `MAINNET_LEDGER_ADDRESS`.

Do not commit or share `.env`.

## Configuration

Deployment configuration lives in `bridge.config.js` and is keyed by environment:

- `dev`
- `testnet`
- `mainnet`

Common fields:

| Field       | Purpose                                           |
| ----------- | ------------------------------------------------- |
| `owner`     | Owner passed to the bridge initializer            |
| `feed`      | Chainlink-compatible USDC/ETH feed address        |
| `pool`      | Uniswap V3-compatible USDC/WETH pool address      |
| `sanctions` | Chainalysis-compatible sanctions contract address |
| `prd`       | PRD token address                                 |
| `usdc`      | USDC token address                                |
| `usdt`      | USDT token address                                |
| `weth`      | WETH-compatible contract address                  |
| `authors`   | Initial Predictor Network author set              |

Dev/testnet also use:

| Field      | Purpose                                                 |
| ---------- | ------------------------------------------------------- |
| `bridge`   | Deployed `TestPredictorBridge` proxy address            |
| `tok`      | Extra mock ERC-20 token used for testing non-core lifts |
| `relayers` | Initial relayer set                                     |

For mainnet, all dependencies must be real production addresses and `owner` and `authors` must be populated before deployment.

For dev/testnet, `deploy-test-bridge.js` is config-driven. It deploys any missing mock tokens, helper, or test bridge, then writes the new addresses back to `bridge.config.js`.

Also for dev/testnet the following fields all boil down to a single test contract:

- `feed`
- `pool`
- `sanctions`
- `weth`

Therefore these must either all be empty/zero or all contain the same `TestPredictorBridgeHelper` proxy address.

## Deployment

### Dev/testnet test bridge

Use this for dev or testnet deployments on Sepolia:

```bash
npm run deploy:test-bridge:dev
npm run deploy:test-bridge:testnet
```

The script deploys only what is missing from `bridge.config.js`:

- `TestERC20Permit` PRD mock, if `prd` is empty/zero
- `TestERC20` TOK mock, if `tok` is empty/zero
- `TestERC20Permit` USDC mock, if `usdc` is empty/zero
- `TestERC20` USDT mock, if `usdt` is empty/zero
- `TestPredictorBridgeHelper` implementation/proxy, if `feed/pool/sanctions/weth` are empty/zero
- `TestPredictorBridge` implementation/proxy, if `bridge` is empty/zero

It then:

- initializes `TestPredictorBridge` with authors, relayers, and owner from config
- initializes the helper's bridge address with `helper.initBridge(bridgeProxy)` if needed
- verifies deployed contracts on Etherscan
- submits the Etherscan proxy-link request
- writes the resulting addresses back to `bridge.config.js`

`TestPredictorBridge` cannot be deployed on Ethereum mainnet because its constructor reverts on chain id `1`.

### Mainnet bridge

Mainnet deployment is intentionally separate and only deploys the audited `PredictorBridge` contract.

Before running mainnet deployment:

1. Confirm `bridge.config.js` mainnet dependencies are correct.
2. Populate the production `owner`.
3. Populate the production `authors` array.
4. Confirm relayers are correct. The audited production bridge does not register relayers during initialization, so relayers must be registered by the owner after deployment.
5. Confirm the Ledger address in `.env` matches the intended deployer.
6. Confirm the deployer has enough ETH for deployment and verification transactions.

Then run:

```bash
npm run deploy:bridge:mainnet
```

The script will reject missing zero-address dependencies and an empty author set.

## Test bridge helper

`TestPredictorBridgeHelper` is a Sepolia helper used by dev/testnet bridge deployments.

It provides:

- a Chainlink-compatible `latestRoundData()` response
- a Uniswap V3-compatible `swap(...)` entrypoint
- a WETH-compatible `withdraw(...)` entrypoint
- a Chainalysis-compatible `isSanctioned(address)` mapping
- deployer-initialized `initBridge(address)` for first bridge assignment
- owner-managed `setBridge(address)` override
- owner-managed `setSanctioned(address,bool)` test controls
- immutable references to the deployed test PRD, TOK, USDC, and USDT contracts

Only the configured bridge can call the helper's swap/withdraw paths.

## Test bridge

`TestPredictorBridge` is a non-mainnet subclass of the production bridge used for both `dev` and `testnet`.

It inherits core bridge behaviour and adds:

- an initializer that seeds authors, registers configured relayers, and assigns ownership
- `resetState(lastLowerId, lastT2TxId, rootHashes)` to clear per-run lower IDs, T2 transaction IDs, and explicitly supplied published root hashes
- `resetAuthors(t1Addresses, t1PubKeysLHS, t1PubKeysRHS, t2PubKeys)` to clear and replace the author set

Owner is preserved across reset functions. Relayer state is intentionally not reset by `resetState`; use `registerRelayer` and `deregisterRelayer` to manage relayers after deployment.

Do not use `TestPredictorBridge` on mainnet. The contract enforces this by reverting in the constructor when `block.chainid == 1`.

## Implementation-only deployments

Deploy a new mainnet implementation with:

```bash
npm run deploy:bridge-implementation:mainnet
```

Deploy a new dev/testnet implementation with:

```bash
npm run deploy:test-bridge-implementation:dev
npm run deploy:test-bridge-implementation:testnet
```

Implementation deployment scripts deploy and verify a new implementation using constructor arguments from `bridge.config.js`. They do not upgrade any proxy by themselves.

Before upgrading, confirm:

- storage layout is strictly append-only
- storage variables are not reordered, removed, or type-changed
- inheritance order remains compatible
- initializer/reinitializer usage is correct
- immutable constructor arguments are correct for the target environment
- `_authorizeUpgrade` remains correctly protected
- the new implementation has been verified on Etherscan

After deployment, pass the new implementation address to the existing proxy's owner-controlled upgrade flow, such as `upgradeToAndCall`.

## Verification

Deployment helpers verify both implementations and proxies on Etherscan and then submit the Etherscan proxy-link request.

Verification can lag behind deployment. The helper retries verification to allow time for Etherscan to index newly deployed bytecode.

## Operational checklist

Before production deployment:

- [ ] Mainnet `owner` is populated and correct.
- [ ] Mainnet authors are populated and independently checked.
- [ ] Mainnet PRD, USDC, USDT, WETH, Chainlink, Uniswap, and Chainalysis addresses are checked.
- [ ] Mainnet relayers are known and ready to be registered by the owner after deployment.
- [ ] `.env` contains the intended mainnet RPC URL and Ledger address.
- [ ] Deployment account has enough ETH.
- [ ] `npm run test` passes.
- [ ] `npm run coverage` has been reviewed.
- [ ] The audited production contract source has not been unintentionally changed.

## License

MIT
