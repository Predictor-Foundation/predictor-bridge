import hre, { network } from 'hardhat';
import {
  checkEnvMatchesNetwork,
  getBridgeArgs,
  getEnv,
  getInitArgs,
  printBalances,
  validateBridgeConfig,
  validateInitConfig,
  verifyContract,
  verifyProxyOnEtherscan
} from './helper.js';

async function main() {
  const env = getEnv();
  const { ethers, networkName } = await network.create();

  checkEnvMatchesNetwork(env, networkName);
  validateBridgeConfig(env);
  validateInitConfig(env);

  const bridgeArgs = getBridgeArgs(env);
  const initArgs = getInitArgs(env);

  const contractName = process.env.BRIDGE_CONTRACT || 'PredictorBridge';
  const [deployer] = await ethers.getSigners();
  const beforeBalance = await ethers.provider.getBalance(deployer.address);

  console.log(`Deployer: ${deployer.address}`);
  console.log(`Env: ${env}`);
  console.log(`Network: ${networkName}`);
  console.log(`Contract: ${contractName}`);
  console.log('Deploying: implementation and proxy');

  const Bridge = await ethers.getContractFactory(contractName);
  const implementation = await Bridge.deploy(...bridgeArgs);
  await implementation.waitForDeployment();

  const implementationAddress = await implementation.getAddress();
  const initData = Bridge.interface.encodeFunctionData('initialize', initArgs);

  const ERC1967Proxy = await ethers.getContractFactory('ERC1967Proxy');
  const proxy = await ERC1967Proxy.deploy(implementationAddress, initData);
  await proxy.waitForDeployment();

  const proxyAddress = await proxy.getAddress();

  await verifyContract(hre, implementationAddress, bridgeArgs, 'implementation');
  await verifyContract(hre, proxyAddress, [implementationAddress, initData], 'proxy');
  await verifyProxyOnEtherscan(networkName, proxyAddress);

  const afterBalance = await ethers.provider.getBalance(deployer.address);
  printBalances(ethers, beforeBalance, afterBalance);

  console.log(`\n${contractName}: ${proxyAddress}`);
  console.log('\nDone.');
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
