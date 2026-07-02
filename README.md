# Predictor Bridge
Upgradeable Ethereum bridge contract for moving ERC-20 assets between Ethereum and Predictor Network.

The bridge is secured by a threshold of Predictor Network authors, who collectively:
- approve author set changes
- publish transaction checkpoints as Merkle roots
- authorise token releases back to Ethereum

The contract supports standard ERC-20 bridging, permit-based lifts, and sponsored USDC bridge actions via relayers.

## Deployment Addresses

### Testnet

#### Contracts

| Contract | Address |
|---|---|
| Predictor Bridge | [0x83478B43A9809Ecfc86cb063C733ECdee074EF72](https://sepolia.etherscan.io/address/0x83478B43A9809Ecfc86cb063C733ECdee074EF72) |
| Relayer USDC / Helper | [0xA6B8979480263424C74d64EcFC552c39Fe3a03f3](https://sepolia.etherscan.io/address/0xA6B8979480263424C74d64EcFC552c39Fe3a03f3) |
| Dummy USDT | [0xc25EEEDd37b9BE1d9a186d31F6280e6B6dc0092e](https://sepolia.etherscan.io/address/0xc25EEEDd37b9BE1d9a186d31F6280e6B6dc0092e) |

#### Authors

| Author | Address |
|---|---|
| Author 1 | [0x073411c96F59ef379DE620fd3226eA3f222af1b9](https://sepolia.etherscan.io/address/0x073411c96F59ef379DE620fd3226eA3f222af1b9) |
| Author 2 | [0xE43ce3aEF589a1c413A4213F9937Ac60D341d214](https://sepolia.etherscan.io/address/0xE43ce3aEF589a1c413A4213F9937Ac60D341d214) |
| Author 3 | [0xee2238986aE9C2D104cd11a3e2165c4684580eF9](https://sepolia.etherscan.io/address/0xee2238986aE9C2D104cd11a3e2165c4684580eF9) |
| Author 4 | [0xF6D4696405B4D6971bb0532cf5e76774259575aA](https://sepolia.etherscan.io/address/0xF6D4696405B4D6971bb0532cf5e76774259575aA) |
| Author 5 | [0xF45337E8A2ffE96809B71a6D6Be186985457f6bB](https://sepolia.etherscan.io/address/0xF45337E8A2ffE96809B71a6D6Be186985457f6bB) |

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
| Predictor Bridge | [0x9E48A438Bbc37BbFfd6dA72DF7b28d170e3E3685](https://sepolia.etherscan.io/address/0x9E48A438Bbc37BbFfd6dA72DF7b28d170e3E3685) |
| Dummy PRD | [0xDF1E384d36A6EE55a1b3c89bF6ec720fC5c611EB](https://sepolia.etherscan.io/address/0xDF1E384d36A6EE55a1b3c89bF6ec720fC5c611EB) |
| Relayer USDC / Helper | [0x9271D49FC2467419cad65Dd405baDc60d989c75A](https://sepolia.etherscan.io/address/0x9271D49FC2467419cad65Dd405baDc60d989c75A) |
| Dummy USDT | [0xb7E2e5A4161036Af058336F07ADAbC9aE932FCf5](https://sepolia.etherscan.io/address/0xb7E2e5A4161036Af058336F07ADAbC9aE932FCf5) |


#### Authors

| Author | Address |
|---|---|
| Author 1 | [0xcc66EC55E0cdF70e1549beBE969e5988603Ef960](https://sepolia.etherscan.io/address/0xcc66EC55E0cdF70e1549beBE969e5988603Ef960) |
| Author 2 | [0x890E39BaF40792D0Df2582c7C232CE4a8D5Bf965](https://sepolia.etherscan.io/address/0x890E39BaF40792D0Df2582c7C232CE4a8D5Bf965) |
| Author 3 | [0x2cC51c7b7b795088Ac10c06cDfc0593a821d3C55](https://sepolia.etherscan.io/address/0x2cC51c7b7b795088Ac10c06cDfc0593a821d3C55) |
| Author 4 | [0x548e68b384fd8Ac91C88Ad16Cb919b24d7afed52](https://sepolia.etherscan.io/address/0x548e68b384fd8Ac91C88Ad16Cb919b24d7afed52) |

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
| `liftPRD`                       | 2                | User    | PRD                | Explicit `bytes32`          | Base account      |
| `permitLift`                    | 1                | User    | Any EIP-2612 ERC20 | Explicit `bytes32`          | Base account      |
| `permitLiftPRD`                 | 1                | User    | PRD                | Explicit `bytes32`          | Base account      |
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
  - `PRD`: [0x50Ce6df72cFFCA748c2D9Cf80F1af693C36d176c](https://etherscan.io/address/0x50Ce6df72cFFCA748c2D9Cf80F1af693C36d176c)  
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

`npm run deploy:bridge:dev`

`npm run deploy:bridge:testnet`

`npm run deploy:bridge:mainnet`

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

`npm run deploy:implementation:dev`

`npm run deploy:implementation:testnet`

`npm run deploy:implementation:mainnet`

### Result
- New bridge implementation deployed and verified on Etherscan
- Implementation configured with owner wallet and contract addresses specified in `bridge.config.js`
- New implementation address emitted for owner to pass to `upgradeToAndCall` on the proxy
