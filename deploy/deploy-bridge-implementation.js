import hre, { network } from 'hardhat';
import { checkEnvMatchesNetwork, getBridgeArgs, getEnv, printBalances, validateBridgeConfig, verifyContract } from './helper.js';

async function main() {
  const env = getEnv();
  const { ethers, networkName } = await network.create();

  if (env !== 'mainnet') {
    throw new Error('deploy-bridge-implementation.js is mainnet-only. Use deploy-test-bridge-implementation.js for dev/testnet.');
  }

  checkEnvMatchesNetwork(env, networkName);
  validateBridgeConfig(env);

  const bridgeArgs = getBridgeArgs(env);
  const [deployer] = await ethers.getSigners();
  const beforeBalance = await ethers.provider.getBalance(deployer.address);

  console.log(`Deployer: ${deployer.address}`);
  console.log(`Env: ${env}`);
  console.log(`Network: ${networkName}`);
  console.log('Contract: PredictorBridge');
  console.log('Deploying: implementation');

  const Bridge = await ethers.getContractFactory('PredictorBridge');
  const implementation = await Bridge.deploy(...bridgeArgs);
  await implementation.waitForDeployment();
  const implementationAddress = await implementation.getAddress();

  await verifyContract(hre, implementationAddress, bridgeArgs, 'PredictorBridge implementation');

  const afterBalance = await ethers.provider.getBalance(deployer.address);
  printBalances(ethers, beforeBalance, afterBalance);

  console.log(`\nNew PredictorBridge Implementation: ${implementationAddress}`);
  console.log('\nDone.');
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
