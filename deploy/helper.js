import { writeFile } from 'node:fs/promises';
import { inspect } from 'node:util';
import bridgeConfig from '../bridge.config.js';
import { verifyContract as hardhatVerifyContract } from '@nomicfoundation/hardhat-verify/verify';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const VALID_ENVS = ['dev', 'testnet', 'mainnet'];
const TEST_HELPER_FIELDS = ['feed', 'pool', 'sanctions', 'weth'];

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

function cloneBridgeConfig() {
  return JSON.parse(JSON.stringify(bridgeConfig));
}

async function writeBridgeConfig(config) {
  const configPath = new URL('../bridge.config.js', import.meta.url);
  const renderedConfig = inspect(config, {
    depth: null,
    compact: false,
    breakLength: 160,
    sorted: false
  });

  const body = 'const bridgeConfig = ' + renderedConfig + ';\n\nexport default bridgeConfig;\n';

  await writeFile(configPath, body);
}

function checkEnvMatchesNetwork(env, networkName) {
  if (env === 'mainnet' && networkName !== 'mainnet') {
    throw new Error('env=mainnet must be used with mainnet');
  }

  if (env !== 'mainnet' && networkName !== 'sepolia') {
    throw new Error(`env=${env} must be used with sepolia, got ${networkName}`);
  }
}

function isSetAddress(value) {
  return typeof value === 'string' && value.trim() !== '' && value !== ZERO_ADDRESS;
}

function assertAddress(name, value) {
  if (!isSetAddress(value)) {
    throw new Error(`Invalid or missing address for "${name}"`);
  }
}

function assertAddressArray(name, values, allowEmpty = false) {
  if (!Array.isArray(values) || (!allowEmpty && values.length === 0)) {
    throw new Error(`Invalid or missing address array for "${name}"`);
  }

  for (const [index, value] of values.entries()) {
    assertAddress(`${name}[${index}]`, value);
  }
}

function validateBridgeConfig(env) {
  const { owner, feed, pool, sanctions, prd, usdc, usdt, weth } = getEnvConfig(env);

  assertAddress('owner', owner);
  assertAddress('feed', feed);
  assertAddress('pool', pool);
  assertAddress('sanctions', sanctions);
  assertAddress('prd', prd);
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

function validateTestBridgeConfig(env) {
  if (env === 'mainnet') {
    throw new Error('Test bridge config is only valid for dev/testnet');
  }

  const { owner, authors, relayers } = getEnvConfig(env);

  assertAddress('owner', owner);
  validateInitConfig(env);
  assertAddressArray('relayers', relayers ?? [], true);

  for (const [index, author] of authors.entries()) {
    assertAddress(`authors[${index}].ethAddress`, author.ethAddress);

    if (!author.ethUncompressedPublicKey || !author.ethUncompressedPublicKey.startsWith('0x04') || author.ethUncompressedPublicKey.length !== 132) {
      throw new Error(`Invalid authors[${index}].ethUncompressedPublicKey`);
    }

    if (!author.t2PublicKey || !author.t2PublicKey.startsWith('0x') || author.t2PublicKey.length !== 66) {
      throw new Error(`Invalid authors[${index}].t2PublicKey`);
    }
  }
}

function getBridgeArgs(env) {
  const { feed, pool, sanctions, prd, usdc, usdt, weth } = getEnvConfig(env);
  return [feed, pool, sanctions, prd, usdc, usdt, weth];
}

function buildInitArgs(cfg) {
  const { owner, authors } = cfg;

  return [
    authors.map(author => author.ethAddress),
    authors.map(author => '0x' + author.ethUncompressedPublicKey.slice(4, 68)),
    authors.map(author => '0x' + author.ethUncompressedPublicKey.slice(68, 132)),
    authors.map(author => author.t2PublicKey),
    owner
  ];
}

function buildTestBridgeInitArgs(cfg) {
  const baseArgs = buildInitArgs(cfg);
  return [...baseArgs, cfg.relayers ?? []];
}

function getInitArgs(env) {
  return buildInitArgs(getEnvConfig(env));
}

function getTestBridgeInitArgs(env) {
  return buildTestBridgeInitArgs(getEnvConfig(env));
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

async function verifyProxyOnEtherscan(networkName, proxyAddress, expectedImplementation) {
  const apiKey = process.env.ETHERSCAN_API_KEY;
  if (!apiKey) {
    throw new Error('Missing ETHERSCAN_API_KEY');
  }

  const chainid = getChainId(networkName);

  console.log(`Submitting proxy confirmation to Etherscan with chainid=${chainid}...`);

  const submitUrl = new URL('https://api.etherscan.io/v2/api');
  submitUrl.searchParams.set('apikey', apiKey);
  submitUrl.searchParams.set('chainid', chainid);
  submitUrl.searchParams.set('module', 'contract');
  submitUrl.searchParams.set('action', 'verifyproxycontract');
  submitUrl.searchParams.set('address', proxyAddress);

  if (expectedImplementation) {
    submitUrl.searchParams.set('expectedimplementation', expectedImplementation);
  }

  const submitRes = await fetch(submitUrl, { method: 'POST' });
  const submitJson = await submitRes.json();

  if (submitJson.status !== '1') {
    const msg = String(submitJson.result || submitJson.message || 'Unknown proxy verification error');
    const lowerMsg = msg.toLowerCase();

    if (lowerMsg.includes('already verified') || lowerMsg.includes('proxy contract is already verified') || lowerMsg.includes('already linked')) {
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
    const lowerResult = result.toLowerCase();

    if (statusJson.status === '1') {
      console.log(`Proxy linked on Etherscan: ${proxyAddress}`);
      return;
    }

    if (
      lowerResult.includes('does not seem to be verified') ||
      lowerResult.includes('pending in queue') ||
      lowerResult.includes('already verified') ||
      lowerResult.includes('already linked')
    ) {
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

async function deployVerifiedContract(hre, ethers, contractName, constructorArgs, label) {
  const Contract = await ethers.getContractFactory(contractName);
  const contract = await Contract.deploy(...constructorArgs);
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  await verifyContract(hre, address, constructorArgs, label);

  return { contract, address };
}

async function deployTestERC20(hre, ethers, { name, symbol, decimals, owner, supply }) {
  const parsedSupply = ethers.parseUnits(String(supply), decimals);
  return deployVerifiedContract(hre, ethers, 'TestERC20', [name, symbol, decimals, owner, parsedSupply], `${symbol} TestERC20`);
}

async function deployTestERC20Permit(hre, ethers, { name, symbol, decimals, owner, supply }) {
  const parsedSupply = ethers.parseUnits(String(supply), decimals);
  return deployVerifiedContract(hre, ethers, 'TestERC20Permit', [name, symbol, decimals, owner, parsedSupply], `${symbol} TestERC20Permit`);
}

async function deployVerifiedProxy(hre, ethers, networkName, contractName, constructorArgs, initArgs, label, initFunction = 'initialize') {
  const Contract = await ethers.getContractFactory(contractName);

  const implementation = await Contract.deploy(...constructorArgs);
  await implementation.waitForDeployment();

  const implementationAddress = await implementation.getAddress();
  const initData = Contract.interface.encodeFunctionData(initFunction, initArgs);

  const ERC1967Proxy = await ethers.getContractFactory('ERC1967Proxy');
  const proxy = await ERC1967Proxy.deploy(implementationAddress, initData);
  await proxy.waitForDeployment();

  const proxyAddress = await proxy.getAddress();

  await verifyContract(hre, implementationAddress, constructorArgs, `${label} implementation`);
  await verifyContract(hre, proxyAddress, [implementationAddress, initData], `${label} proxy`);
  await verifyProxyOnEtherscan(networkName, proxyAddress, implementationAddress);

  return {
    contract: Contract.attach(proxyAddress),
    proxy,
    proxyAddress,
    implementation,
    implementationAddress,
    initData
  };
}

function getRelayers(env) {
  const { relayers } = getEnvConfig(env);

  if (!relayers) {
    return [];
  }

  if (!Array.isArray(relayers)) {
    throw new Error(`Invalid relayers config for env "${env}". Expected an array.`);
  }

  return relayers;
}

function getConfiguredTestBridgeHelperFromConfig(cfg, env = 'test environment') {
  const values = TEST_HELPER_FIELDS.map(field => cfg[field]);
  const populated = values.filter(isSetAddress);

  if (populated.length === 0) {
    return undefined;
  }

  if (populated.length !== TEST_HELPER_FIELDS.length) {
    throw new Error(`Invalid ${env} helper config. feed, pool, sanctions, and weth must either all be empty/zero or all be populated with the same helper address.`);
  }

  const uniqueValues = new Set(values.map(value => value.toLowerCase()));

  if (uniqueValues.size !== 1) {
    throw new Error(`Invalid ${env} helper config. feed, pool, sanctions, and weth must all point to the same TestPRDCTRBridgeHelper.`);
  }

  return values[0];
}

function getConfiguredTestBridgeHelper(env) {
  return getConfiguredTestBridgeHelperFromConfig(getEnvConfig(env), env);
}

export {
  ZERO_ADDRESS,
  assertAddress,
  buildInitArgs,
  buildTestBridgeInitArgs,
  checkEnvMatchesNetwork,
  cloneBridgeConfig,
  deployTestERC20,
  deployTestERC20Permit,
  deployVerifiedContract,
  deployVerifiedProxy,
  getBridgeArgs,
  getConfiguredTestBridgeHelper,
  getConfiguredTestBridgeHelperFromConfig,
  getEnv,
  getEnvConfig,
  getInitArgs,
  getRelayers,
  getTestBridgeInitArgs,
  isSetAddress,
  printBalances,
  validateBridgeConfig,
  validateInitConfig,
  validateTestBridgeConfig,
  verifyContract,
  verifyProxyOnEtherscan,
  writeBridgeConfig
};
