import '@nomicfoundation/hardhat-verify';
import { defineConfig } from 'hardhat/config';
import hardhatToolboxMochaEthers from '@nomicfoundation/hardhat-toolbox-mocha-ethers';
import hardhatLedgerPlugin from '@nomicfoundation/hardhat-ledger';
import dotenv from 'dotenv';

dotenv.config();

const { MAINNET_LEDGER_ADDRESS, MAINNET_RPC_URL, SEPOLIA_PRIVATE_KEY, SEPOLIA_RPC_URL, ETHERSCAN_API_KEY } = process.env;

const GWEI = 1e9;

export default defineConfig({
  plugins: [hardhatToolboxMochaEthers, hardhatLedgerPlugin],
  solidity: {
    compilers: [
      {
        version: '0.8.35',
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
    mainnetFork: {
      type: 'edr-simulated',
      chainId: 1,
      forking: {
        url: MAINNET_RPC_URL,
        ...(process.env.MAINNET_FORK_BLOCK_NUMBER ? { blockNumber: Number(process.env.MAINNET_FORK_BLOCK_NUMBER) } : {})
      },
      accounts: {
        accountsBalance: '5000000000000000000000000'
      }
    },
    sepolia: {
      type: 'http',
      url: SEPOLIA_RPC_URL,
      accounts: SEPOLIA_PRIVATE_KEY ? [SEPOLIA_PRIVATE_KEY] : [],
      maxFeePerGas: 1 * GWEI,
      maxPriorityFeePerGas: 1 * GWEI
    },
    mainnet: {
      type: 'http',
      url: MAINNET_RPC_URL,
      ledgerAccounts: MAINNET_LEDGER_ADDRESS ? [MAINNET_LEDGER_ADDRESS] : [],
      maxFeePerGas: 5 * GWEI,
      maxPriorityFeePerGas: 2 * GWEI,
      timeout: 1200000
    }
  }
});
