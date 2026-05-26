# Predictor Bridge
Upgradeable Ethereum bridge contract for moving ERC-20 assets between Ethereum and Predictor Network.

The bridge is secured by a threshold of Predictor Network authors, who collectively:
- approve author set changes
- publish transaction checkpoints as Merkle roots
- authorise token releases back to Ethereum

The contract supports standard ERC-20 bridging, permit-based lifts, and sponsored USDC bridge actions via relayers.

## Contracts

| Contract | Network | Environment | Address |
|---|---|---:|---|
| Predictor Bridge | Mainnet | Production | TBD |
| Predictor Bridge | Sepolia | Testnet | [0xb2f7839A438aD5FF4C99cac855380f2B4D147ea1](https://sepolia.etherscan.io/address/0xb2f7839A438aD5FF4C99cac855380f2B4D147ea1) |
| Predictor Bridge | Sepolia | Dev | [0x5e0E8c9Af3e9C4aFd3dB69c450e782f5bE9551b5](https://sepolia.etherscan.io/address/0x5e0E8c9Af3e9C4aFd3dB69c450e782f5bE9551b5) |
| Predictor Bridge (resettable) | Sepolia | Testnet | TBD — paste after first deploy |

## Deployment Addresses

### Testnet

#### Contracts

| Contract | Address |
|---|---|
| Relayer USDC | [0x01519c462044aEBc7bF9a786005880ecE32AfeeF](https://sepolia.etherscan.io/address/0x01519c462044aEBc7bF9a786005880ecE32AfeeF) |
| Dummy USDT | [0x904E2E61E71d186418511A37a6C6D022d69344f4](https://sepolia.etherscan.io/address/0x904E2E61E71d186418511A37a6C6D022d69344f4) |
| Predictor Bridge | [0xb2f7839A438aD5FF4C99cac855380f2B4D147ea1](https://sepolia.etherscan.io/address/0xb2f7839A438aD5FF4C99cac855380f2B4D147ea1) |

#### Authors

| Author | Address |
|---|---|
| Author 1 | [0x97249Cd69BA44E2F29855a884bC4ff6701d9929d](https://sepolia.etherscan.io/address/0x97249Cd69BA44E2F29855a884bC4ff6701d9929d) |
| Author 2 | [0xdD7a161770D7477644b29d0A3aD7b796A4880ab4](https://sepolia.etherscan.io/address/0xdD7a161770D7477644b29d0A3aD7b796A4880ab4) |
| Author 3 | [0x692a1E365FD302Ad4d598617520ab3D272c50A6E](https://sepolia.etherscan.io/address/0x692a1E365FD302Ad4d598617520ab3D272c50A6E) |
| Author 4 | [0x6B1D580fe8DdA058Fa2905D2a3d792a95bF5379A](https://sepolia.etherscan.io/address/0x6B1D580fe8DdA058Fa2905D2a3d792a95bF5379A) |
| Author 5 | [0xee608Bd42D2A41919f7F93645b040F3eC5E1670b](https://sepolia.etherscan.io/address/0xee608Bd42D2A41919f7F93645b040F3eC5E1670b) |

#### Relayers

| Relayer | Address |
|---|---|
| Relayer 1 | [0xe7BBa60d3352CbAa7e1e1A7487183c68B82A35b2](https://sepolia.etherscan.io/address/0xe7BBa60d3352CbAa7e1e1A7487183c68B82A35b2) |
| Relayer 2 | [0xdf2918dE413E2Cd1C3dbb972c8377C063E6F092c](https://sepolia.etherscan.io/address/0xdf2918dE413E2Cd1C3dbb972c8377C063E6F092c) |
| Relayer 3 | [0x40aF08546D41E119db1f70744ef4bE485Be7Cb2A](https://sepolia.etherscan.io/address/0x40aF08546D41E119db1f70744ef4bE485Be7Cb2A) |

### Dev

#### Contracts

| Contract | Address |
|---|---|
| Relayer USDC | [0x73B338B277E82f05E74487E321B2e588A0d4E4E3](https://sepolia.etherscan.io/address/0x73B338B277E82f05E74487E321B2e588A0d4E4E3) |
| Dummy USDT | [0xC737a683Cf220E46f42577cd8e950ce69AfE2D94](https://sepolia.etherscan.io/address/0xC737a683Cf220E46f42577cd8e950ce69AfE2D94) |
| Predictor Bridge | [0x5e0E8c9Af3e9C4aFd3dB69c450e782f5bE9551b5](https://sepolia.etherscan.io/address/0x5e0E8c9Af3e9C4aFd3dB69c450e782f5bE9551b5) |

#### Authors

| Author | Address |
|---|---|
| Author 1 | [0x0f1dC3B7e07a8E198A70Ae2e167cA54EF4c21635](https://sepolia.etherscan.io/address/0x0f1dC3B7e07a8E198A70Ae2e167cA54EF4c21635) |
| Author 2 | [0xEC70c92A562DDDf75EfB4b2A922EEA338FED0D21](https://sepolia.etherscan.io/address/0xEC70c92A562DDDf75EfB4b2A922EEA338FED0D21) |
| Author 3 | [0x8d1423c9ab168147f0a853098E738b2F8f462Ba2](https://sepolia.etherscan.io/address/0x8d1423c9ab168147f0a853098E738b2F8f462Ba2) |
| Author 4 | [0x430E61B21E45aB66877E0af3d10302cBf60f754C](https://sepolia.etherscan.io/address/0x430E61B21E45aB66877E0af3d10302cBf60f754C) |
| Author 5 | [0xe639bdf2779b5D31e840A02F7AFf20bF5a4f3567](https://sepolia.etherscan.io/address/0xe639bdf2779b5D31e840A02F7AFf20bF5a4f3567) |

#### Relayers

| Relayer | Address |
|---|---|
| Relayer 1 | [0xCaf887dC7dB6B4b44D9a97e46998Ca4dB6f767Ea](https://sepolia.etherscan.io/address/0xCaf887dC7dB6B4b44D9a97e46998Ca4dB6f767Ea) |
| Relayer 2 | [0x29cB5A57D62bA22bbb6a5Efe3fD520F03c840291](https://sepolia.etherscan.io/address/0x29cB5A57D62bA22bbb6a5Efe3fD520F03c840291) |
| Relayer 3 | [0xA39239acB1E7faA1419482e767A1195b1f81F82c](https://sepolia.etherscan.io/address/0xA39239acB1E7faA1419482e767A1195b1f81F82c) |

## Bridge overview
The bridge operates in two directions:

- **Lift**: tokens are transferred into the bridge on Ethereum and represented on Predictor Network for the chosen T2 recipient.
- **Lower**: proof of token burn on Predictor Network is supplied to the bridge, which then releases the corresponding tokens on Ethereum.

## Features
- Upgradeable UUPS bridge deployed behind an `ERC1967Proxy`
- Author-managed security model with threshold confirmations
- Author addition, activation, and removal by consensus
- Merkle root publication by consensus
- ERC-20 lifts and lowers between Ethereum and Predictor Network
- Permit-based lifting for tokens supporting ERC-2612
- Sponsored USDC lifts and lowers through registered relayers
- Chainalysis sanctions checks on supported user entrypoints

## Lift methods

| Method                          | User TX Required | Caller  | Allowed Tokens     | Destination Account Format  | Account Type      |
|---------------------------------|:----------------:|:-------:|--------------------|-----------------------------|-------------------|
| `lift`                          | 2                | User    | Any ERC20          | Explicit `bytes32`          | Base account      |
| `permitLift`                    | 1                | User    | Any EIP-2612 ERC20 | Explicit `bytes32`          | Base account      |
| `predictionMarketLift`          | 2                | User    | USDC / USDT        | Derived from caller address | Prediction market |
| `predictionMarketPermitLift`    | 1                | User    | USDC               | Derived from caller address | Prediction market |
| `predictionMarketRecipientLift` | 2                | User    | USDC / USDT        | Explicit `bytes32`          | Prediction market |
| `relayerLift`                   | 0                | Relayer | USDC               | Derived from user address   | Prediction market |

## External Contract Dependencies
- Chainlink USDC/ETH Feed\
`CHAINLINK_USDC_ETH_FEED`: [0x986b5E1e1755e3C2440e960477f25201B0a8bbD4](https://etherscan.io/address/0x986b5E1e1755e3C2440e960477f25201B0a8bbD4)

- Uniswap V3 USDC/WETH Pool\
`UNISWAP_V3_USDC_WETH_POOL`: [0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640](https://etherscan.io/address/0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640)

- Chainalysis Sanctions\
`CHAINALYSIS_SANCTIONS`: [0x40C57923924B5c5c5455c48D93317139ADDaC8fb](https://etherscan.io/address/0x40C57923924B5c5c5455c48D93317139ADDaC8fb)

- Tokens  
  - `USDC`: [0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48](https://etherscan.io/address/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48)
  - `USDT`: [0xdAC17F958D2ee523a2206206994597C13D831ec7](https://etherscan.io/address/0xdAC17F958D2ee523a2206206994597C13D831ec7)
  - `WETH`: [0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2](https://etherscan.io/address/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2)

## Development

### Setup
`npm i`

#### Unit Tests
`npm run test`

#### Test Coverage
`npm run coverage`

#### Gas Report
`npm run gas`

## Initial Deployment
Deploys the persistent proxy contract and its initial implementation contract.

### Prerequisites
- Ensure `bridge.config.js` is populated correctly for the target environment
- Create a `.env` file with the following values completed:

ETHERSCAN_API_KEY=  
SEPOLIA_RPC_URL=  
SEPOLIA_PRIVATE_KEY=  
MAINNET_RPC_URL=  
MAINNET_LEDGER_ADDRESS=  

### Commands
npm run deploy:bridge:dev
npm run deploy:bridge:testnet
npm run deploy:bridge:mainnet

## Resettable Variant (Sepolia only)
`PredictorBridgeResettable` is a subclass of the production bridge that adds two owner-gated reset functions for use between test runs. Production behaviour is inherited unchanged. Owner is preserved across both calls.

- `resetState(lastLowerId, lastT2TxId, rootHashes)` wipes per-run sparse state. Lower ids and T2 tx ids are issued consecutively, so the caller passes only the highest id seen during the run and the contract clears every bitmap bucket up to it. Published root hashes have no on-chain enumeration and are passed explicitly. Bumps `resetNonce` and emits `LogReset(nonce)`. Author set and relayer balances are untouched — use the existing `registerRelayer` / `deregisterRelayer` to manage relayers.
- `resetAuthors(t1Addresses, t1PubKeysLHS, t1PubKeysRHS, t2PubKeys)` clears the existing author set (the contract enumerates it via `nextAuthorId`) and re-seeds with the supplied authors. Emits `LogAuthorsReset()`.

### Deploy
`npm run deploy:bridge:testnet:resettable`

The script reuses `deploy/deploy-bridge.js` with `BRIDGE_CONTRACT=PredictorBridgeResettable`. The deployed proxy address is permanent — paste it into the contracts table above after the first deploy.

### Result
- Persistent proxy deployed and verified on Etherscan
- Storage initialised with authors specified in `bridge.config.js`
- Bridge implementation deployed and verified on Etherscan
- Implementation configured with owner wallet and contract addresses specified in `bridge.config.js`

## Upgrading
Deploys a new implementation contract to upgrade the proxy to.

### Prerequisites
Ensure the new implementation is upgrade-safe:
- Storage layout is strictly append-only (no reordering, removal, or type changes)
- No constructor logic relied upon (only immutables are allowed)
- Initializer/reinitializer usage is correct (no accidental re-initialisation)
- Inheritance order remains consistent
- `UUPSUpgradeable` is still correctly implemented with `_authorizeUpgrade`

### Commands
npm run deploy:implementation:dev
npm run deploy:implementation:testnet
npm run deploy:implementation:mainnet

### Result
- New bridge implementation deployed and verified on Etherscan
- Implementation configured with owner wallet and contract addresses specified in `bridge.config.js`
- New implementation address emitted for owner to pass to `upgradeToAndCall` on the proxy
