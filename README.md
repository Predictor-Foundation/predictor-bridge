# PRDCTR Bridge

Upgradeable UUPS bridge contract for transferring ERC-20 assets between Ethereum and PRDCTR Network.

`PRDCTRBridge` is the production UUPS implementation deployed behind an `ERC1967Proxy`. `TestPRDCTRBridge` is the extended test network version that inherits the production logic and adds test-only reset and relayer-initialisation helpers.

## Audit

The PRDCTR Bridge smart contracts have been independently audited by QuillAudits

> **Audit report:** [TBC](https://www.quillaudits.com/)

## Deployments

| Network          | Contract       | Address                      |
| ---------------- | -------------- | ---------------------------- |
| Mainnet | `PRDCTRBridge` | [0x](https://etherscan.io/address/0x) |
| Testnet | `PRDCTRBridge` | [0x783F8dfc8a676fDBe410B7b4413898e1cFe1FB76](https://sepolia.etherscan.io/address/0x783F8dfc8a676fDBe410B7b4413898e1cFe1FB76) |

## Bridge Operations

- **Lift:** lock ERC-20 on Ethereum so it can be represented on PRDCTR Network
- **Lower:** release the locked ERC-20 on Ethereum using an author-confirmed proof of a burn on PRDCTR Network

Bridge security is based on a majority threshold of active PRDCTR Network authors. Authors collectively approve membership changes, publish transaction-checkpoint Merkle roots and authorise lowers.

The owner controls UUPS upgrades, pausing state, and relayer registrations.

## Supported flows

### Lift Variants

| Method                          | User transactions | Caller  | Token                     | T2 Recipient Format                                                |
| ------------------------------- | :---------------: | ------- | ------------------------- | ------------------------------------------------------------------ |
| `lift`                          |         2         | User    | Any ERC-20                | PRDCTR base account | bytes32 `t2PubKey` argument                  |
| `liftPRD`                       |         2         | User    | PRD                       | PRDCTR base account | bytes32 `t2PubKey` argument                  |
| `permitLift`                    |         1         | User    | ERC-2612-compatible token | PRDCTR base account | bytes32 `t2PubKey` argument                  |
| `permitLiftPRD`                 |         1         | User    | PRD                       | PRDCTR base account | bytes32 `t2PubKey` argument                  |
| `predictionMarketLift`          |         2         | User    | USDC or USDT              | Prediction market account | Derived from caller's Ethereum address |
| `predictionMarketPermitLift`    |         1         | User    | USDC                      | Prediction market account | Derived from caller's Ethereum address |
| `predictionMarketRecipientLift` |         2         | User    | USDC or USDT              | Prediction market account | bytes32 `t2PubKey` argument            |
| `relayerLift`                   |         0         | Relayer | USDC                      | Prediction market account | Derived from the user Ethereum address |

### Lowers

| Method         | Purpose                                                                  |
| -------------- | ------------------------------------------------------------------------ |
| `claimLower`   | Release tokens to the recipient in a valid author-confirmed proof.       |
| `relayerLower` | Release USDC and reimburse a registered relayer from the lowered amount. |
| `revertLower`  | Mark a valid lower as reverted and return it to its T2 sender.           |

## Security and operational behaviour

- The bridge requires at least four authors and supports up to 255.
- The confirmation threshold is a strict majority of active authors.
- Lower IDs and T2 transaction IDs are protected against replay.
- User lift entrypoints apply the configured Chainalysis sanctions check.
- Lower eligibility is enforced on PRDCTR Network before proof generation; `claimLower` does not repeat sanctions validation on Ethereum.
- Relayer reimbursement is capped on-chain and priced through the Chainlink USDC/ETH feed.
- Accrued relayer USDC can be swapped to WETH through the configured Uniswap V3 pool and unwrapped to ETH.
- State-changing bridge operations can be paused by the owner.
- A newly deployed production proxy starts **unpaused**. Coordinate monitoring and PRDCTR Network ingestion before deployment.

## Relayers

The PRDCTR Foundation assigns and operates authorised relayers to submit USDC lift and lower transactions on behalf of users, enabling transfers without requiring users to hold native gas tokens.

For each transaction, the relayer service dynamically calculates a fee based on the currnet network fee plus the user's fractional proportion of the cost of the periodic on-chain refunding of the relayer. This fee is deducted from the USDC being lifted or lowered before the remaining amount is credited at the destination.

Relayers are operated on a break-even basis: fees are held on-chain and intended to cover operating costs only, not generate profit.

## Mainnet configuration

Production addresses are defined in `bridge.config.js`.

| Dependency                | Address                                                                                                               |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Chainlink USDC/ETH feed   | [0x986b5E1e1755e3C2440e960477f25201B0a8bbD4](https://etherscan.io/address/0x986b5E1e1755e3C2440e960477f25201B0a8bbD4) |
| Uniswap V3 USDC/WETH pool | [0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640](https://etherscan.io/address/0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640) |
| Chainalysis sanctions     | [0x40C57923924B5c5c5455c48D93317139ADDaC8fb](https://etherscan.io/address/0x40C57923924B5c5c5455c48D93317139ADDaC8fb) |
| PRD                       | [0xc84782858B7Bef5d25182Dbac956A6Aa463AeFE5](https://etherscan.io/address/0xc84782858B7Bef5d25182Dbac956A6Aa463AeFE5) |
| USDC                      | [0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48](https://etherscan.io/address/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48) |
| USDT                      | [0xdAC17F958D2ee523a2206206994597C13D831ec7](https://etherscan.io/address/0xdAC17F958D2ee523a2206206994597C13D831ec7) |
| WETH                      | [0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2](https://etherscan.io/address/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2) |

## Development

### Requirements

- Node.js 22 or later
- npm
- A Ledger device for the configured hardware-wallet deployment paths

Install the dependencies:

```bash
npm ci
```

Local tests do not require an `.env` file.

```bash
npm test
npm run coverage
npm run gas
```

Format JavaScript, JSON, Solidity and Markdown:

```bash
npm run format
```

The production build uses Solidity 0.8.36, the IR pipeline and 100,000 optimiser runs.

## Environment variables

Create a local `.env` only when using a remote network:

```dotenv
ETHERSCAN_API_KEY=

SEPOLIA_RPC_URL=
SEPOLIA_LEDGER_ADDRESS=
SEPOLIA_PRIVATE_KEY=

MAINNET_RPC_URL=
MAINNET_LEDGER_ADDRESS=
```

- Sepolia uses `SEPOLIA_LEDGER_ADDRESS` when present and otherwise falls back to `SEPOLIA_PRIVATE_KEY`.
- Mainnet accepts only the Ledger account configured by `MAINNET_LEDGER_ADDRESS`.
- Hardhat validates chain ID `1` for mainnet and `11155111` for Sepolia.
- Never commit or distribute `.env`.

## Deployment configuration

`bridge.config.js` contains `dev`, `testnet` and `mainnet` environments.

Common fields:

| Field       | Purpose                                          |
| ----------- | ------------------------------------------------ |
| `owner`     | Initial proxy owner                              |
| `feed`      | Chainlink-compatible USDC/ETH feed               |
| `pool`      | Uniswap V3-compatible USDC/WETH pool             |
| `sanctions` | Chainalysis-compatible sanctions contract        |
| `prd`       | PRD token                                        |
| `usdc`      | USDC token                                       |
| `usdt`      | USDT token                                       |
| `weth`      | WETH contract                                    |
| `authors`   | Initial T1 addresses, T1 public keys and T2 keys |

Dev and testnet environments may additionally define a deployed test `bridge`, an extra test token (`tok`) and initial `relayers`.

For `TestPRDCTRBridge`, `feed`, `pool`, `sanctions` and `weth` must either all be unset or all reference the same `TestPRDCTRBridgeHelper`.

## Deploying `PRDCTRBridge`

The core deployment script validates the selected environment, estimates each deployment transaction with a 20% gas buffer, deploys the implementation contract and an initialised proxy, verifies both contracts on Etherscan and submits the proxy-link request.

Ethereum mainnet:

```bash
npm run deploy:bridge:mainnet
```

Sepolia using the `testnet` production-bridge configuration:

```bash
npm run deploy:bridge:testnet
```

The production initializer seeds the author set and assigns ownership. It does not register relayers; the owner must register them separately after deployment.

### Mainnet preflight

Before running the mainnet command:

1. Confirm the reviewed commit and dependency lockfile.
2. Confirm the mainnet RPC resolves to chain ID `1`.
3. Verify all immutable dependency addresses in `bridge.config.js`.
4. Verify the owner and every initial author T1/T2 key out of band.
5. Confirm the Ledger address and the address displayed on the device.
6. Confirm the deployment account has sufficient ETH.
7. Ensure monitoring and PRDCTR Network ingestion are ready before the unpaused proxy is created.
8. Run the full tests and mainnet-fork relayer measurement.

## Deploying the test bridge

`TestPRDCTRBridge` and `TestPRDCTRBridgeHelper` are for Sepolia only:

```bash
npm run deploy:test-bridge:dev
npm run deploy:test-bridge:testnet
```

The config-driven script deploys missing test tokens, helper and test bridge contracts; initialises authors, relayers and ownership; verifies the contracts; and writes deployed addresses back to `bridge.config.js`.

The test bridge adds:

- `resetState(lastLowerId, lastT2TxId, rootHashes)`
- `resetAuthors(t1Addresses, t1PubKeysLHS, t1PubKeysRHS, t2PubKeys)`

Its constructor rejects Ethereum mainnet (`block.chainid == 1`).

## Implementation-only deployments

These commands deploy and verify a new implementation. They do not upgrade an existing proxy.

```bash
npm run deploy:bridge-implementation:mainnet
npm run deploy:bridge-implementation:testnet
npm run deploy:test-bridge-implementation:dev
npm run deploy:test-bridge-implementation:testnet
```

Before any upgrade, confirm:

- storage changes are append-only
- inheritance order remains compatible
- initializer and reinitializer use is correct
- immutable constructor arguments match the target environment
- `_authorizeUpgrade` remains owner-protected
- the new implementation is verified and independently reviewed

The proxy owner performs the upgrade separately, for example through `upgradeToAndCall`.

## Relayer gas calibration

The mainnet-fork script deploys a fresh bridge against live mainnet dependencies and measures standard and refund-triggering relayer calls across fresh and existing account scenarios:

```bash
MAINNET_RPC_URL="https://..." npm run measure:relayer-gas
```

Useful overrides:

```dotenv
MAINNET_FORK_BLOCK_NUMBER=25452384
SAMPLES=300
REFUND_SAMPLES=20
REFUND_ACCRUAL_CALLS=20
SELECTED_REFUND_FREQUENCY=20
HEADROOM_BPS=12500
MEASUREMENT_TX_GAS_LIMIT=5000000
```

Suggested caps use the maximum standard-call gas plus amortised refund overhead and configured headroom. Reports are written to `relayer-gas-report-*.json` and are ignored by Git.

Treat the reported recommendation as a release gate: either confirm the committed constants are acceptable for the measured result or update and re-review them. Changing either cap changes the production bytecode.

## Release checklist

- [ ] Reviewed commit and source hashes recorded
- [ ] `npm ci` completes from the committed lockfile
- [ ] `npm test` passes
- [ ] Coverage and gas reports reviewed
- [ ] Full mainnet-fork relayer measurement reviewed
- [ ] Measured recommendation is compatible with the committed relayer gas caps
- [ ] Mainnet owner and author keys independently confirmed
- [ ] Mainnet dependency addresses independently confirmed
- [ ] RPC chain ID, Ledger address and deployer balance confirmed
- [ ] Etherscan API access confirmed
- [ ] Monitoring, relayers and incident-response signers ready
- [ ] Deployed implementation, proxy, owner and immutable values checked on-chain

## License

MIT
