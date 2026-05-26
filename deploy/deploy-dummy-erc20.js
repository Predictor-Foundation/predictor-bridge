import hre, { network } from 'hardhat';
import { printBalances, verifyContract } from './helper.js';

async function main() {
  const { ethers, networkName } = await network.create();

  if (networkName !== 'sepolia') {
    throw new Error(`Dummy ERC20 is intended for sepolia, got ${networkName}`);
  }

  const [deployer] = await ethers.getSigners();
  const owner = process.env.DUMMY_TOKEN_OWNER || deployer.address;
  const name = process.env.DUMMY_TOKEN_NAME || 'Dummy USDT';
  const symbol = process.env.DUMMY_TOKEN_SYMBOL || 'dUSDT';
  const decimals = Number(process.env.DUMMY_TOKEN_DECIMALS || '6');
  const supply = ethers.parseUnits(process.env.DUMMY_TOKEN_SUPPLY || '100000000000', decimals);
  const beforeBalance = await ethers.provider.getBalance(deployer.address);

  console.log(`Deployer: ${deployer.address}`);
  console.log(`Owner: ${owner}`);
  console.log(`Network: ${networkName}`);
  console.log(`Name: ${name}`);
  console.log(`Symbol: ${symbol}`);
  console.log(`Decimals: ${decimals}`);
  console.log(`Supply: ${supply}`);
  console.log('Deploying: DummyERC20');

  const DummyERC20 = await ethers.getContractFactory('DummyERC20');
  const token = await DummyERC20.deploy(name, symbol, decimals, owner, supply);
  await token.waitForDeployment();

  const tokenAddress = await token.getAddress();

  await verifyContract(hre, tokenAddress, [name, symbol, decimals, owner, supply], 'dummy ERC20');

  const afterBalance = await ethers.provider.getBalance(deployer.address);
  printBalances(ethers, beforeBalance, afterBalance);

  console.log(`\nDummy ERC20: ${tokenAddress}`);
  console.log('\nUse this address for usdt in bridge.config.js.');
  console.log('\nDone.');
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
