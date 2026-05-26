import hre, { network } from 'hardhat';
import { printBalances, verifyContract, verifyProxyOnEtherscan } from './helper.js';

async function main() {
  const { ethers, networkName } = await network.create();

  if (networkName !== 'sepolia') {
    throw new Error(`RelayerToken helper is intended for sepolia, got ${networkName}`);
  }

  const testnetBridge = process.env.TESTNET_BRIDGE || ethers.ZeroAddress;
  const devBridge = process.env.DEV_BRIDGE || ethers.ZeroAddress;

  const [deployer] = await ethers.getSigners();
  const beforeBalance = await ethers.provider.getBalance(deployer.address);

  console.log(`Deployer: ${deployer.address}`);
  console.log(`Network: ${networkName}`);
  console.log(`Initial testnet bridge: ${testnetBridge}`);
  console.log(`Initial dev bridge: ${devBridge}`);
  console.log('Deploying: RelayerToken implementation and proxy');

  const RelayerToken = await ethers.getContractFactory('RelayerToken');
  const implementation = await RelayerToken.deploy();
  await implementation.waitForDeployment();

  const implementationAddress = await implementation.getAddress();
  const initArgs = [testnetBridge, devBridge];
  const initData = RelayerToken.interface.encodeFunctionData('initialize', initArgs);

  const ERC1967Proxy = await ethers.getContractFactory('ERC1967Proxy');
  const proxy = await ERC1967Proxy.deploy(implementationAddress, initData);
  await proxy.waitForDeployment();

  const proxyAddress = await proxy.getAddress();

  await verifyContract(hre, implementationAddress, [], 'relayer token implementation');
  await verifyContract(hre, proxyAddress, [implementationAddress, initData], 'relayer token proxy');
  await verifyProxyOnEtherscan(networkName, proxyAddress);

  const afterBalance = await ethers.provider.getBalance(deployer.address);
  printBalances(ethers, beforeBalance, afterBalance);

  console.log(`\nRelayerToken Helper Proxy: ${proxyAddress}`);
  console.log(`RelayerToken Implementation: ${implementationAddress}`);
  console.log('\nUse the helper proxy address for feed, pool, sanctions, usdc, and weth in bridge.config.js.');
  console.log('After each bridge is deployed, call setBridge(bridgeProxy, true) on the helper.');
  console.log('\nDone.');
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
