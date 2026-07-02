import {
  MAX_RELAYER_LIFT_GAS_COST,
  MAX_RELAYER_LOWER_GAS_COST,
  ONE_USD,
  SANCTIONED_ADDRESS,
  createLowerProof,
  deployFixture,
  expect,
  getAccounts,
  getEthers,
  getPermit,
  init,
  randomBytes32
} from '../helper.js';

describe('PredictorBridge relayer tests', function () {
  let ethers;
  let owner;
  let otherAccount;
  let relayer1;
  let relayer2;
  let user;
  let bridge;
  let usdc;
  let token;
  let sanctions;
  let pool;
  let feed;

  const getBridgeLogs = receipt =>
    receipt.logs
      .filter(log => log.address.toLowerCase() === bridge.target.toLowerCase())
      .map(log => {
        try {
          return bridge.interface.parseLog(log);
        } catch (_) {
          return null;
        }
      })
      .filter(Boolean);

  const getBridgeLog = (receipt, name) => getBridgeLogs(receipt).find(log => log.name === name);

  beforeEach(async () => {
    await init({ numAuthors: 5 });
    ethers = getEthers();
    [owner, otherAccount, relayer1, relayer2, user] = getAccounts();
    ({ bridge, usdc, token, sanctions, pool, feed } = await deployFixture({ numAuthors: 5 }));

    await usdc.transfer(user.address, 1_000n * ONE_USD);
    await usdc.transfer(pool.target, 10_000n * ONE_USD);
  });

  describe('registerRelayer', function () {
    it('registers via owner', async () => {
      expect(await bridge.relayerBalance(relayer1.address)).to.equal(0);
      await expect(bridge.registerRelayer(relayer1.address)).to.emit(bridge, 'LogRelayerRegistered').withArgs(relayer1.address);
      expect(await bridge.relayerBalance(relayer1.address)).to.equal(1);
    });

    it('rejects zero address', async () => {
      await expect(bridge.registerRelayer(ethers.ZeroAddress)).to.be.revertedWithCustomError(bridge, 'AddressIsZero');
    });

    it('rejects duplicate relayer registration', async () => {
      await bridge.registerRelayer(relayer1.address);
      await expect(bridge.registerRelayer(relayer1.address)).to.be.revertedWithCustomError(bridge, 'RelayerAlreadyRegistered');
    });

    it('rejects non-owner registerRelayer', async () => {
      await expect(bridge.connect(otherAccount).registerRelayer(relayer2.address)).to.be.revertedWithCustomError(bridge, 'OwnableUnauthorizedAccount');
    });
  });

  describe('deregisterRelayer', function () {
    beforeEach(async () => {
      await bridge.registerRelayer(relayer1.address);
    });

    it('deregisters plain relayer', async () => {
      await expect(bridge.deregisterRelayer(relayer1.address)).to.emit(bridge, 'LogRelayerDeregistered').withArgs(relayer1.address);
      expect(await bridge.relayerBalance(relayer1.address)).to.equal(0);
    });

    it('does not transfer USDC when relayer balance is exactly 1', async () => {
      expect(await bridge.relayerBalance(relayer1.address)).to.equal(1);
      expect(await usdc.balanceOf(relayer1.address)).to.equal(0);

      await bridge.deregisterRelayer(relayer1.address);

      expect(await bridge.relayerBalance(relayer1.address)).to.equal(0);
      expect(await usdc.balanceOf(relayer1.address)).to.equal(0);
    });

    it('returns owed USDC before deregistration', async () => {
      const amount = 10n * ONE_USD;
      const permit = await getPermit(usdc, user, bridge, amount, ethers.MaxUint256);
      await bridge.connect(relayer1).relayerLift(1n, amount, user.address, permit.v, permit.r, permit.s, false);

      const balance = await bridge.relayerBalance(relayer1.address);
      expect(balance).to.be.greaterThan(1);

      await bridge.deregisterRelayer(relayer1.address);
      expect(await usdc.balanceOf(relayer1.address)).to.equal(balance - 1n);
    });

    it('rejects deregistering an unregistered relayer', async () => {
      await bridge.deregisterRelayer(relayer1.address);
      await expect(bridge.deregisterRelayer(relayer1.address)).to.be.revertedWithCustomError(bridge, 'RelayerNotRegistered');
    });

    it('rejects non-owner deregisterRelayer', async () => {
      await expect(bridge.connect(otherAccount).deregisterRelayer(relayer1.address)).to.be.revertedWithCustomError(bridge, 'OwnableUnauthorizedAccount');
    });
  });

  describe('usdcEth', function () {
    it('returns the validated USDC/ETH price scaled for USDC base units', async () => {
      const answer = 3_000_000_000_000_000n;
      await feed.setLatestAnswer(answer);
      expect(await bridge.usdcEth()).to.equal(answer / 1_000_000n);
    });

    it('rejects zero oracle answer', async () => {
      await feed.setLatestAnswer(0);
      await expect(bridge.usdcEth()).to.be.revertedWithCustomError(bridge, 'InvalidOracleData');
    });

    it('rejects negative oracle answer', async () => {
      await feed.setLatestAnswer(-1);
      await expect(bridge.usdcEth()).to.be.revertedWithCustomError(bridge, 'InvalidOracleData');
    });

    it('rejects incomplete oracle round with zero updatedAt', async () => {
      const block = await ethers.provider.getBlock('latest');
      await feed.setLatestRoundData(10, 3_000_000_000_000_000n, block.timestamp, 0, 10);
      await expect(bridge.usdcEth()).to.be.revertedWithCustomError(bridge, 'InvalidOracleData');
    });

    it('rejects incomplete oracle round when answeredInRound is older than roundId', async () => {
      const block = await ethers.provider.getBlock('latest');
      await feed.setLatestRoundData(10, 3_000_000_000_000_000n, block.timestamp, block.timestamp, 9);
      await expect(bridge.usdcEth()).to.be.revertedWithCustomError(bridge, 'InvalidOracleData');
    });

    it('rejects stale oracle answer', async () => {
      const block = await ethers.provider.getBlock('latest');
      const staleUpdatedAt = BigInt(block.timestamp) - 25n * 60n * 60n - 1n;

      await feed.setLatestRoundData(10, 3_000_000_000_000_000n, Number(staleUpdatedAt), Number(staleUpdatedAt), 10);
      await expect(bridge.usdcEth()).to.be.revertedWithCustomError(bridge, 'InvalidOracleData');
    });
  });

  describe('relayerLift', function () {
    beforeEach(async () => {
      await bridge.registerRelayer(relayer1.address);
    });

    it('lets registered relayer lift USDC for user', async () => {
      const amount = 10n * ONE_USD;
      const permit = await getPermit(usdc, user, bridge, amount, ethers.MaxUint256);
      const bridgeBalBefore = await usdc.balanceOf(bridge.target);

      await expect(bridge.connect(relayer1).relayerLift(1n, amount, user.address, permit.v, permit.r, permit.s, false)).to.emit(bridge, 'LogLiftedToPredictionMarket');

      expect(await usdc.balanceOf(bridge.target)).to.equal(bridgeBalBefore + amount);
      expect(await bridge.relayerBalance(relayer1.address)).to.be.greaterThan(1);
    });

    it('lets relayerLift continue when permit was already consumed and allowance exists', async () => {
      const amount = 10n * ONE_USD;
      const permit = await getPermit(usdc, user, bridge, amount, ethers.MaxUint256);
      const bridgeBalBefore = await usdc.balanceOf(bridge.target);

      await usdc.connect(user).permit(user.address, bridge.target, amount, ethers.MaxUint256, permit.v, permit.r, permit.s);

      expect(await usdc.allowance(user.address, bridge.target)).to.equal(amount);

      await expect(bridge.connect(relayer1).relayerLift(1n, amount, user.address, permit.v, permit.r, permit.s, false)).to.emit(bridge, 'LogLiftedToPredictionMarket');

      expect(await usdc.balanceOf(bridge.target)).to.equal(bridgeBalBefore + amount);
      expect(await bridge.relayerBalance(relayer1.address)).to.be.greaterThan(1);
    });

    it('rejects non-relayer caller', async () => {
      const amount = 1n * ONE_USD;
      const permit = await getPermit(usdc, user, bridge, amount, ethers.MaxUint256);

      await expect(bridge.connect(otherAccount).relayerLift(1n, amount, user.address, permit.v, permit.r, permit.s, false)).to.be.revertedWithCustomError(
        bridge,
        'RelayerOnly'
      );
    });

    it('rejects relayerLift when gasCost exceeds the lift gas cost limit', async () => {
      const amount = 10n * ONE_USD;
      const permit = await getPermit(usdc, user, bridge, amount, ethers.MaxUint256);

      await expect(
        bridge.connect(relayer1).relayerLift(MAX_RELAYER_LIFT_GAS_COST + 1n, amount, user.address, permit.v, permit.r, permit.s, false)
      ).to.be.revertedWithCustomError(bridge, 'ExceedsLiftGasCostLimit');
    });

    it('rejects invalid permit', async () => {
      const amount = 1n * ONE_USD;
      const permit = await getPermit(usdc, user, bridge, amount, ethers.MaxUint256);

      await expect(bridge.connect(relayer1).relayerLift(1n, amount, otherAccount.address, permit.v, permit.r, permit.s, false)).to.be.revertedWithCustomError(
        bridge,
        'PermitAllowanceTooLow'
      );
    });

    it('rejects amount too low', async () => {
      const amount = 1n * ONE_USD;
      const permit = await getPermit(usdc, user, bridge, amount, ethers.MaxUint256);

      await expect(bridge.connect(relayer1).relayerLift(2n, 1n, user.address, permit.v, permit.r, permit.s, false)).to.be.revertedWithCustomError(bridge, 'AmountTooLow');
    });

    it('rejects sanctioned user', async () => {
      const amount = 1n * ONE_USD;
      await sanctions.setSanctioned(SANCTIONED_ADDRESS, true);

      await expect(bridge.connect(relayer1).relayerLift(1n, amount, SANCTIONED_ADDRESS, 27, randomBytes32(), randomBytes32(), false)).to.be.revertedWithCustomError(
        bridge,
        'AddressBlocked'
      );
    });

    it('rejects when paused', async () => {
      const amount = 1n * ONE_USD;
      const permit = await getPermit(usdc, user, bridge, amount, ethers.MaxUint256);

      await bridge.pause();
      await expect(bridge.connect(relayer1).relayerLift(1n, amount, user.address, permit.v, permit.r, permit.s, false)).to.be.revertedWithCustomError(bridge, 'EnforcedPause');
    });
  });

  describe('relayerLower', function () {
    beforeEach(async () => {
      await bridge.registerRelayer(relayer1.address);
      const amount = 100n * ONE_USD;
      const permit = await getPermit(usdc, user, bridge, amount, ethers.MaxUint256);
      await bridge.connect(user).permitLift(usdc.target, await bridge.deriveT2PublicKey(user.address), amount, permit.deadline, permit.v, permit.r, permit.s);
    });

    it('lets registered relayer lower USDC', async () => {
      const lowerAmount = 10n * ONE_USD;
      const [lowerProof] = await createLowerProof(bridge, usdc, lowerAmount, user.address, randomBytes32());
      await expect(bridge.connect(relayer1).relayerLower(1n, lowerProof, false)).to.emit(bridge, 'LogRelayerLowered');
    });

    it('rejects non-relayer caller', async () => {
      const amount = 10n * ONE_USD;
      const [lowerProof] = await createLowerProof(bridge, usdc, amount, user.address, randomBytes32());

      await expect(bridge.relayerLower(1n, lowerProof, false)).to.be.revertedWithCustomError(bridge, 'RelayerOnly');
    });

    it('rejects relayerLower when gasCost exceeds the lower gas cost limit', async () => {
      const amount = 10n * ONE_USD;
      const [lowerProof] = await createLowerProof(bridge, usdc, amount, user.address, randomBytes32());

      await expect(bridge.connect(relayer1).relayerLower(MAX_RELAYER_LOWER_GAS_COST + 1n, lowerProof, false)).to.be.revertedWithCustomError(bridge, 'ExceedsLowerGasCostLimit');
    });

    it('rejects used lower proof', async () => {
      const amount = 10n * ONE_USD;
      const [lowerProof] = await createLowerProof(bridge, usdc, amount, user.address, randomBytes32());

      await bridge.connect(relayer1).relayerLower(1n, lowerProof, false);
      await expect(bridge.connect(relayer1).relayerLower(1n, lowerProof, false)).to.be.revertedWithCustomError(bridge, 'LowerIsUsed');
    });

    it('rejects invalid lower proof', async () => {
      await expect(bridge.connect(relayer1).relayerLower(1n, '0x12345678', false)).to.be.revertedWithCustomError(bridge, 'InvalidProof');
    });

    it('rejects amount too low', async () => {
      const [tinyProof] = await createLowerProof(bridge, usdc, 1n, user.address, randomBytes32());

      await expect(bridge.connect(relayer1).relayerLower(2n, tinyProof, false)).to.be.revertedWithCustomError(bridge, 'AmountTooLow');
    });

    it('rejects invalid token', async () => {
      const [tokenProof] = await createLowerProof(bridge, token, 100n, user.address, randomBytes32());

      await expect(bridge.connect(relayer1).relayerLower(1n, tokenProof, false)).to.be.revertedWithCustomError(bridge, 'InvalidToken');
    });

    it('rejects when paused', async () => {
      const amount = 10n * ONE_USD;
      const [pausedProof] = await createLowerProof(bridge, usdc, amount, user.address, randomBytes32());

      await bridge.pause();
      await expect(bridge.connect(relayer1).relayerLower(1n, pausedProof, false)).to.be.revertedWithCustomError(bridge, 'EnforcedPause');
    });
  });

  describe('refund and callback guards', function () {
    beforeEach(async () => {
      await bridge.registerRelayer(relayer1.address);
    });

    it('rejects direct refundRelayerCallback from external caller', async () => {
      await expect(bridge.connect(owner).refundRelayerCallback(relayer1.address, 1, 0)).to.be.revertedWithCustomError(bridge, 'InvalidCaller');
    });

    it('rejects direct uniswap callback from non-pool', async () => {
      await expect(bridge.connect(owner).uniswapV3SwapCallback(1, 1, '0x')).to.be.revertedWithCustomError(bridge, 'InvalidCaller');
    });

    it('does not revert relayerLift when refund attempt succeeds or falls back', async () => {
      const amount = 10n * ONE_USD;
      const permit = await getPermit(usdc, user, bridge, amount, ethers.MaxUint256);
      const tx = await bridge.connect(relayer1).relayerLift(1n, amount, user.address, permit.v, permit.r, permit.s, true);
      const receipt = await tx.wait();

      const eventNames = getBridgeLogs(receipt).map(log => log.name);

      expect(eventNames.includes('LogLiftedToPredictionMarket')).to.equal(true);
    });

    it('preserves relayer balance when relayerLift refund attempt fails', async () => {
      const amount = 10n * ONE_USD;
      const permit = await getPermit(usdc, user, bridge, amount, ethers.MaxUint256);

      const balanceBefore = await bridge.relayerBalance(relayer1.address);
      expect(balanceBefore).to.equal(1);

      await bridge.connect(relayer1).relayerLift(1n, amount, user.address, permit.v, permit.r, permit.s, true);

      const balanceAfter = await bridge.relayerBalance(relayer1.address);
      expect(balanceAfter).to.be.greaterThan(1);
    });

    it('relayerLower with triggerRefund attempts immediate refund and resets relayer balance on success', async () => {
      const seedAmount = 50n * ONE_USD;
      const lowerAmount = 10n * ONE_USD;
      const gasCost = 1n;

      await usdc.transfer(user.address, seedAmount);
      const permit = await getPermit(usdc, user, bridge, seedAmount, ethers.MaxUint256);
      await bridge.connect(relayer1).relayerLift(gasCost, seedAmount, user.address, permit.v, permit.r, permit.s, false);

      const balanceBeforeAnyLower = await bridge.relayerBalance(relayer1.address);
      expect(balanceBeforeAnyLower).to.be.greaterThan(1);

      const [probeProof] = await createLowerProof(bridge, usdc, lowerAmount, user.address, randomBytes32());
      await bridge.connect(relayer1).relayerLower(gasCost, probeProof, false);

      const balanceAfterProbeLower = await bridge.relayerBalance(relayer1.address);
      const observedLowerTxCost = balanceAfterProbeLower - balanceBeforeAnyLower;
      expect(observedLowerTxCost).to.be.greaterThanOrEqual(0);

      const refundBalance = balanceAfterProbeLower + observedLowerTxCost - 1n;
      const usdcEth = await bridge.usdcEth();
      const minEthOut = (refundBalance * usdcEth * 987n) / 1000n;
      const ethOut = minEthOut + 1n;

      await pool.setSwapResult(refundBalance, -ethOut, ethOut);

      const [refundProof] = await createLowerProof(bridge, usdc, lowerAmount, user.address, randomBytes32());

      const tx = await bridge.connect(relayer1).relayerLower(gasCost, refundProof, true);
      const receipt = await tx.wait();

      const eventNames = getBridgeLogs(receipt).map(log => log.name);

      expect(eventNames.includes('LogRelayerLowered')).to.equal(true);
      expect(eventNames.includes('LogRefundFailed')).to.equal(false);
      expect(await bridge.relayerBalance(relayer1.address)).to.equal(1);
    });

    it('preserves relayer balance and emits LogRefundFailed with RefundBelowMin when relayerLower refund output is too low', async () => {
      const seedAmount = 50n * ONE_USD;
      const lowerAmount = 10n * ONE_USD;
      const gasCost = 1n;

      await usdc.transfer(user.address, seedAmount);
      const permit = await getPermit(usdc, user, bridge, seedAmount, ethers.MaxUint256);
      await bridge.connect(relayer1).relayerLift(gasCost, seedAmount, user.address, permit.v, permit.r, permit.s, false);

      const balanceBeforeLower = await bridge.relayerBalance(relayer1.address);
      expect(balanceBeforeLower).to.be.greaterThan(1);

      const [lowerProof] = await createLowerProof(bridge, usdc, lowerAmount, user.address, randomBytes32());

      const tx = await bridge.connect(relayer1).relayerLower(gasCost, lowerProof, true);
      const receipt = await tx.wait();

      const refundFailed = getBridgeLog(receipt, 'LogRefundFailed');
      expect(refundFailed).to.not.equal(undefined);
      expect(refundFailed.args.reason).to.equal(bridge.interface.getError('RefundBelowMin').selector);

      const balanceAfterLower = await bridge.relayerBalance(relayer1.address);
      expect(balanceAfterLower).to.be.greaterThan(balanceBeforeLower);
    });

    it('preserves relayer balance and emits LogRefundFailed with RefundRejected when ETH is rejected by a relayer contract', async () => {
      const RejectingRelayer = await ethers.getContractFactory('MockETHRejectingRelayer');
      const rejectingRelayer = await RejectingRelayer.deploy();

      await bridge.registerRelayer(rejectingRelayer.target);

      const liftAmount = 50n * ONE_USD;
      const gasCost = 175_000n;

      await usdc.transfer(user.address, liftAmount * 5n);

      const balanceBeforeProbe = await bridge.relayerBalance(rejectingRelayer.target);
      const probePermit = await getPermit(usdc, user, bridge, liftAmount, ethers.MaxUint256);

      await rejectingRelayer.relayerLift(bridge.target, gasCost, liftAmount, user.address, probePermit.v, probePermit.r, probePermit.s, false);

      const balanceAfterProbe = await bridge.relayerBalance(rejectingRelayer.target);
      const observedLiftTxCost = balanceAfterProbe - balanceBeforeProbe;
      expect(observedLiftTxCost).to.be.greaterThan(0);

      for (let i = 0; i < 2; i++) {
        const permit = await getPermit(usdc, user, bridge, liftAmount, ethers.MaxUint256);

        await rejectingRelayer.relayerLift(bridge.target, gasCost, liftAmount, user.address, permit.v, permit.r, permit.s, false);
      }

      const balanceBeforeRefundAttempt = await bridge.relayerBalance(rejectingRelayer.target);
      expect(balanceBeforeRefundAttempt).to.be.greaterThan(1);

      const refundBalance = balanceBeforeRefundAttempt + observedLiftTxCost - 1n;
      const usdcEth = await bridge.usdcEth();
      const minEthOut = (refundBalance * usdcEth * 987n) / 1000n;
      const ethOut = minEthOut + 1n;

      await pool.setSwapResult(refundBalance, -ethOut, ethOut);

      const refundPermit = await getPermit(usdc, user, bridge, liftAmount, ethers.MaxUint256);

      const tx = await rejectingRelayer.relayerLift(bridge.target, gasCost, liftAmount, user.address, refundPermit.v, refundPermit.r, refundPermit.s, true);
      const receipt = await tx.wait();

      const refundFailed = getBridgeLog(receipt, 'LogRefundFailed');
      expect(refundFailed).to.not.equal(undefined);
      expect(refundFailed.args.reason).to.equal(bridge.interface.getError('RefundRejected').selector);

      const balanceAfterRefundAttempt = await bridge.relayerBalance(rejectingRelayer.target);

      expect(balanceAfterRefundAttempt).to.be.greaterThan(1);
      expect(balanceAfterRefundAttempt).to.be.greaterThanOrEqual(balanceBeforeRefundAttempt);
    });
  });
});
