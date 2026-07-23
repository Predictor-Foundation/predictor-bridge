import hre, { network } from 'hardhat';
import { checkEnvMatchesNetwork, getBridgeArgs, getEnv, printBalances, validateBridgeConfig, verifyContract } from './helper.js';

async function main() {
  const env = getEnv();
  const { ethers, networkName } = await network.create();

  checkEnvMatchesNetwork(env, networkName);
  validateBridgeConfig(env);

  const bridgeArgs = getBridgeArgs(env);
  const [deployer] = await ethers.getSigners();
  const beforeBalance = await ethers.provider.getBalance(deployer.address);

  console.log(`Deployer: ${deployer.address}`);
  console.log(`Env: ${env}`);
  console.log(`Network: ${networkName}`);
  console.log('Contract: PRDCTRBridge');
  console.log('Deploying: implementation');

  const Bridge = await ethers.getContractFactory('PRDCTRBridge');
  const implementation = await Bridge.deploy(...bridgeArgs);
  await implementation.waitForDeployment();
  const implementationAddress = await implementation.getAddress();

  await verifyContract(hre, implementationAddress, bridgeArgs, 'PRDCTRBridge implementation');

  const afterBalance = await ethers.provider.getBalance(deployer.address);
  printBalances(ethers, beforeBalance, afterBalance);

  console.log(`\nNew PRDCTRBridge Implementation: ${implementationAddress}`);
  console.log('\nDone.');
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
