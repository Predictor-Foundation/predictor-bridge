import { ONE_USD, SANCTIONED_ADDRESS, createLowerProof, deployFixture, expect, getAccounts, getEthers, getPermit, init, randomBytes32 } from '../helper.js';

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

    it('rejects non-relayer caller', async () => {
      const amount = 1n * ONE_USD;
      const permit = await getPermit(usdc, user, bridge, amount, ethers.MaxUint256);

      await expect(bridge.connect(otherAccount).relayerLift(1n, amount, user.address, permit.v, permit.r, permit.s, false)).to.be.revertedWithCustomError(
        bridge,
        'RelayerOnly'
      );
    });

    it('rejects invalid permit', async () => {
      const amount = 1n * ONE_USD;
      const permit = await getPermit(usdc, user, bridge, amount, ethers.MaxUint256);

      await expect(bridge.connect(relayer1).relayerLift(1n, amount, otherAccount.address, permit.v, permit.r, permit.s, false)).to.revert();
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
      await expect(bridge.connect(owner).refundRelayerCallback(relayer1.address, 1)).to.be.revertedWithCustomError(bridge, 'InvalidCaller');
    });

    it('rejects direct uniswap callback from non-pool', async () => {
      await expect(bridge.connect(owner).uniswapV3SwapCallback(1, 1, '0x')).to.be.revertedWithCustomError(bridge, 'InvalidCaller');
    });

    it('does not revert relayerLift when refund attempt succeeds or falls back', async () => {
      const amount = 10n * ONE_USD;
      const permit = await getPermit(usdc, user, bridge, amount, ethers.MaxUint256);
      const tx = await bridge.connect(relayer1).relayerLift(1n, amount, user.address, permit.v, permit.r, permit.s, true);
      const receipt = await tx.wait();

      const parsed = receipt.logs
        .filter(log => log.address === bridge.target)
        .map(log => {
          try {
            return bridge.interface.parseLog(log);
          } catch (_) {
            return null;
          }
        })
        .filter(Boolean)
        .map(log => log.name);

      expect(parsed.includes('LogLiftedToPredictionMarket')).to.equal(true);
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

      // Do a lower without a refund to measure the exact txCost increment used by relayerLower for this environment
      const [probeProof] = await createLowerProof(bridge, usdc, lowerAmount, user.address, randomBytes32());
      await bridge.connect(relayer1).relayerLower(gasCost, probeProof, false);

      const balanceAfterProbeLower = await bridge.relayerBalance(relayer1.address);
      const observedLowerTxCost = balanceAfterProbeLower - balanceBeforeAnyLower;
      expect(observedLowerTxCost).to.be.greaterThanOrEqual(0);

      // Now lower with refund against current balance + observedLowerTxCost - 1
      const expectedBalanceDuringRefund = balanceAfterProbeLower + observedLowerTxCost;
      const refundBalance = expectedBalanceDuringRefund - 1n;

      const usdcEth = await bridge.usdcEth();
      const minEthOut = (refundBalance * usdcEth * 987n) / 1000n;
      const ethOut = minEthOut + 1n;

      await pool.setSwapResult(refundBalance, -ethOut, ethOut);

      const [refundProof] = await createLowerProof(bridge, usdc, lowerAmount, user.address, randomBytes32());

      const tx = await bridge.connect(relayer1).relayerLower(gasCost, refundProof, true);
      const receipt = await tx.wait();

      const parsed = receipt.logs
        .filter(log => log.address === bridge.target)
        .map(log => {
          try {
            return bridge.interface.parseLog(log);
          } catch (_) {
            return null;
          }
        })
        .filter(Boolean);

      const eventNames = parsed.map(log => log.name);

      expect(eventNames.includes('LogRelayerLowered')).to.equal(true);
      expect(eventNames.includes('LogRefundFailed')).to.equal(false);
      expect(await bridge.relayerBalance(relayer1.address)).to.equal(1);
    });

    it('preserves relayer balance and emits LogRefundFailed when relayerLower refund attempt fails', async () => {
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

      const parsed = receipt.logs
        .filter(log => log.address === bridge.target)
        .map(log => {
          try {
            return bridge.interface.parseLog(log);
          } catch (_) {
            return null;
          }
        })
        .filter(Boolean);

      const refundFailed = parsed.find(log => log.name === 'LogRefundFailed');
      expect(refundFailed).to.not.equal(undefined);

      const balanceAfterLower = await bridge.relayerBalance(relayer1.address);
      expect(balanceAfterLower).to.be.greaterThan(balanceBeforeLower);
    });
  });
});
