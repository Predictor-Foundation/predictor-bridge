import { writeFile } from 'node:fs/promises';
import { network } from 'hardhat';
import bridgeConfig from '../bridge.config.js';

const USDC_ABI = [
  'function name() view returns (string)',
  'function version() view returns (string)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address,uint256) returns (bool)',
  'function approve(address,uint256) returns (bool)',
  'function allowance(address,address) view returns (uint256)',
  'function nonces(address) view returns (uint256)'
];

const LOWER_TYPES = {
  LowerData: [
    { name: 'token', type: 'address' },
    { name: 'amount', type: 'uint256' },
    { name: 'recipient', type: 'address' },
    { name: 'lowerId', type: 'uint32' },
    { name: 't2Sender', type: 'bytes32' },
    { name: 't2Timestamp', type: 'uint64' }
  ]
};

const PERMIT_TYPES = {
  Permit: [
    { name: 'owner', type: 'address' },
    { name: 'spender', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' }
  ]
};

const DEFAULT_USDC_HOLDERS = [
  '0x01b8697695EAb322A339c4bf75740Db75dc9375E',
  '0x3d09D2354530466D32Ed37C6Ad19eA58504A0C37',
  '0xA5E4939f7cDd01A22d34DC9A29E45e9925B6cd62',
  '0x6aBC301915d33cE024A27D357d0b7679C9AE74C0',
  '0x1d7CeccEe9D055Ce790e463204eC8148d4952908'
];

const ONE_USDC = 1_000_000n;
const DEFAULT_SAMPLES = 50;
const DEFAULT_REFUND_SAMPLES = 5;
const MAX_RELAYER_LIFT_GAS_COST = 180_000n;
const MAX_RELAYER_LOWER_GAS_COST = 200_000n;
const DEFAULT_REPORTED_LIFT_GAS_COST = MAX_RELAYER_LIFT_GAS_COST;
const DEFAULT_REPORTED_LOWER_GAS_COST = MAX_RELAYER_LOWER_GAS_COST;
const DEFAULT_TX_GAS_LIMIT = 5_000_000n;
const DEFAULT_HEADROOM_BPS = 12_500n; // 25% headroom
const DEFAULT_REFUND_ACCRUAL_CALLS = 10;
const DEFAULT_REFUND_FREQUENCIES = [10, 15, 20, 25];
const DEFAULT_MEASURE_ACCOUNT_VARIANTS = true;
const GAS_ROUNDING = 10_000;
const DUMMY_SIG = {
  v: 27,
  r: '0x0000000000000000000000000000000000000000000000000000000000000001',
  s: '0x0000000000000000000000000000000000000000000000000000000000000001'
};

function envBigInt(name, fallback) {
  const raw = process.env[name];
  return raw === undefined || raw === '' ? fallback : BigInt(raw);
}

function relayerGasCostInput(name, legacyName, fallback, maxValue) {
  const hasSpecific = process.env[name] !== undefined && process.env[name] !== '';
  const hasLegacy = process.env[legacyName] !== undefined && process.env[legacyName] !== '';
  const source = hasSpecific ? name : hasLegacy ? legacyName : 'default';
  const value = hasSpecific ? BigInt(process.env[name]) : hasLegacy ? BigInt(process.env[legacyName]) : fallback;

  if (value > maxValue) {
    throw new Error(`${source} (${value}) exceeds the on-chain gas-cost cap (${maxValue}). Lower the input or update the script constants if the contract caps change.`);
  }

  return value;
}

function envInt(name, fallback) {
  const raw = process.env[name];
  return raw === undefined || raw === '' ? fallback : Number(raw);
}

function envBool(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  return ['1', 'true', 'yes', 'y'].includes(raw.toLowerCase());
}

function envIntList(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;

  const values = raw
    .split(',')
    .map(value => Number(value.trim()))
    .filter(value => Number.isInteger(value) && value > 0);

  if (values.length === 0) throw new Error(`${name} must contain at least one positive integer, for example: 5,10,20,50`);
  return values;
}

function usdcAmount(name, fallbackWholeUsdc) {
  const raw = process.env[name];
  if (!raw) return BigInt(fallbackWholeUsdc) * ONE_USDC;

  const [whole, fraction = ''] = raw.split('.');
  const padded = `${fraction}000000`.slice(0, 6);
  return BigInt(whole) * ONE_USDC + BigInt(padded);
}

function randomBytes32(ethers) {
  return ethers.hexlify(ethers.randomBytes(32));
}

function authorFromWallet(ethers, wallet) {
  const publicKey = wallet.signingKey.publicKey;

  return {
    wallet,
    t1Address: wallet.address,
    t1PubKeyLHS: `0x${publicKey.slice(4, 68)}`,
    t1PubKeyRHS: `0x${publicKey.slice(68, 132)}`,
    t2PubKey: randomBytes32(ethers)
  };
}

async function setEthBalance(ethers, networkHelpers, address, amount) {
  if (networkHelpers?.setBalance) {
    await networkHelpers.setBalance(address, amount);
    return;
  }

  await ethers.provider.send('hardhat_setBalance', [address, ethers.toBeHex(amount)]);
}

async function setAccountCode(ethers, networkHelpers, address, code = '0x') {
  if (networkHelpers?.setCode) {
    await networkHelpers.setCode(address, code);
    return;
  }

  try {
    await ethers.provider.send('hardhat_setCode', [address, code]);
  } catch (_) {}
}

async function primeLocalEoa(ethers, networkHelpers, address, balance = 0n) {
  await setEthBalance(ethers, networkHelpers, address, balance);
  await setAccountCode(ethers, networkHelpers, address, '0x');
}

async function primeLocalRecipient(ethers, networkHelpers, address, balance = 0n) {
  await setEthBalance(ethers, networkHelpers, address, balance);
  await setAccountCode(ethers, networkHelpers, address, '0x00');
}

async function impersonate(ethers, networkHelpers, address) {
  if (networkHelpers?.impersonateAccount) {
    await networkHelpers.impersonateAccount(address);
  } else {
    await ethers.provider.send('hardhat_impersonateAccount', [address]);
  }

  return ethers.getSigner(address);
}

async function findUsdcHolder(ethers, networkHelpers, usdc, requiredUsdc) {
  const candidates = process.env.USDC_HOLDER ? [process.env.USDC_HOLDER] : DEFAULT_USDC_HOLDERS;

  for (const candidate of candidates) {
    let balance;
    try {
      balance = await usdc.balanceOf(candidate);
    } catch (_) {
      continue;
    }

    if (balance < requiredUsdc) continue;

    await setEthBalance(ethers, networkHelpers, candidate, ethers.parseEther('100'));
    const signer = await impersonate(ethers, networkHelpers, candidate);

    try {
      const [recipient] = await ethers.getSigners();
      await (await usdc.connect(signer).transfer(recipient.address, 1n)).wait();
      console.log(`Using USDC holder ${candidate} with ${formatUsdc(balance)} USDC`);
      return signer;
    } catch (err) {
      console.log(`Skipping USDC holder ${candidate}: transfer probe failed (${shortError(err)})`);
    }
  }

  throw new Error('No usable USDC holder found. Set USDC_HOLDER to a mainnet address with enough USDC on the fork block.');
}

async function getPermit(ethers, usdc, owner, spender, value) {
  let version = '2';
  try {
    version = await usdc.version();
  } catch (_) {}

  const deadline = ethers.MaxUint256;
  const chainId = (await ethers.provider.getNetwork()).chainId;
  const nonce = await usdc.nonces(owner.address);
  const domain = {
    name: await usdc.name(),
    version,
    chainId,
    verifyingContract: usdc.target
  };
  const message = {
    owner: owner.address,
    spender,
    value,
    nonce,
    deadline
  };

  const signature = await owner.signTypedData(domain, PERMIT_TYPES, message);
  const { v, r, s } = ethers.Signature.from(signature);
  return { deadline, v, r, s };
}

async function deployBridgeOnFork(ethers, networkHelpers) {
  const cfg = bridgeConfig.mainnet;
  const required = ['feed', 'pool', 'sanctions', 'prd', 'usdc', 'usdt', 'weth'];
  for (const key of required) {
    if (!cfg[key]) throw new Error(`Missing bridgeConfig.mainnet.${key}`);
  }

  const [owner] = await ethers.getSigners();
  const PredictorBridge = await ethers.getContractFactory('PredictorBridge');
  const ERC1967Proxy = await ethers.getContractFactory('ERC1967Proxy');

  const authors = [];
  for (let i = 0; i < 5; i++) {
    const wallet = ethers.Wallet.createRandom().connect(ethers.provider);
    await primeLocalEoa(ethers, networkHelpers, wallet.address, ethers.parseEther('1'));
    authors.push(authorFromWallet(ethers, wallet));
  }

  const implementation = await PredictorBridge.deploy(cfg.feed, cfg.pool, cfg.sanctions, cfg.prd, cfg.usdc, cfg.usdt, cfg.weth);
  await implementation.waitForDeployment();

  const initArgs = [authors.map(a => a.t1Address), authors.map(a => a.t1PubKeyLHS), authors.map(a => a.t1PubKeyRHS), authors.map(a => a.t2PubKey), owner.address];
  const initData = implementation.interface.encodeFunctionData('initialize', initArgs);
  const proxy = await ERC1967Proxy.deploy(implementation.target, initData);
  await proxy.waitForDeployment();

  const bridge = PredictorBridge.attach(proxy.target);
  return { bridge, authors, implementationAddress: implementation.target };
}

async function createFundedUser(ethers, networkHelpers, usdc, holder, amount) {
  const user = ethers.Wallet.createRandom().connect(ethers.provider);
  await primeLocalEoa(ethers, networkHelpers, user.address, ethers.parseEther('0.1'));
  await (await usdc.connect(holder).transfer(user.address, amount)).wait();
  return user;
}

async function createFreshRecipient(ethers, networkHelpers) {
  const recipient = ethers.Wallet.createRandom().connect(ethers.provider);
  await primeLocalRecipient(ethers, networkHelpers, recipient.address, 0n);
  return recipient;
}

async function createExistingFundedUser(ethers, networkHelpers, usdc, holder, amount) {
  const user = await createFundedUser(ethers, networkHelpers, usdc, holder, amount);

  if ((await usdc.balanceOf(user.address)) === 0n) {
    throw new Error('Existing test user was not funded with USDC');
  }

  return user;
}

async function createExistingUsdcRecipient(ethers, networkHelpers, usdc, holder) {
  const recipient = ethers.Wallet.createRandom().connect(ethers.provider);
  await primeLocalRecipient(ethers, networkHelpers, recipient.address, ethers.parseEther('0.01'));
  await (await usdc.connect(holder).transfer(recipient.address, ONE_USDC)).wait();

  return recipient;
}

async function createLowerProof(ethers, bridge, authors, token, amount, recipient, lowerId) {
  const block = await ethers.provider.getBlock('latest');
  const t2Sender = randomBytes32(ethers);
  const t2Timestamp = BigInt(block.timestamp);
  const chainId = (await ethers.provider.getNetwork()).chainId;
  const domain = {
    name: await bridge.name(),
    version: '1',
    chainId,
    verifyingContract: bridge.target
  };
  const message = {
    token,
    amount,
    recipient,
    lowerId,
    t2Sender,
    t2Timestamp
  };

  const requiredConfirmations = Number((await bridge.numActiveAuthors()) / 2n + 1n);
  const confirmations = [];
  for (const author of authors.slice(0, requiredConfirmations)) {
    confirmations.push(ethers.getBytes(await author.wallet.signTypedData(domain, LOWER_TYPES, message)));
  }

  const lowerDataBytes = ethers.concat([
    ethers.getBytes(token),
    ethers.toBeHex(amount, 32),
    ethers.getBytes(recipient),
    ethers.toBeHex(lowerId, 4),
    ethers.getBytes(t2Sender),
    ethers.toBeHex(t2Timestamp, 8)
  ]);

  return ethers.concat([lowerDataBytes, ethers.concat(confirmations)]);
}

async function runTx(label, txPromise) {
  const tx = await txPromise;
  const receipt = await tx.wait();
  const gasUsed = Number(receipt.gasUsed);
  return { label, gasUsed, hash: receipt.hash };
}

function percentile(sorted, pct) {
  if (sorted.length === 0) return 0;
  const index = Math.ceil((pct / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, index))];
}

function roundUp(value, rounding = GAS_ROUNDING) {
  return Math.ceil(value / rounding) * rounding;
}

function withHeadroom(value, headroomBps) {
  return Number((BigInt(Math.ceil(value)) * headroomBps + 9_999n) / 10_000n);
}

function formatHeadroom(headroomBps) {
  const extraBps = headroomBps - 10_000n;
  const sign = extraBps >= 0n ? '+' : '';
  return `${sign}${Number(extraBps) / 100}% (${Number(headroomBps) / 10_000}x)`;
}

function summarize(values, headroomBps) {
  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((acc, v) => acc + v, 0);
  const max = sorted.at(-1) ?? 0;
  const recommended = roundUp(withHeadroom(max, headroomBps));

  return {
    count: values.length,
    min: sorted[0] ?? 0,
    avg: values.length === 0 ? 0 : Math.round(sum / values.length),
    p50: percentile(sorted, 50),
    p90: percentile(sorted, 90),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    max,
    recommendedCapWithHeadroom: recommended
  };
}

function warmValues(values, skip = 3) {
  return values.length > skip ? values.slice(skip) : values;
}

function refundOverheadSummary(baseGas, triggerGas, headroomBps) {
  const base = summarize(baseGas, headroomBps);
  const trigger = summarize(triggerGas, headroomBps);
  const overheadMax = Math.max(0, trigger.max - base.max);
  const overheadP95 = Math.max(0, trigger.p95 - base.p95);
  const overheadAvg = Math.max(0, trigger.avg - base.avg);

  return {
    baseMax: base.max,
    triggerRefundMax: trigger.max,
    overheadAvg,
    overheadP95,
    overheadMax
  };
}

function capRecommendations(baseGas, triggerGas, frequencies, headroomBps) {
  const base = summarize(baseGas, headroomBps);
  const trigger = summarize(triggerGas, headroomBps);
  const overheadMax = Math.max(0, trigger.max - base.max);
  const rows = {};

  for (const frequency of frequencies) {
    const amortisedGasBeforeHeadroom = base.max + Math.ceil(overheadMax / frequency);
    const cap = roundUp(withHeadroom(amortisedGasBeforeHeadroom, headroomBps));
    rows[`1 in ${frequency}`] = {
      baseMax: base.max,
      triggerRefundMax: trigger.max,
      refundOverheadMax: overheadMax,
      amortisedRefundGas: Math.ceil(overheadMax / frequency),
      beforeHeadroom: amortisedGasBeforeHeadroom,
      capWithHeadroom: cap
    };
  }

  return rows;
}

function combine(...arrays) {
  return arrays.flat();
}

function formatUsdc(amount) {
  const whole = amount / ONE_USDC;
  const fraction = String(amount % ONE_USDC)
    .padStart(6, '0')
    .replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : `${whole}`;
}

function shortError(err) {
  return String(err?.shortMessage || err?.message || err).split('\n')[0];
}

function printSummary(title, values, headroomBps) {
  const overall = summarize(values, headroomBps);
  const warm = summarize(warmValues(values), headroomBps);

  console.log(`\n${title}`);
  console.table({ overall, warmExcludingFirst3: warm });
}

function printRefundAnalysis(title, baseGas, triggerGas, frequencies, headroomBps) {
  console.log(`\n${title} refund overhead`);
  console.table({
    overall: refundOverheadSummary(baseGas, triggerGas, headroomBps),
    warmExcludingFirst3: refundOverheadSummary(warmValues(baseGas), warmValues(triggerGas), headroomBps)
  });

  console.log(`\n${title} amortised cap recommendations, using max(base) + max(trigger refund overhead) / cadence, then headroom`);
  console.table(capRecommendations(baseGas, triggerGas, frequencies, headroomBps));
}

async function runRelayerLiftSample({
  ethers,
  networkHelpers,
  usdc,
  holder,
  bridge,
  relayer,
  liftAmount,
  reportedGasCost,
  txGasLimit,
  liftMode,
  triggerRefund,
  user,
  userKind = 'fresh-holder',
  approveEachTime = true
}) {
  const sampleUser = user ?? (await createFundedUser(ethers, networkHelpers, usdc, holder, liftAmount));
  const refundPart = triggerRefund ? '.refund' : '';

  if (liftMode === 'permit') {
    const permit = await getPermit(ethers, usdc, sampleUser, bridge.target, liftAmount);
    return runTx(
      `relayerLift${refundPart}.${userKind}.permit`,
      bridge.connect(relayer).relayerLift(reportedGasCost, liftAmount, sampleUser.address, permit.v, permit.r, permit.s, triggerRefund, { gasLimit: txGasLimit })
    );
  }

  if (approveEachTime) {
    await (await usdc.connect(sampleUser).approve(bridge.target, liftAmount)).wait();
  }

  return runTx(
    `relayerLift${refundPart}.${userKind}.allowance`,
    bridge.connect(relayer).relayerLift(reportedGasCost, liftAmount, sampleUser.address, DUMMY_SIG.v, DUMMY_SIG.r, DUMMY_SIG.s, triggerRefund, { gasLimit: txGasLimit })
  );
}

async function runRelayerLowerSample({
  ethers,
  networkHelpers,
  bridge,
  authors,
  relayer,
  token,
  lowerAmount,
  reportedGasCost,
  txGasLimit,
  lowerId,
  triggerRefund,
  recipient,
  recipientKind = 'fresh-recipient'
}) {
  const sampleRecipient = recipient ?? (await createFreshRecipient(ethers, networkHelpers));
  const lowerProof = await createLowerProof(ethers, bridge, authors, token, lowerAmount, sampleRecipient.address, lowerId);
  const refundPart = triggerRefund ? '.refund' : '';
  return runTx(`relayerLower${refundPart}.${recipientKind}`, bridge.connect(relayer).relayerLower(reportedGasCost, lowerProof, triggerRefund, { gasLimit: txGasLimit }));
}

async function detectLiftMode({ ethers, networkHelpers, usdc, holder, bridge, relayer, liftAmount, reportedGasCost, txGasLimit, liftModeEnv }) {
  if (liftModeEnv !== 'auto') return liftModeEnv;

  const user = await createFundedUser(ethers, networkHelpers, usdc, holder, liftAmount);
  const permit = await getPermit(ethers, usdc, user, bridge.target, liftAmount);

  try {
    await runTx(
      'relayerLift.permit.probe',
      bridge.connect(relayer).relayerLift(reportedGasCost, liftAmount, user.address, permit.v, permit.r, permit.s, false, { gasLimit: txGasLimit })
    );
    return 'permit';
  } catch (err) {
    console.log(`Permit path failed on this fork (${shortError(err)}). Falling back to allowance path for lift samples.`);
    return 'allowance';
  }
}

async function preloadRelayerBalanceWithLowers({ ethers, networkHelpers, bridge, authors, relayer, token, lowerAmount, reportedGasCost, txGasLimit, startLowerId, calls }) {
  let nextLowerId = startLowerId;
  for (let i = 0; i < calls; i++) {
    await runRelayerLowerSample({
      ethers,
      networkHelpers,
      bridge,
      authors,
      relayer,
      token,
      lowerAmount,
      reportedGasCost,
      txGasLimit,
      lowerId: nextLowerId++,
      triggerRefund: false
    });
  }

  return nextLowerId;
}

async function main() {
  const { ethers, networkHelpers, networkName } = await network.create();

  if (networkName !== 'mainnetFork') {
    console.log(`Warning: network is "${networkName}". This script is intended for --network mainnetFork.`);
  }

  const samples = envInt('SAMPLES', DEFAULT_SAMPLES);
  const refundSamples = envInt('REFUND_SAMPLES', DEFAULT_REFUND_SAMPLES);
  const reportedLiftGasCost = relayerGasCostInput('RELAYER_LIFT_GAS_COST_INPUT', 'RELAYER_GAS_COST_INPUT', DEFAULT_REPORTED_LIFT_GAS_COST, MAX_RELAYER_LIFT_GAS_COST);
  const reportedLowerGasCost = relayerGasCostInput('RELAYER_LOWER_GAS_COST_INPUT', 'RELAYER_GAS_COST_INPUT', DEFAULT_REPORTED_LOWER_GAS_COST, MAX_RELAYER_LOWER_GAS_COST);
  const txGasLimit = envBigInt('MEASUREMENT_TX_GAS_LIMIT', DEFAULT_TX_GAS_LIMIT);
  const liftAmount = usdcAmount('LIFT_AMOUNT_USDC', 1_000);
  const lowerAmount = usdcAmount('LOWER_AMOUNT_USDC', 100);
  const headroomBps = envBigInt('HEADROOM_BPS', DEFAULT_HEADROOM_BPS);
  const measureRefunds = envBool('MEASURE_REFUNDS', true);
  const refundAccrualCalls = envInt('REFUND_ACCRUAL_CALLS', DEFAULT_REFUND_ACCRUAL_CALLS);
  const refundFrequencies = envIntList('REFUND_FREQUENCIES', DEFAULT_REFUND_FREQUENCIES);
  const selectedRefundFrequency = envInt('SELECTED_REFUND_FREQUENCY', 20);
  const measureAccountVariants = envBool('MEASURE_ACCOUNT_VARIANTS', DEFAULT_MEASURE_ACCOUNT_VARIANTS);
  const liftModeEnv = process.env.LIFT_MODE || 'auto'; // auto | permit | allowance

  const cfg = bridgeConfig.mainnet;
  const usdc = new ethers.Contract(cfg.usdc, USDC_ABI, ethers.provider);

  const accountVariantCount = measureAccountVariants ? 2 : 1;
  const preloadCallBudget = measureRefunds ? refundSamples * Math.max(0, refundAccrualCalls - 1) * accountVariantCount * 2 : 0;
  const measuredLiftCalls = samples * accountVariantCount + (measureRefunds ? refundSamples * accountVariantCount : 0) + 5;
  const measuredLowerCalls = samples * accountVariantCount + (measureRefunds ? refundSamples * accountVariantCount + preloadCallBudget : 0) + 50;
  const requiredUsdc = BigInt(measuredLiftCalls) * liftAmount + BigInt(measuredLowerCalls) * lowerAmount + 10_000n * ONE_USDC;
  const holder = await findUsdcHolder(ethers, networkHelpers, usdc, requiredUsdc);

  const { bridge, authors, implementationAddress } = await deployBridgeOnFork(ethers, networkHelpers);
  const [owner, relayer] = await ethers.getSigners();
  await (await bridge.connect(owner).registerRelayer(relayer.address)).wait();

  console.log(`\nFork network: ${networkName}`);
  console.log(`Chain ID: ${(await ethers.provider.getNetwork()).chainId}`);
  console.log(`Bridge proxy: ${bridge.target}`);
  console.log(`Bridge implementation: ${implementationAddress}`);
  console.log(`USDC: ${cfg.usdc}`);
  console.log(`Samples per standard operation: ${samples}`);
  console.log(`Samples per triggerRefund operation: ${measureRefunds ? refundSamples : 0}`);
  console.log(`Reported lift gasCost input: ${reportedLiftGasCost}`);
  console.log(`Reported lower gasCost input: ${reportedLowerGasCost}`);
  console.log(`Measurement tx gas limit: ${txGasLimit}`);
  console.log(`Lift amount: ${formatUsdc(liftAmount)} USDC`);
  console.log(`Lower amount: ${formatUsdc(lowerAmount)} USDC`);
  console.log(`Headroom: ${formatHeadroom(headroomBps)}`);
  console.log(`Refund accrual calls before each triggerRefund sample: ${measureRefunds ? refundAccrualCalls - 1 : 0}`);
  console.log(`Refund cadence scenarios: ${refundFrequencies.map(v => `1 in ${v}`).join(', ')}`);
  console.log(`Account variants: ${measureAccountVariants ? 'fresh and existing/warmed' : 'fresh only'}`);

  // Seed the bridge with enough USDC for all lower samples and preload calls without measuring that transfer.
  await (await usdc.connect(holder).transfer(bridge.target, BigInt(measuredLowerCalls + 50) * lowerAmount)).wait();

  const liftFreshGas = [];
  const liftExistingGas = [];
  const lowerFreshRecipientGas = [];
  const lowerExistingRecipientGas = [];
  const liftFreshRefundGas = [];
  const liftExistingRefundGas = [];
  const lowerFreshRecipientRefundGas = [];
  const lowerExistingRecipientRefundGas = [];
  let nextLowerId = 1;

  const liftMode = await detectLiftMode({ ethers, networkHelpers, usdc, holder, bridge, relayer, liftAmount, reportedGasCost: reportedLiftGasCost, txGasLimit, liftModeEnv });
  const existingLiftUser = measureAccountVariants
    ? await createExistingFundedUser(ethers, networkHelpers, usdc, holder, BigInt(samples + refundSamples + 5) * liftAmount + ONE_USDC)
    : undefined;
  const existingLowerRecipient = measureAccountVariants ? await createExistingUsdcRecipient(ethers, networkHelpers, usdc, holder) : undefined;

  if (measureAccountVariants && liftMode === 'allowance') {
    await (await usdc.connect(existingLiftUser).approve(bridge.target, ethers.MaxUint256)).wait();
  }

  console.log(`\nMeasuring relayerLift fresh USDC holders (${liftMode})...`);
  for (let i = 0; i < samples; i++) {
    const result = await runRelayerLiftSample({
      ethers,
      networkHelpers,
      usdc,
      holder,
      bridge,
      relayer,
      liftAmount,
      reportedGasCost: reportedLiftGasCost,
      txGasLimit,
      liftMode,
      triggerRefund: false,
      userKind: 'fresh-holder'
    });
    liftFreshGas.push(result.gasUsed);
    if ((i + 1) % Math.max(1, Math.floor(samples / 10)) === 0) console.log(`  lift fresh ${i + 1}/${samples}, gas=${result.gasUsed}`);
  }

  if (measureAccountVariants) {
    console.log(`\nMeasuring relayerLift existing/warmed USDC holder (${liftMode})...`);
    for (let i = 0; i < samples; i++) {
      const result = await runRelayerLiftSample({
        ethers,
        networkHelpers,
        usdc,
        holder,
        bridge,
        relayer,
        liftAmount,
        reportedGasCost: reportedLiftGasCost,
        txGasLimit,
        liftMode,
        triggerRefund: false,
        user: existingLiftUser,
        userKind: 'existing-holder',
        approveEachTime: false
      });
      liftExistingGas.push(result.gasUsed);
      if ((i + 1) % Math.max(1, Math.floor(samples / 10)) === 0) console.log(`  lift existing ${i + 1}/${samples}, gas=${result.gasUsed}`);
    }
  }

  console.log('\nMeasuring relayerLower fresh recipients...');
  for (let i = 0; i < samples; i++) {
    const result = await runRelayerLowerSample({
      ethers,
      networkHelpers,
      bridge,
      authors,
      relayer,
      token: cfg.usdc,
      lowerAmount,
      reportedGasCost: reportedLowerGasCost,
      txGasLimit,
      lowerId: nextLowerId++,
      triggerRefund: false,
      recipientKind: 'fresh-recipient'
    });
    lowerFreshRecipientGas.push(result.gasUsed);
    if ((i + 1) % Math.max(1, Math.floor(samples / 10)) === 0) console.log(`  lower fresh ${i + 1}/${samples}, gas=${result.gasUsed}`);
  }

  if (measureAccountVariants) {
    console.log('\nMeasuring relayerLower existing/warmed recipient...');
    for (let i = 0; i < samples; i++) {
      const result = await runRelayerLowerSample({
        ethers,
        networkHelpers,
        bridge,
        authors,
        relayer,
        token: cfg.usdc,
        lowerAmount,
        reportedGasCost: reportedLowerGasCost,
        txGasLimit,
        lowerId: nextLowerId++,
        triggerRefund: false,
        recipient: existingLowerRecipient,
        recipientKind: 'existing-recipient'
      });
      lowerExistingRecipientGas.push(result.gasUsed);
      if ((i + 1) % Math.max(1, Math.floor(samples / 10)) === 0) console.log(`  lower existing ${i + 1}/${samples}, gas=${result.gasUsed}`);
    }
  }

  if (measureRefunds) {
    console.log('\nMeasuring triggerRefund=true variants...');
    console.log('  Clearing relayer balance accumulated during standard-call measurement before recording refund samples...');
    const resetResult = await runRelayerLowerSample({
      ethers,
      networkHelpers,
      bridge,
      authors,
      relayer,
      token: cfg.usdc,
      lowerAmount,
      reportedGasCost: reportedLowerGasCost,
      txGasLimit,
      lowerId: nextLowerId++,
      triggerRefund: true,
      recipientKind: 'fresh-recipient'
    });
    console.log(`  unrecorded refund reset, gas=${resetResult.gasUsed}`);
    console.log(`  Each trigger sample is preceded by ${Math.max(0, refundAccrualCalls - 1)} non-refund lower calls to build a realistic relayer balance.`);

    console.log(`\nMeasuring relayerLift triggerRefund=true, fresh USDC holders (${liftMode})...`);
    for (let i = 0; i < refundSamples; i++) {
      nextLowerId = await preloadRelayerBalanceWithLowers({
        ethers,
        networkHelpers,
        bridge,
        authors,
        relayer,
        token: cfg.usdc,
        lowerAmount,
        reportedGasCost: reportedLowerGasCost,
        txGasLimit,
        startLowerId: nextLowerId,
        calls: Math.max(0, refundAccrualCalls - 1)
      });

      const result = await runRelayerLiftSample({
        ethers,
        networkHelpers,
        usdc,
        holder,
        bridge,
        relayer,
        liftAmount,
        reportedGasCost: reportedLiftGasCost,
        txGasLimit,
        liftMode,
        triggerRefund: true,
        userKind: 'fresh-holder'
      });
      liftFreshRefundGas.push(result.gasUsed);
      if ((i + 1) % Math.max(1, Math.floor(refundSamples / 5)) === 0) console.log(`  lift refund fresh ${i + 1}/${refundSamples}, gas=${result.gasUsed}`);
    }

    if (measureAccountVariants) {
      console.log(`\nMeasuring relayerLift triggerRefund=true, existing/warmed USDC holder (${liftMode})...`);
      for (let i = 0; i < refundSamples; i++) {
        nextLowerId = await preloadRelayerBalanceWithLowers({
          ethers,
          bridge,
          authors,
          relayer,
          token: cfg.usdc,
          lowerAmount,
          reportedGasCost: reportedLowerGasCost,
          startLowerId: nextLowerId,
          calls: Math.max(0, refundAccrualCalls - 1)
        });

        const result = await runRelayerLiftSample({
          ethers,
          usdc,
          holder,
          bridge,
          relayer,
          liftAmount,
          reportedGasCost: reportedLiftGasCost,
          liftMode,
          triggerRefund: true,
          user: existingLiftUser,
          userKind: 'existing-holder',
          approveEachTime: false
        });
        liftExistingRefundGas.push(result.gasUsed);
        if ((i + 1) % Math.max(1, Math.floor(refundSamples / 5)) === 0) console.log(`  lift refund existing ${i + 1}/${refundSamples}, gas=${result.gasUsed}`);
      }
    }

    console.log('\nMeasuring relayerLower triggerRefund=true, fresh recipients...');
    for (let i = 0; i < refundSamples; i++) {
      nextLowerId = await preloadRelayerBalanceWithLowers({
        ethers,
        networkHelpers,
        bridge,
        authors,
        relayer,
        token: cfg.usdc,
        lowerAmount,
        reportedGasCost: reportedLowerGasCost,
        txGasLimit,
        startLowerId: nextLowerId,
        calls: Math.max(0, refundAccrualCalls - 1)
      });

      const result = await runRelayerLowerSample({
        ethers,
        networkHelpers,
        bridge,
        authors,
        relayer,
        token: cfg.usdc,
        lowerAmount,
        reportedGasCost: reportedLowerGasCost,
        txGasLimit,
        lowerId: nextLowerId++,
        triggerRefund: true,
        recipientKind: 'fresh-recipient'
      });
      lowerFreshRecipientRefundGas.push(result.gasUsed);
      if ((i + 1) % Math.max(1, Math.floor(refundSamples / 5)) === 0) console.log(`  lower refund fresh ${i + 1}/${refundSamples}, gas=${result.gasUsed}`);
    }

    if (measureAccountVariants) {
      console.log('\nMeasuring relayerLower triggerRefund=true, existing/warmed recipient...');
      for (let i = 0; i < refundSamples; i++) {
        nextLowerId = await preloadRelayerBalanceWithLowers({
          ethers,
          bridge,
          authors,
          relayer,
          token: cfg.usdc,
          lowerAmount,
          reportedGasCost: reportedLowerGasCost,
          startLowerId: nextLowerId,
          calls: Math.max(0, refundAccrualCalls - 1)
        });

        const result = await runRelayerLowerSample({
          ethers,
          bridge,
          authors,
          relayer,
          token: cfg.usdc,
          lowerAmount,
          reportedGasCost: reportedLowerGasCost,
          lowerId: nextLowerId++,
          triggerRefund: true,
          recipient: existingLowerRecipient,
          recipientKind: 'existing-recipient'
        });
        lowerExistingRecipientRefundGas.push(result.gasUsed);
        if ((i + 1) % Math.max(1, Math.floor(refundSamples / 5)) === 0) console.log(`  lower refund existing ${i + 1}/${refundSamples}, gas=${result.gasUsed}`);
      }
    }
  }

  const liftGas = combine(liftFreshGas, liftExistingGas);
  const lowerGas = combine(lowerFreshRecipientGas, lowerExistingRecipientGas);
  const liftRefundGas = combine(liftFreshRefundGas, liftExistingRefundGas);
  const lowerRefundGas = combine(lowerFreshRecipientRefundGas, lowerExistingRecipientRefundGas);

  printSummary(`relayerLift standard, fresh USDC holders (${liftMode})`, liftFreshGas, headroomBps);
  if (measureAccountVariants) printSummary(`relayerLift standard, existing/warmed USDC holder (${liftMode})`, liftExistingGas, headroomBps);
  printSummary(`relayerLift standard, combined (${liftMode})`, liftGas, headroomBps);

  printSummary('relayerLower standard, fresh recipients', lowerFreshRecipientGas, headroomBps);
  if (measureAccountVariants) printSummary('relayerLower standard, existing/warmed recipient', lowerExistingRecipientGas, headroomBps);
  printSummary('relayerLower standard, combined', lowerGas, headroomBps);

  if (measureRefunds) {
    printSummary(`relayerLift triggerRefund=true, fresh USDC holders (${liftMode})`, liftFreshRefundGas, headroomBps);
    if (measureAccountVariants) printSummary(`relayerLift triggerRefund=true, existing/warmed USDC holder (${liftMode})`, liftExistingRefundGas, headroomBps);
    printSummary(`relayerLift triggerRefund=true, combined (${liftMode})`, liftRefundGas, headroomBps);

    printSummary('relayerLower triggerRefund=true, fresh recipients', lowerFreshRecipientRefundGas, headroomBps);
    if (measureAccountVariants) printSummary('relayerLower triggerRefund=true, existing/warmed recipient', lowerExistingRecipientRefundGas, headroomBps);
    printSummary('relayerLower triggerRefund=true, combined', lowerRefundGas, headroomBps);

    printRefundAnalysis(`relayerLift combined (${liftMode})`, liftGas, liftRefundGas, refundFrequencies, headroomBps);
    printRefundAnalysis('relayerLower combined', lowerGas, lowerRefundGas, refundFrequencies, headroomBps);
  }

  const liftRecommendations = measureRefunds ? capRecommendations(liftGas, liftRefundGas, refundFrequencies, headroomBps) : undefined;
  const lowerRecommendations = measureRefunds ? capRecommendations(lowerGas, lowerRefundGas, refundFrequencies, headroomBps) : undefined;
  const selectedLiftCap = liftRecommendations?.[`1 in ${selectedRefundFrequency}`]?.capWithHeadroom;
  const selectedLowerCap = lowerRecommendations?.[`1 in ${selectedRefundFrequency}`]?.capWithHeadroom;

  const report = {
    networkName,
    chainId: String((await ethers.provider.getNetwork()).chainId),
    bridge: bridge.target,
    implementation: implementationAddress,
    usdc: cfg.usdc,
    samples,
    refundSamples: measureRefunds ? refundSamples : 0,
    reportedLiftGasCost: String(reportedLiftGasCost),
    reportedLowerGasCost: String(reportedLowerGasCost),
    txGasLimit: String(txGasLimit),
    liftAmountUsdc: formatUsdc(liftAmount),
    lowerAmountUsdc: formatUsdc(lowerAmount),
    headroomBps: String(headroomBps),
    refundAccrualCalls: measureRefunds ? refundAccrualCalls : undefined,
    refundFrequencies: measureRefunds ? refundFrequencies : undefined,
    selectedRefundFrequency: measureRefunds ? selectedRefundFrequency : undefined,
    measureAccountVariants,
    liftMode,
    relayerLift: {
      freshHolders: {
        samples: liftFreshGas,
        overall: summarize(liftFreshGas, headroomBps),
        warmExcludingFirst3: summarize(warmValues(liftFreshGas), headroomBps)
      },
      existingHolder: measureAccountVariants
        ? {
            samples: liftExistingGas,
            overall: summarize(liftExistingGas, headroomBps),
            warmExcludingFirst3: summarize(warmValues(liftExistingGas), headroomBps)
          }
        : undefined,
      combined: {
        samples: liftGas,
        overall: summarize(liftGas, headroomBps),
        warmExcludingFirst3: summarize(warmValues(liftGas), headroomBps)
      }
    },
    relayerLower: {
      freshRecipients: {
        samples: lowerFreshRecipientGas,
        overall: summarize(lowerFreshRecipientGas, headroomBps),
        warmExcludingFirst3: summarize(warmValues(lowerFreshRecipientGas), headroomBps)
      },
      existingRecipient: measureAccountVariants
        ? {
            samples: lowerExistingRecipientGas,
            overall: summarize(lowerExistingRecipientGas, headroomBps),
            warmExcludingFirst3: summarize(warmValues(lowerExistingRecipientGas), headroomBps)
          }
        : undefined,
      combined: {
        samples: lowerGas,
        overall: summarize(lowerGas, headroomBps),
        warmExcludingFirst3: summarize(warmValues(lowerGas), headroomBps)
      }
    },
    relayerLiftRefund: measureRefunds
      ? {
          freshHolders: {
            samples: liftFreshRefundGas,
            overall: summarize(liftFreshRefundGas, headroomBps),
            warmExcludingFirst3: summarize(warmValues(liftFreshRefundGas), headroomBps)
          },
          existingHolder: measureAccountVariants
            ? {
                samples: liftExistingRefundGas,
                overall: summarize(liftExistingRefundGas, headroomBps),
                warmExcludingFirst3: summarize(warmValues(liftExistingRefundGas), headroomBps)
              }
            : undefined,
          combined: {
            samples: liftRefundGas,
            overall: summarize(liftRefundGas, headroomBps),
            warmExcludingFirst3: summarize(warmValues(liftRefundGas), headroomBps),
            overhead: refundOverheadSummary(liftGas, liftRefundGas, headroomBps),
            amortisedCapRecommendations: liftRecommendations
          }
        }
      : undefined,
    relayerLowerRefund: measureRefunds
      ? {
          freshRecipients: {
            samples: lowerFreshRecipientRefundGas,
            overall: summarize(lowerFreshRecipientRefundGas, headroomBps),
            warmExcludingFirst3: summarize(warmValues(lowerFreshRecipientRefundGas), headroomBps)
          },
          existingRecipient: measureAccountVariants
            ? {
                samples: lowerExistingRecipientRefundGas,
                overall: summarize(lowerExistingRecipientRefundGas, headroomBps),
                warmExcludingFirst3: summarize(warmValues(lowerExistingRecipientRefundGas), headroomBps)
              }
            : undefined,
          combined: {
            samples: lowerRefundGas,
            overall: summarize(lowerRefundGas, headroomBps),
            warmExcludingFirst3: summarize(warmValues(lowerRefundGas), headroomBps),
            overhead: refundOverheadSummary(lowerGas, lowerRefundGas, headroomBps),
            amortisedCapRecommendations: lowerRecommendations
          }
        }
      : undefined
  };

  const fileName = `relayer-gas-report-${Date.now()}.json`;
  await writeFile(fileName, JSON.stringify(report, null, 2));
  console.log(`\nWrote ${fileName}`);

  console.log('\nSuggested starting constants:');
  if (measureRefunds && selectedLiftCap && selectedLowerCap) {
    console.log(`// Based on max(base gas) + max(triggerRefund overhead) / ${selectedRefundFrequency}, with ${formatHeadroom(headroomBps)} headroom.`);
    console.log(`uint256 private constant MAX_RELAYER_LIFT_GAS_COST = ${selectedLiftCap};`);
    console.log(`uint256 private constant MAX_RELAYER_LOWER_GAS_COST = ${selectedLowerCap};`);
  } else {
    console.log('// Based on max standard call gas only, with configured headroom.');
    console.log(`uint256 private constant MAX_RELAYER_LIFT_GAS_COST = ${report.relayerLift.combined.overall.recommendedCapWithHeadroom};`);
    console.log(`uint256 private constant MAX_RELAYER_LOWER_GAS_COST = ${report.relayerLower.combined.overall.recommendedCapWithHeadroom};`);
  }

  console.log(
    '\nInterpretation: the triggerRefund=true gas is reported as full on-chain gas for the periodic refunding transaction. The suggested gasCost caps use only the amortised refund overhead, so the trigger transaction user is not charged the whole refund cost.'
  );
  console.log('The combined recommendations use the maximum across fresh and existing/warmed account variants.');
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
