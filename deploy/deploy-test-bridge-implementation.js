import hre, { network } from 'hardhat';
import { checkEnvMatchesNetwork, getBridgeArgs, getEnv, printBalances, validateBridgeConfig, verifyContract } from './helper.js';

async function main() {
  const env = getEnv();
  const { ethers, networkName } = await network.create();

  if (env === 'mainnet') {
    throw new Error('deploy-test-bridge-implementation.js is only for dev/testnet. Use deploy-bridge-implementation.js for mainnet.');
  }

  checkEnvMatchesNetwork(env, networkName);
  validateBridgeConfig(env);

  const bridgeArgs = getBridgeArgs(env);
  const [deployer] = await ethers.getSigners();
  const beforeBalance = await ethers.provider.getBalance(deployer.address);

  console.log(`Deployer: ${deployer.address}`);
  console.log(`Env: ${env}`);
  console.log(`Network: ${networkName}`);
  console.log('Contract: TestPRDCTRBridge');
  console.log('Deploying: implementation');

  const Bridge = await ethers.getContractFactory('TestPRDCTRBridge');
  const implementation = await Bridge.deploy(...bridgeArgs);
  await implementation.waitForDeployment();
  const implementationAddress = await implementation.getAddress();

  await verifyContract(hre, implementationAddress, bridgeArgs, 'TestPRDCTRBridge implementation');

  const afterBalance = await ethers.provider.getBalance(deployer.address);
  printBalances(ethers, beforeBalance, afterBalance);

  console.log(`\nNew TestPRDCTRBridge Implementation: ${implementationAddress}`);
  console.log('\nDone.');
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
