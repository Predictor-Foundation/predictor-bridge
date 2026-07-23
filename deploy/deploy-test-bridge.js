import hre, { network } from 'hardhat';
import {
  buildTestBridgeInitArgs,
  checkEnvMatchesNetwork,
  cloneBridgeConfig,
  deployTestERC20,
  deployTestERC20Permit,
  deployVerifiedProxy,
  getConfiguredTestBridgeHelperFromConfig,
  getEnv,
  isSetAddress,
  printBalances,
  validateTestBridgeConfig,
  writeBridgeConfig,
  ZERO_ADDRESS
} from './helper.js';

const TEST_BRIDGE_CONTRACT = 'TestPRDCTRBridge';
const TEST_HELPER_CONTRACT = 'TestPRDCTRBridgeHelper';
const TEST_BRIDGE_INITIALIZER = 'initialize(address[],bytes32[],bytes32[],bytes32[],address,address[])';
const TEST_HELPER_INITIALIZER = 'initialize(address)';

function tokenResult(address, contract = undefined) {
  return { address, contract };
}

async function ensureToken(hre, ethers, cfg, field, deployer) {
  if (isSetAddress(cfg[field])) {
    console.log(`${field}: using configured address ${cfg[field]}`);
    return tokenResult(cfg[field]);
  }

  console.log(`${field}: deploying ${deployer.symbol}`);
  const deployed = await deployer.deploy(hre, ethers);
  cfg[field] = deployed.address;
  return deployed;
}

async function ensureHelper(hre, ethers, networkName, cfg) {
  const configuredHelper = getConfiguredTestBridgeHelperFromConfig(cfg, 'test bridge');

  if (configuredHelper) {
    console.log(`helper: using configured address ${configuredHelper}`);
    const Helper = await ethers.getContractFactory(TEST_HELPER_CONTRACT);
    return {
      contract: Helper.attach(configuredHelper),
      proxyAddress: configuredHelper,
      implementationAddress: undefined,
      deployed: false
    };
  }

  console.log('helper: deploying implementation and proxy');
  const constructorArgs = [cfg.prd, cfg.tok, cfg.usdc, cfg.usdt];
  const initArgs = [cfg.owner];
  const helper = await deployVerifiedProxy(hre, ethers, networkName, TEST_HELPER_CONTRACT, constructorArgs, initArgs, TEST_HELPER_CONTRACT, TEST_HELPER_INITIALIZER);

  cfg.feed = helper.proxyAddress;
  cfg.pool = helper.proxyAddress;
  cfg.sanctions = helper.proxyAddress;
  cfg.weth = helper.proxyAddress;

  return { ...helper, deployed: true };
}

async function ensureBridge(hre, ethers, networkName, cfg) {
  if (isSetAddress(cfg.bridge)) {
    console.log(`bridge: using configured address ${cfg.bridge}`);
    const Bridge = await ethers.getContractFactory(TEST_BRIDGE_CONTRACT);
    return {
      contract: Bridge.attach(cfg.bridge),
      proxyAddress: cfg.bridge,
      implementationAddress: undefined,
      deployed: false
    };
  }

  console.log('bridge: deploying implementation and proxy');
  const constructorArgs = [cfg.feed, cfg.pool, cfg.sanctions, cfg.prd, cfg.usdc, cfg.usdt, cfg.weth];
  const initArgs = buildTestBridgeInitArgs(cfg);

  const bridge = await deployVerifiedProxy(hre, ethers, networkName, TEST_BRIDGE_CONTRACT, constructorArgs, initArgs, TEST_BRIDGE_CONTRACT, TEST_BRIDGE_INITIALIZER);
  cfg.bridge = bridge.proxyAddress;

  return { ...bridge, deployed: true };
}

async function ensureBridgeIsAllowed(helper, bridgeAddress) {
  const helperBridgeAddress = await helper.contract.bridge();

  if (helperBridgeAddress === ZERO_ADDRESS) {
    console.log(`Calling helper.initBridge(${bridgeAddress})`);
    const tx = await helper.contract.initBridge(bridgeAddress);
    await tx.wait();

    const updatedBridgeAddress = await helper.contract.bridge();

    if (updatedBridgeAddress.toLowerCase() !== bridgeAddress.toLowerCase()) {
      throw new Error('helper.initBridge did not set the expected bridge address');
    }

    return;
  }

  if (helperBridgeAddress.toLowerCase() !== bridgeAddress.toLowerCase()) {
    throw new Error(`helper is set to the wrong bridge address: expected ${bridgeAddress}, got ${helperBridgeAddress}`);
  }

  console.log(`helper bridge is already set to ${bridgeAddress}`);
}

async function main() {
  const env = getEnv();
  const { ethers, networkName } = await network.create();

  if (env === 'mainnet') {
    throw new Error('deploy-test-bridge.js is only for dev/testnet. Use deploy-bridge.js for mainnet.');
  }

  checkEnvMatchesNetwork(env, networkName);
  validateTestBridgeConfig(env);

  const updatedConfig = cloneBridgeConfig();
  const cfg = updatedConfig[env];

  const [deployer] = await ethers.getSigners();
  const beforeBalance = await ethers.provider.getBalance(deployer.address);

  console.log(`Deployer: ${deployer.address}`);
  console.log(`Owner: ${cfg.owner}`);
  console.log(`Env: ${env}`);
  console.log(`Network: ${networkName}`);

  const prd = await ensureToken(hre, ethers, cfg, 'prd', {
    symbol: 'pPRD',
    deploy: () =>
      deployTestERC20Permit(hre, ethers, {
        name: 'PRDCTR test PRD',
        symbol: 'pPRD',
        decimals: 10,
        owner: cfg.owner,
        supply: '95000000000'
      })
  });

  const tok = await ensureToken(hre, ethers, cfg, 'tok', {
    symbol: 'pTOK',
    deploy: () =>
      deployTestERC20(hre, ethers, {
        name: 'PRDCTR test TOK',
        symbol: 'pTOK',
        decimals: 18,
        owner: cfg.owner,
        supply: '123456789'
      })
  });

  const usdc = await ensureToken(hre, ethers, cfg, 'usdc', {
    symbol: 'pUSDC',
    deploy: () =>
      deployTestERC20Permit(hre, ethers, {
        name: 'PRDCTR test USDC',
        symbol: 'pUSDC',
        decimals: 6,
        owner: cfg.owner,
        supply: '100000000000'
      })
  });

  const usdt = await ensureToken(hre, ethers, cfg, 'usdt', {
    symbol: 'pUSDT',
    deploy: () =>
      deployTestERC20(hre, ethers, {
        name: 'PRDCTR test USDT',
        symbol: 'pUSDT',
        decimals: 6,
        owner: cfg.owner,
        supply: '100000000000'
      })
  });

  cfg.prd = prd.address;
  cfg.tok = tok.address;
  cfg.usdc = usdc.address;
  cfg.usdt = usdt.address;

  const helper = await ensureHelper(hre, ethers, networkName, cfg);
  const bridge = await ensureBridge(hre, ethers, networkName, cfg);

  await ensureBridgeIsAllowed(helper, bridge.proxyAddress);
  await writeBridgeConfig(updatedConfig);

  const afterBalance = await ethers.provider.getBalance(deployer.address);
  printBalances(ethers, beforeBalance, afterBalance);

  console.log('\nbridge.config.js updated with:');
  console.log(`  ${env}.bridge: '${cfg.bridge}'`);
  console.log(`  ${env}.tok: '${cfg.tok}'`);
  console.log(`  ${env}.prd: '${cfg.prd}'`);
  console.log(`  ${env}.usdc: '${cfg.usdc}'`);
  console.log(`  ${env}.usdt: '${cfg.usdt}'`);
  console.log(`  ${env}.feed/pool/sanctions/weth: '${cfg.feed}'`);

  console.log('\nDone.');
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
