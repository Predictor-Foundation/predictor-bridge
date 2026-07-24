import '@nomicfoundation/hardhat-verify';
import { defineConfig } from 'hardhat/config';
import hardhatToolboxMochaEthers from '@nomicfoundation/hardhat-toolbox-mocha-ethers';
import hardhatLedgerPlugin from '@nomicfoundation/hardhat-ledger';
import dotenv from 'dotenv';

dotenv.config();

const { MAINNET_LEDGER_ADDRESS, MAINNET_RPC_URL, SEPOLIA_LEDGER_ADDRESS, SEPOLIA_PRIVATE_KEY, SEPOLIA_RPC_URL, ETHERSCAN_API_KEY } = process.env;

export default defineConfig({
  plugins: [hardhatToolboxMochaEthers, hardhatLedgerPlugin],

  solidity: {
    compilers: [
      {
        version: '0.8.36',
        settings: {
          optimizer: {
            enabled: true,
            runs: 100000,
            details: { yul: true }
          },
          viaIR: true
        }
      }
    ],
    npmFilesToBuild: ['@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol']
  },

  verify: {
    etherscan: {
      apiKey: ETHERSCAN_API_KEY || ''
    }
  },

  networks: {
    hardhat: {
      type: 'edr-simulated',
      accounts: {
        accountsBalance: '5000000000000000000000000'
      }
    },

    ...(MAINNET_RPC_URL
      ? {
          mainnetFork: {
            type: 'edr-simulated',
            chainId: 1,
            forking: {
              url: MAINNET_RPC_URL,
              ...(process.env.MAINNET_FORK_BLOCK_NUMBER
                ? {
                    blockNumber: Number(process.env.MAINNET_FORK_BLOCK_NUMBER)
                  }
                : {})
            },
            accounts: {
              accountsBalance: '5000000000000000000000000'
            }
          },

          mainnet: {
            type: 'http',
            chainId: 1,
            url: MAINNET_RPC_URL,
            accounts: [],
            ledgerAccounts: MAINNET_LEDGER_ADDRESS ? [MAINNET_LEDGER_ADDRESS] : [],
            timeout: 1200000
          }
        }
      : {}),

    ...(SEPOLIA_RPC_URL
      ? {
          sepolia: {
            type: 'http',
            chainId: 11155111,
            url: SEPOLIA_RPC_URL,

            ...(SEPOLIA_LEDGER_ADDRESS
              ? {
                  ledgerAccounts: [SEPOLIA_LEDGER_ADDRESS]
                }
              : {
                  accounts: SEPOLIA_PRIVATE_KEY ? [SEPOLIA_PRIVATE_KEY] : []
                })
          }
        }
      : {})
  }
});
