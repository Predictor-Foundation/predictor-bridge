import hre, { network } from 'hardhat';
import { checkEnvMatchesNetwork, deployVerifiedProxy, getBridgeArgs, getEnv, getInitArgs, printBalances, validateBridgeConfig, validateInitConfig } from './helper.js';

async function main() {
  const env = getEnv();
  const { ethers, networkName } = await network.create();

  if (env !== 'mainnet') {
    throw new Error('deploy-bridge.js is mainnet-only. Use deploy-test-bridge.js for dev/testnet.');
  }

  checkEnvMatchesNetwork(env, networkName);
  validateBridgeConfig(env);
  validateInitConfig(env);

  const bridgeArgs = getBridgeArgs(env);
  const initArgs = getInitArgs(env);

  const [deployer] = await ethers.getSigners();
  const beforeBalance = await ethers.provider.getBalance(deployer.address);

  console.log(`Deployer: ${deployer.address}`);
  console.log(`Env: ${env}`);
  console.log(`Network: ${networkName}`);
  console.log('Contract: PredictorBridge');

  const bridge = await deployVerifiedProxy(hre, ethers, networkName, 'PredictorBridge', bridgeArgs, initArgs, 'PredictorBridge');

  const afterBalance = await ethers.provider.getBalance(deployer.address);
  printBalances(ethers, beforeBalance, afterBalance);

  console.log(`\nPredictorBridge: ${bridge.proxyAddress}`);
  console.log(`Implementation: ${bridge.implementationAddress}`);
  console.log('\nDone.');
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
