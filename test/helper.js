import { network } from 'hardhat';
import { expect } from 'chai';
import { MerkleTree } from 'merkletreejs';
import keccak256 from 'keccak256';

const EMPTY_BYTES = '0x';
const EXPIRY_WINDOW = 60;
const MIN_AUTHORS = 4;
const ONE_USD = 1_000_000n;
const OWNER_REVERT_LOWER_DELAY = 3 * 24 * 60 * 60;
const SANCTIONED_ADDRESS = '0x7F367cC41522cE07553e823bf3be79A889DEbe1B';

const PROOF_TYPES = {
  addAuthor: {
    AddAuthor: [
      { name: 't1PubKey', type: 'bytes' },
      { name: 't2PubKey', type: 'bytes32' },
      { name: 'expiry', type: 'uint256' },
      { name: 't2TxId', type: 'uint32' }
    ]
  },
  claimLower: {
    LowerData: [
      { name: 'token', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'recipient', type: 'address' },
      { name: 'lowerId', type: 'uint32' },
      { name: 't2Sender', type: 'bytes32' },
      { name: 't2Timestamp', type: 'uint64' }
    ]
  },
  publishRoot: {
    PublishRoot: [
      { name: 'rootHash', type: 'bytes32' },
      { name: 'expiry', type: 'uint256' },
      { name: 't2TxId', type: 'uint32' }
    ]
  },
  removeAuthor: {
    RemoveAuthor: [
      { name: 't2PubKey', type: 'bytes32' },
      { name: 't1PubKey', type: 'bytes' },
      { name: 'expiry', type: 'uint256' },
      { name: 't2TxId', type: 'uint32' }
    ]
  },
  permit: {
    Permit: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'nonce', type: 'uint256' },
      { name: 'deadline', type: 'uint256' }
    ]
  }
};

const toEip712Message = {
  addAuthor: ([t1PubKey, t2PubKey, expiry, t2TxId]) => ({ t1PubKey, t2PubKey, expiry, t2TxId }),
  claimLower: ([token, amount, recipient, lowerId, t2Sender, t2Timestamp]) => ({ token, amount, recipient, lowerId, t2Sender, t2Timestamp }),
  publishRoot: ([rootHash, expiry, t2TxId]) => ({ rootHash, expiry, t2TxId }),
  removeAuthor: ([t2PubKey, t1PubKey, expiry, t2TxId]) => ({ t2PubKey, t1PubKey, expiry, t2TxId })
};

let accounts = [];
let authors = [];
let lowerId = 0;
let nextT2TxIdValue = 1;
let additionalTx = [];
let ethers;
let networkHelpers;

function strip0x(v) {
  return v.startsWith('0x') ? v.slice(2) : v;
}

function randomHex(bytes = 32) {
  return ethers.hexlify(ethers.randomBytes(bytes));
}

function randomBytes32() {
  return randomHex(32);
}

function nextT2TxId() {
  return nextT2TxIdValue++;
}

function toAuthorAccount(account) {
  const { publicKey } = account.signingKey;

  return {
    account,
    t1Address: account.address,
    t1PubKey: `0x${publicKey.slice(4, 132)}`,
    t1PubKeyLHS: `0x${publicKey.slice(4, 68)}`,
    t1PubKeyRHS: `0x${publicKey.slice(68, 132)}`,
    t2PubKey: randomBytes32()
  };
}

async function init({ numAuthors = 6, numExtraAccounts = 10, largeTree = false } = {}) {
  ({ ethers, networkHelpers } = await network.create());

  const [funder] = await ethers.getSigners();

  accounts = [funder];
  authors = [];
  lowerId = 0;
  nextT2TxIdValue = 1;

  for (let i = 0; i < numExtraAccounts; i++) {
    const account = ethers.Wallet.createRandom().connect(ethers.provider);
    await funder.sendTransaction({ to: account.address, value: ethers.parseEther('10') });
    accounts.push(account);
  }

  for (let i = 0; i < numAuthors; i++) {
    const account = ethers.Wallet.createRandom().connect(ethers.provider);
    await funder.sendTransaction({ to: account.address, value: ethers.parseEther('1') });
    authors.push(toAuthorAccount(account));
  }

  await funder.sendTransaction({ to: SANCTIONED_ADDRESS, value: ethers.parseEther('1') });

  const fillerLeaf = randomBytes32();
  additionalTx = largeTree ? new Array(4_194_305).fill(fillerLeaf) : [fillerLeaf];
}

async function getCurrentBlockTimestamp() {
  const block = await ethers.provider.getBlock('latest');
  return block.timestamp;
}

async function getValidExpiry() {
  return (await getCurrentBlockTimestamp()) + EXPIRY_WINDOW;
}

async function increaseBlockTimestamp(seconds) {
  await networkHelpers.time.increaseTo((await getCurrentBlockTimestamp()) + seconds);
}

async function getDomain(contract) {
  return {
    name: await contract.name(),
    version: '1',
    chainId: (await ethers.provider.getNetwork()).chainId,
    verifyingContract: contract.target
  };
}

async function getNumRequiredConfirmations(bridge) {
  const numActiveAuthors = await bridge.numActiveAuthors();
  return numActiveAuthors / 2n + 1n;
}

async function getSingleConfirmation(bridge, author, method, args) {
  const domain = await getDomain(bridge);
  return author.account.signTypedData(domain, PROOF_TYPES[method], toEip712Message[method](args));
}

async function getConfirmations(bridge, method, args, adjustment = 0, startPos = 2) {
  const domain = await getDomain(bridge);
  const required = Number(await getNumRequiredConfirmations(bridge)) + adjustment;
  let concatenated = '0x';

  for (let i = startPos; i <= required; i++) {
    const signature = await authors[i].account.signTypedData(domain, PROOF_TYPES[method], toEip712Message[method](args));
    concatenated += strip0x(signature);
  }

  return concatenated;
}

function createMerkleTree(dataLeaves) {
  const leavesIn = Array.isArray(dataLeaves) ? dataLeaves.slice() : [dataLeaves];
  const leafData = leavesIn[0];
  const hashedLeaves = leavesIn.map((leaf, index) => (index === 0 ? keccak256(leaf) : Buffer.from(strip0x(leaf), 'hex')));

  const tree = new MerkleTree(hashedLeaves, keccak256, { hashLeaves: false, sortPairs: true });

  return {
    leafData,
    leafHash: `0x${tree.leaves[0].toString('hex')}`,
    merklePath: tree.getHexProof(tree.leaves[0]),
    rootHash: tree.getHexRoot(),
    leaves: tree.getLeaves(),
    getMerklePath: (leaf, id) => tree.getHexProof(leaf, id)
  };
}

function getTxLeafMetadata() {
  return (
    '0x1505840050368dd692d19f39657a574ff9b9cc0c584219826ab1141d101f43a19a7f3122010edfa77444027c551df2f3' +
    strip0x(randomBytes32()) +
    'a6e6eaeff13956b192c9899a9993c16faea458458e35023800'
  );
}

function toLittleEndianBytesStr(amount) {
  let hexStr = ethers.toBeHex(amount).slice(2);
  hexStr = hexStr.length % 2 === 0 ? hexStr : `0${hexStr}`;
  return hexStr
    .match(/.{1,2}/g)
    .reverse()
    .join('')
    .padEnd(64, '0');
}

async function createTreeAndPublishRoot(bridge, tokenAddress, amount, ownerAddress) {
  const t2FromPubKey = strip0x(randomBytes32());
  const token = strip0x(tokenAddress);
  const amountBytes = toLittleEndianBytesStr(amount);
  const t1Address = strip0x(ownerAddress);
  const lowerIdHex = '0x5702';

  const encodedLeaf = getTxLeafMetadata() + strip0x(lowerIdHex) + t2FromPubKey + token + amountBytes + t1Address;
  const leaves = [encodedLeaf].concat(additionalTx);
  const merkleTree = createMerkleTree(leaves);

  const expiry = await getValidExpiry();
  const t2TxId = nextT2TxId();
  const confirmations = await getConfirmations(bridge, 'publishRoot', [merkleTree.rootHash, expiry, t2TxId]);
  await bridge.connect(authors[0].account).publishRoot(merkleTree.rootHash, expiry, t2TxId, confirmations);

  return merkleTree;
}

async function getPermit(token, account, spender, amount, deadline) {
  const finalDeadline = deadline ?? (await getCurrentBlockTimestamp()) + 3600;

  let version = '1';
  try {
    version = await token.version();
  } catch (_) {}

  const domain = {
    name: await token.name(),
    version,
    chainId: (await ethers.provider.getNetwork()).chainId,
    verifyingContract: token.target
  };

  const message = {
    owner: account.address,
    spender: typeof spender === 'string' ? spender : await spender.getAddress(),
    value: amount,
    nonce: await token.nonces(account.address),
    deadline: finalDeadline
  };

  const signature = await account.signTypedData(domain, PROOF_TYPES.permit, message);
  const { v, r, s } = ethers.Signature.from(signature);
  return { deadline: finalDeadline, v, r, s };
}

async function createLowerProof(bridge, token, amount, recipient, t2Sender = randomBytes32(), t2Timestamp = Math.floor(Date.now() / 1000), signingAuthors = null) {
  const recipientAddress = typeof recipient === 'string' ? recipient : recipient.address;
  const id = ++lowerId;
  const domain = await getDomain(bridge);
  const messageArgs = [token.target, amount, recipientAddress, id, t2Sender, t2Timestamp];
  const message = toEip712Message.claimLower(messageArgs);
  const confirmationsRequired = Number(await getNumRequiredConfirmations(bridge));

  const selectedAuthors = signingAuthors ?? authors.slice(1, 1 + confirmationsRequired);

  const confirmations = [];
  for (const author of selectedAuthors) {
    const confirmation = await author.account.signTypedData(domain, PROOF_TYPES.claimLower, message);
    confirmations.push(ethers.getBytes(confirmation));
  }

  const lowerDataBytes = ethers.concat([
    ethers.getBytes(token.target),
    ethers.toBeHex(amount, 32),
    ethers.getBytes(recipientAddress),
    ethers.toBeHex(id, 4),
    ethers.getBytes(t2Sender),
    ethers.toBeHex(t2Timestamp, 8)
  ]);

  return [ethers.concat([lowerDataBytes, ethers.concat(confirmations)]), id, t2Sender, t2Timestamp];
}

async function deployFixture({ numAuthors = 6, contractName = 'PredictorBridge' } = {}) {
  const [owner] = accounts;

  const PredictorBridge = await ethers.getContractFactory(contractName);
  const ERC1967Proxy = await ethers.getContractFactory('ERC1967Proxy');

  const Feed = await ethers.getContractFactory('MockChainlinkV3Aggregator');
  const Pool = await ethers.getContractFactory('MockUniswapV3Pool');
  const Sanctions = await ethers.getContractFactory('MockChainalysis');
  const Token = await ethers.getContractFactory('MockERC20Permit');
  const WETH = await ethers.getContractFactory('MockWETH9');

  const feed = await Feed.deploy();
  const sanctions = await Sanctions.deploy();
  const token = await Token.deploy('Token', 'TOK', 10, owner.address, 1_000_000_000_000_000_000_000n);
  const usdc = await Token.deploy('USD Coin', 'USDC', 6, owner.address, 10_000_000_000_000n);
  const usdt = await Token.deploy('Tether', 'USDT', 6, owner.address, 10_000_000_000_000n);
  const weth = await WETH.deploy();
  const pool = await Pool.deploy(usdc.target, weth.target);

  await feed.setLatestAnswer(500000000000000n);
  await weth.deposit({ value: ethers.parseEther('100') });
  await weth.transfer(pool.target, ethers.parseEther('100'));

  const implementation = await PredictorBridge.deploy(feed.target, pool.target, sanctions.target, usdc.target, usdt.target, weth.target);

  await implementation.waitForDeployment();

  const selectedAuthors = authors.slice(0, numAuthors);

  const initData = implementation.interface.encodeFunctionData('initialize', [
    selectedAuthors.map(a => a.t1Address),
    selectedAuthors.map(a => a.t1PubKeyLHS),
    selectedAuthors.map(a => a.t1PubKeyRHS),
    selectedAuthors.map(a => a.t2PubKey),
    owner.address
  ]);

  const proxy = await ERC1967Proxy.deploy(implementation.target, initData);
  await proxy.waitForDeployment();

  const bridge = PredictorBridge.attach(proxy.target);

  return {
    accounts,
    authors: selectedAuthors,
    bridge,
    feed,
    owner,
    pool,
    sanctions,
    token,
    usdc,
    usdt,
    weth
  };
}

async function impersonateAccount(address) {
  await networkHelpers.impersonateAccount(address);
}

async function stopImpersonatingAccount(address) {
  await networkHelpers.stopImpersonatingAccount(address);
}

const getAccounts = () => accounts;
const getAuthors = () => authors;
const getEthers = () => ethers;

export {
  EMPTY_BYTES,
  EXPIRY_WINDOW,
  MIN_AUTHORS,
  ONE_USD,
  OWNER_REVERT_LOWER_DELAY,
  SANCTIONED_ADDRESS,
  createLowerProof,
  createMerkleTree,
  createTreeAndPublishRoot,
  deployFixture,
  expect,
  getAccounts,
  getAuthors,
  getConfirmations,
  getCurrentBlockTimestamp,
  getDomain,
  getEthers,
  getNumRequiredConfirmations,
  getPermit,
  getSingleConfirmation,
  getValidExpiry,
  impersonateAccount,
  increaseBlockTimestamp,
  init,
  nextT2TxId,
  randomBytes32,
  randomHex,
  stopImpersonatingAccount,
  strip0x,
  toAuthorAccount
};
