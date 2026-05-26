import bridgeConfig from '../bridge.config.js';
import { verifyContract as hardhatVerifyContract } from '@nomicfoundation/hardhat-verify/verify';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const VALID_ENVS = ['dev', 'testnet', 'mainnet'];

function getEnv() {
  const env = process.env.BRIDGE_ENV;

  if (!env) {
    throw new Error('Missing BRIDGE_ENV. Use dev, testnet, or mainnet.');
  }

  if (!VALID_ENVS.includes(env)) {
    throw new Error(`Invalid env "${env}". Use dev, testnet, or mainnet.`);
  }

  return env;
}

function getEnvConfig(env) {
  const cfg = bridgeConfig[env];

  if (!cfg) {
    throw new Error(`Missing config for env "${env}"`);
  }

  return cfg;
}

function checkEnvMatchesNetwork(env, networkName) {
  if (env === 'mainnet' && networkName !== 'mainnet') {
    throw new Error('env=mainnet must be used with mainnet');
  }

  if (env !== 'mainnet' && networkName !== 'sepolia') {
    throw new Error(`env=${env} must be used with sepolia, got ${networkName}`);
  }
}

function assertAddress(name, value) {
  if (!value || value === ZERO_ADDRESS) {
    throw new Error(`Invalid or missing address for "${name}"`);
  }
}

function validateBridgeConfig(env) {
  const { owner, feed, pool, sanctions, usdc, usdt, weth } = getEnvConfig(env);

  assertAddress('owner', owner);
  assertAddress('feed', feed);
  assertAddress('pool', pool);
  assertAddress('sanctions', sanctions);
  assertAddress('usdc', usdc);
  assertAddress('usdt', usdt);
  assertAddress('weth', weth);
}

function validateInitConfig(env) {
  const { authors } = getEnvConfig(env);

  if (!Array.isArray(authors) || authors.length === 0) {
    throw new Error(`No authors configured for env "${env}" in bridge.config.js`);
  }
}

function getBridgeArgs(env) {
  const { feed, pool, sanctions, usdc, usdt, weth } = getEnvConfig(env);
  return [feed, pool, sanctions, usdc, usdt, weth];
}

function getInitArgs(env) {
  const { owner, authors } = getEnvConfig(env);

  return [
    authors.map(author => author.ethAddress),
    authors.map(author => '0x' + author.ethUncompressedPublicKey.slice(4, 68)),
    authors.map(author => '0x' + author.ethUncompressedPublicKey.slice(68, 132)),
    authors.map(author => author.t2PublicKey),
    owner
  ];
}

function getChainId(networkName) {
  if (networkName === 'mainnet') return '1';
  if (networkName === 'sepolia') return '11155111';
  throw new Error(`Unsupported network for Etherscan chain id: ${networkName}`);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function verifyContract(hre, address, constructorArgs, label = address) {
  const maxAttempts = 5;
  const delayMs = 30000;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      if (attempt === 1) {
        console.log(`Waiting 30s before verifying ${label}...`);
      } else {
        console.log(`Retrying verification for ${label} (${attempt}/${maxAttempts}) in 30s...`);
      }

      await sleep(delayMs);

      await hardhatVerifyContract(
        {
          address,
          constructorArgs,
          provider: 'etherscan'
        },
        hre
      );

      console.log(`Verified: ${label}`);
      return;
    } catch (err) {
      const message = String(err?.message || err);

      if (
        message.includes('Already Verified') ||
        message.includes('already verified') ||
        message.includes('already been verified') ||
        message.includes('Contract source code already verified')
      ) {
        console.log(`Already verified: ${label}`);
        return;
      }

      const retryable = message.includes('does not have bytecode') || message.includes('Unable to locate ContractCode at') || message.includes('Contract not deployed');

      if (!retryable || attempt === maxAttempts) {
        throw err;
      }
    }
  }
}

async function verifyProxyOnEtherscan(networkName, proxyAddress) {
  const apiKey = process.env.ETHERSCAN_API_KEY;
  if (!apiKey) {
    throw new Error('Missing ETHERSCAN_API_KEY');
  }

  const chainid = getChainId(networkName);

  console.log('Submitting proxy confirmation to Etherscan...');

  const submitRes = await fetch('https://api.etherscan.io/v2/api', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      apikey: apiKey,
      chainid,
      module: 'contract',
      action: 'verifyproxycontract',
      address: proxyAddress
    })
  });

  const submitJson = await submitRes.json();

  if (submitJson.status !== '1') {
    const msg = String(submitJson.result || submitJson.message || 'Unknown proxy verification error');

    if (msg.toLowerCase().includes('already verified') || msg.toLowerCase().includes('proxy contract is already verified')) {
      console.log(`Proxy already linked on Etherscan: ${proxyAddress}`);
      return;
    }

    throw new Error(`Etherscan proxy verification submit failed: ${msg}`);
  }

  const guid = submitJson.result;

  for (let i = 0; i < 10; i++) {
    await sleep(5000);

    const statusUrl = new URL('https://api.etherscan.io/v2/api');
    statusUrl.searchParams.set('apikey', apiKey);
    statusUrl.searchParams.set('chainid', chainid);
    statusUrl.searchParams.set('module', 'contract');
    statusUrl.searchParams.set('action', 'checkproxyverification');
    statusUrl.searchParams.set('guid', guid);

    const statusRes = await fetch(statusUrl);
    const statusJson = await statusRes.json();
    const result = String(statusJson.result || '');

    if (statusJson.status === '1') {
      console.log(`Proxy linked on Etherscan: ${proxyAddress}`);
      return;
    }

    if (result.toLowerCase().includes('does not seem to be verified') || result.toLowerCase().includes('pending in queue')) {
      continue;
    }

    throw new Error(`Etherscan proxy verification status failed: ${result || statusJson.message}`);
  }

  throw new Error('Timed out waiting for Etherscan proxy verification status');
}

function printBalances(ethers, beforeBalance, afterBalance) {
  const spent = beforeBalance - afterBalance;
  console.log('');
  console.log(`Balance before: ${ethers.formatEther(beforeBalance)} ETH`);
  console.log(`Balance after:  ${ethers.formatEther(afterBalance)} ETH`);
  console.log(`Cost:           ${ethers.formatEther(spent)} ETH`);
}

export {
  checkEnvMatchesNetwork,
  getBridgeArgs,
  getEnv,
  getEnvConfig,
  getInitArgs,
  printBalances,
  validateBridgeConfig,
  validateInitConfig,
  verifyContract,
  verifyProxyOnEtherscan
};
