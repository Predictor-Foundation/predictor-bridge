import {
  OWNER_REVERT_LOWER_DELAY,
  SANCTIONED_ADDRESS,
  createLowerProof,
  createTreeAndPublishRoot,
  deployFixture,
  expect,
  getAccounts,
  getAuthors,
  getConfirmations,
  getEthers,
  getNumRequiredConfirmations,
  getPermit,
  getValidExpiry,
  impersonateAccount,
  init,
  nextT2TxId,
  randomBytes32,
  stopImpersonatingAccount,
  toAuthorAccount
} from '../helper.js';

describe('PredictorBridge user tests', function () {
  let authors;
  let ethers;
  let owner;
  let user;
  let bridge;
  let token;
  let usdc;
  let usdt;
  let sanctions;
  let t2PubKey;

  beforeEach(async () => {
    await init({ numAuthors: 5 });
    ethers = getEthers();
    [owner, user] = getAccounts();
    ({ bridge, sanctions, token, usdc, usdt } = await deployFixture({ numAuthors: 5 }));
    t2PubKey = await bridge.deriveT2PublicKey(owner.address);
  });

  describe('deriveT2PublicKey', function () {
    it('derives deterministic key from address', async () => {
      expect(await bridge.deriveT2PublicKey(owner.address)).to.equal(ethers.keccak256(ethers.solidityPacked(['address'], [owner.address])));
    });
  });

  describe('lift variants', function () {
    const amount = 100n;

    it('lifts via approve + lift', async () => {
      await token.approve(bridge.target, amount);
      await expect(bridge.lift(token.target, t2PubKey, amount))
        .to.emit(bridge, 'LogLifted')
        .withArgs(token.target, t2PubKey, amount);
    });

    it('lifts via permitLift', async () => {
      const permit = await getPermit(token, owner, bridge, amount);
      await expect(bridge.permitLift(token.target, t2PubKey, amount, permit.deadline, permit.v, permit.r, permit.s))
        .to.emit(bridge, 'LogLifted')
        .withArgs(token.target, t2PubKey, amount);
    });

    it('lifts via predictionMarketLift with USDC', async () => {
      await usdc.approve(bridge.target, amount);
      await expect(bridge.predictionMarketLift(usdc.target, amount))
        .to.emit(bridge, 'LogLiftedToPredictionMarket')
        .withArgs(usdc.target, await bridge.deriveT2PublicKey(owner.address), amount);
    });

    it('lifts via predictionMarketLift with USDT', async () => {
      await usdt.approve(bridge.target, amount);
      await expect(bridge.predictionMarketLift(usdt.target, amount))
        .to.emit(bridge, 'LogLiftedToPredictionMarket')
        .withArgs(usdt.target, await bridge.deriveT2PublicKey(owner.address), amount);
    });

    it('lifts via predictionMarketRecipientLift with USDC', async () => {
      const recipientT2 = randomBytes32();
      await usdc.approve(bridge.target, amount);
      await expect(bridge.predictionMarketRecipientLift(usdc.target, recipientT2, amount))
        .to.emit(bridge, 'LogLiftedToPredictionMarket')
        .withArgs(usdc.target, recipientT2, amount);
    });

    it('lifts via predictionMarketRecipientLift with USDT', async () => {
      const recipientT2 = randomBytes32();
      await usdt.approve(bridge.target, amount);
      await expect(bridge.predictionMarketRecipientLift(usdt.target, recipientT2, amount))
        .to.emit(bridge, 'LogLiftedToPredictionMarket')
        .withArgs(usdt.target, recipientT2, amount);
    });

    it('lifts via predictionMarketPermitLift', async () => {
      const permit = await getPermit(usdc, owner, bridge, amount);
      await expect(bridge.predictionMarketPermitLift(amount, permit.deadline, permit.v, permit.r, permit.s))
        .to.emit(bridge, 'LogLiftedToPredictionMarket')
        .withArgs(usdc.target, await bridge.deriveT2PublicKey(owner.address), amount);
    });

    it('rejects invalid token for predictionMarketLift', async () => {
      await token.approve(bridge.target, amount);
      await expect(bridge.predictionMarketLift(token.target, amount)).to.be.revertedWithCustomError(bridge, 'InvalidToken');
    });

    it('rejects invalid token for predictionMarketRecipientLift', async () => {
      await token.approve(bridge.target, amount);
      await expect(bridge.predictionMarketRecipientLift(token.target, randomBytes32(), amount)).to.be.revertedWithCustomError(bridge, 'InvalidToken');
    });

    it('rejects zero amount', async () => {
      await token.approve(bridge.target, 0);
      await expect(bridge.lift(token.target, t2PubKey, 0)).to.be.revertedWithCustomError(bridge, 'AmountIsZero');
    });

    it('rejects lift when token burns the full amount on transfer', async () => {
      const BurnOnTransfer = await ethers.getContractFactory('MockBurnOnTransferERC20Permit');
      const burnToken = await BurnOnTransfer.deploy('Burn', 'BURN', 18, owner.address, 1_000_000n, 10_000); // 100% burn
      const amount = 100n;
      await burnToken.approve(bridge.target, amount);
      await expect(bridge.lift(burnToken.target, t2PubKey, amount)).to.be.revertedWithCustomError(bridge, 'LiftFailed');
    });

    it('rejects zero t2 key for lift', async () => {
      await token.approve(bridge.target, amount);
      await expect(bridge.lift(token.target, ethers.ZeroHash, amount)).to.be.revertedWithCustomError(bridge, 'InvalidT2Key');
    });

    it('rejects zero t2 key for permitLift', async () => {
      const permit = await getPermit(token, owner, bridge, amount);
      await expect(bridge.permitLift(token.target, ethers.ZeroHash, amount, permit.deadline, permit.v, permit.r, permit.s)).to.be.revertedWithCustomError(
        bridge,
        'InvalidT2Key'
      );
    });

    it('rejects zero t2 key for predictionMarketRecipientLift', async () => {
      await usdt.approve(bridge.target, amount);
      await expect(bridge.predictionMarketRecipientLift(usdt.target, ethers.ZeroHash, amount)).to.be.revertedWithCustomError(bridge, 'InvalidT2Key');
    });

    it('rejects lift when paused', async () => {
      await bridge.pause();
      await token.approve(bridge.target, amount);
      await expect(bridge.lift(token.target, t2PubKey, amount)).to.be.revertedWithCustomError(bridge, 'EnforcedPause');
    });

    it('rejects permitLift when paused', async () => {
      await bridge.pause();
      const permit = await getPermit(token, owner, bridge, amount);
      await expect(bridge.permitLift(token.target, t2PubKey, amount, permit.deadline, permit.v, permit.r, permit.s)).to.be.revertedWithCustomError(bridge, 'EnforcedPause');
    });

    it('rejects predictionMarketLift when paused', async () => {
      await bridge.pause();
      await token.approve(bridge.target, amount);
      await expect(bridge.predictionMarketLift(token.target, amount)).to.be.revertedWithCustomError(bridge, 'EnforcedPause');
    });

    it('rejects predictionMarketRecipientLift when paused', async () => {
      await bridge.pause();
      await token.approve(bridge.target, amount);
      await expect(bridge.predictionMarketRecipientLift(token.target, randomBytes32(), amount)).to.be.revertedWithCustomError(bridge, 'EnforcedPause');
    });

    it('rejects predictionMarketPermitLift when paused', async () => {
      await bridge.pause();
      const permit = await getPermit(usdc, owner, bridge, amount);
      await expect(bridge.predictionMarketPermitLift(amount, permit.deadline, permit.v, permit.r, permit.s)).to.be.revertedWithCustomError(bridge, 'EnforcedPause');
    });
    it('rejects sanctioned sender for lift', async () => {
      await sanctions.setSanctioned(SANCTIONED_ADDRESS, true);
      await impersonateAccount(SANCTIONED_ADDRESS);
      const sanctioned = await ethers.getSigner(SANCTIONED_ADDRESS);

      await expect(bridge.connect(sanctioned).lift(token.target, t2PubKey, amount)).to.be.revertedWithCustomError(bridge, 'AddressBlocked');

      await stopImpersonatingAccount(SANCTIONED_ADDRESS);
    });

    it('rejects sanctioned sender for predictionMarketLift', async () => {
      await sanctions.setSanctioned(SANCTIONED_ADDRESS, true);
      await impersonateAccount(SANCTIONED_ADDRESS);
      const sanctioned = await ethers.getSigner(SANCTIONED_ADDRESS);

      await expect(bridge.connect(sanctioned).predictionMarketLift(token.target, amount)).to.be.revertedWithCustomError(bridge, 'AddressBlocked');

      await stopImpersonatingAccount(SANCTIONED_ADDRESS);
    });

    it('rejects sanctioned sender for predictionMarketRecipientLift', async () => {
      await sanctions.setSanctioned(SANCTIONED_ADDRESS, true);
      await impersonateAccount(SANCTIONED_ADDRESS);
      const sanctioned = await ethers.getSigner(SANCTIONED_ADDRESS);

      await expect(bridge.connect(sanctioned).predictionMarketRecipientLift(token.target, randomBytes32(), amount)).to.be.revertedWithCustomError(bridge, 'AddressBlocked');

      await stopImpersonatingAccount(SANCTIONED_ADDRESS);
    });

    it('rejects exceeding token limit', async () => {
      const Huge = await ethers.getContractFactory('MockERC20Permit');
      const huge = await Huge.deploy('Huge', 'HUGE', 18, owner.address, 2n ** 140n);
      const max = 2n ** 128n - 1n;
      await huge.approve(bridge.target, max);
      await bridge.lift(huge.target, t2PubKey, max);
      await huge.approve(bridge.target, 1n);
      await expect(bridge.lift(huge.target, t2PubKey, 1n)).to.be.revertedWithCustomError(bridge, 'LiftLimitHit');
    });
  });

  describe('claimLower / checkLower / revertLower', function () {
    const amount = 50n;

    beforeEach(async () => {
      await token.approve(bridge.target, amount);
      await bridge.lift(token.target, t2PubKey, amount);
    });

    it('claims a valid lower', async () => {
      const bridgeBalBefore = await token.balanceOf(bridge.target);
      const ownerBalBefore = await token.balanceOf(owner.address);
      const [lowerProof, lowerId] = await createLowerProof(bridge, token, amount, owner.address, randomBytes32());

      await expect(bridge.connect(user).claimLower(lowerProof)).to.emit(bridge, 'LogLowerClaimed').withArgs(lowerId);
      expect(await token.balanceOf(bridge.target)).to.equal(bridgeBalBefore - amount);
      expect(await token.balanceOf(owner.address)).to.equal(ownerBalBefore + amount);
    });

    it('returns early from the activation branch when a pending author is seen after enough active confirmations', async () => {
      await init({ numAuthors: 4 });
      ethers = getEthers();
      [owner, user] = getAccounts();
      ({ bridge, sanctions, token } = await deployFixture({ numAuthors: 4 }));
      authors = getAuthors().slice(0, 4);

      const senderAuthor = authors[0].account;
      const pendingAuthor = toAuthorAccount(ethers.Wallet.createRandom().connect(ethers.provider));

      const amount = 50n;
      const t2PubKey = await bridge.deriveT2PublicKey(owner.address);

      await token.approve(bridge.target, amount);
      await bridge.lift(token.target, t2PubKey, amount);

      const addExpiry = await getValidExpiry();
      const addTxId = nextT2TxId();

      await bridge
        .connect(senderAuthor)
        .addAuthor(
          pendingAuthor.t1PubKey,
          pendingAuthor.t2PubKey,
          addExpiry,
          addTxId,
          await getConfirmations(bridge, 'addAuthor', [pendingAuthor.t1PubKey, pendingAuthor.t2PubKey, addExpiry, addTxId])
        );

      const pendingAuthorId = await bridge.t1AddressToId(pendingAuthor.t1Address);
      expect(await bridge.isAuthor(pendingAuthorId)).to.equal(true);
      expect(await bridge.authorIsActive(pendingAuthorId)).to.equal(false);

      const [lowerProof, lowerId] = await createLowerProof(bridge, token, amount, owner.address, randomBytes32(), Math.floor(Date.now() / 1000), [
        authors[1],
        authors[2],
        pendingAuthor
      ]);

      await expect(bridge.claimLower(lowerProof)).to.emit(bridge, 'LogLowerClaimed').withArgs(lowerId);

      expect(await bridge.authorIsActive(pendingAuthorId)).to.equal(true);
    });

    it('rejects invalid lower proof on claimLower', async () => {
      await expect(bridge.claimLower(randomBytes32())).to.be.revertedWithCustomError(bridge, 'InvalidProof');
    });

    it('rejects used lower proof on claimLower', async () => {
      const [lowerProof] = await createLowerProof(bridge, token, amount, owner.address, randomBytes32());
      await bridge.claimLower(lowerProof);
      await expect(bridge.claimLower(lowerProof)).to.be.revertedWithCustomError(bridge, 'LowerIsUsed');
    });

    it('rejects zero recipient on claimLower', async () => {
      const [zeroRecipientProof] = await createLowerProof(bridge, token, amount, ethers.ZeroAddress, randomBytes32());
      await expect(bridge.claimLower(zeroRecipientProof)).to.be.revertedWithCustomError(bridge, 'AddressIsZero');
    });

    it('checkLower returns expected data for valid unused proof', async () => {
      const t2Sender = randomBytes32();
      const t2Timestamp = Math.floor(Date.now() / 1000);
      const [lowerProof, lowerId] = await createLowerProof(bridge, token, amount, owner.address, t2Sender, t2Timestamp);
      const result = await bridge.checkLower(lowerProof);
      const required = await getNumRequiredConfirmations(bridge);

      expect(result.token).to.equal(token.target);
      expect(result.amount).to.equal(amount);
      expect(result.recipient).to.equal(owner.address);
      expect(result.lowerId).to.equal(lowerId);
      expect(result.t2Sender).to.equal(t2Sender);
      expect(result.t2Timestamp).to.equal(t2Timestamp);
      expect(result.confirmationsRequired).to.equal(required);
      expect(result.confirmationsProvided).to.equal(required);
      expect(result.proofIsValid).to.equal(true);
      expect(result.lowerIsUsed).to.equal(false);
    });

    it('checkLower returns used after claim', async () => {
      const [lowerProof] = await createLowerProof(bridge, token, amount, owner.address, randomBytes32());
      await bridge.claimLower(lowerProof);
      const result = await bridge.checkLower(lowerProof);
      expect(result.lowerIsUsed).to.equal(true);
    });

    it('checkLower returns invalid details for malformed proof', async () => {
      const result = await bridge.checkLower(randomBytes32());
      expect(result.token).to.equal(ethers.ZeroAddress);
      expect(result.amount).to.equal(0);
      expect(result.recipient).to.equal(ethers.ZeroAddress);
      expect(result.lowerId).to.equal(0);
      expect(result.t2Sender).to.equal(ethers.ZeroHash);
      expect(result.t2Timestamp).to.equal(0);
      expect(result.confirmationsRequired).to.equal(0);
      expect(result.confirmationsProvided).to.equal(0);
      expect(result.proofIsValid).to.equal(false);
      expect(result.lowerIsUsed).to.equal(false);
    });

    it('checkLower decrements confirmationsProvided for duplicate confirmations', async () => {
      const [lowerProof] = await createLowerProof(bridge, token, amount, owner.address, randomBytes32());
      const lowerDataLength = 20 + 32 + 20 + 4 + 32 + 8;
      const sigLength = 65;
      const lowerData = lowerProof.slice(0, 2 + lowerDataLength * 2);
      const sigs = lowerProof.slice(2 + lowerDataLength * 2);
      const firstSig = `0x${sigs.slice(0, sigLength * 2)}`;
      const duplicatedProof = `${lowerData}${sigs}${firstSig.slice(2)}`;
      const result = await bridge.checkLower(duplicatedProof);
      const required = await getNumRequiredConfirmations(bridge);

      expect(result.confirmationsRequired).to.equal(required);
      expect(result.confirmationsProvided).to.equal(required);
      expect(result.proofIsValid).to.equal(true);
    });

    it('recipient can revert valid lower', async () => {
      const recipient = user;
      const [lowerProof, lowerId, t2Sender] = await createLowerProof(bridge, token, amount, recipient.address, randomBytes32());
      const bridgeBalBefore = await token.balanceOf(bridge.target);
      const recipientBalBefore = await token.balanceOf(recipient.address);

      await expect(bridge.connect(recipient).revertLower(lowerProof)).to.emit(bridge, 'LogLowerReverted').withArgs(token.target, t2Sender, recipient.address, amount, lowerId);

      expect(await token.balanceOf(bridge.target)).to.equal(bridgeBalBefore);
      expect(await token.balanceOf(recipient.address)).to.equal(recipientBalBefore);
      await expect(bridge.claimLower(lowerProof)).to.be.revertedWithCustomError(bridge, 'LowerIsUsed');
    });

    it('rejects early owner revert', async () => {
      const recipient = user;
      const [lowerProof, lowerId, t2Sender] = await createLowerProof(bridge, token, amount, recipient.address, randomBytes32());
      await expect(bridge.connect(owner).revertLower(lowerProof)).to.be.revertedWithCustomError(bridge, 'PermissionDenied');
    });

    it('owner can revert after delay', async () => {
      const oldTimestamp = Math.floor(Date.now() / 1000) - OWNER_REVERT_LOWER_DELAY - 100;
      const recipient = user;
      const [lowerProof, lowerId, t2Sender] = await createLowerProof(bridge, token, amount, recipient.address, randomBytes32(), oldTimestamp);

      await expect(bridge.connect(owner).revertLower(lowerProof)).to.emit(bridge, 'LogLowerReverted').withArgs(token.target, t2Sender, recipient.address, amount, lowerId);
    });

    it('rejects random caller revert', async () => {
      const [lowerProof] = await createLowerProof(bridge, token, amount, owner.address, randomBytes32());
      await expect(bridge.connect(user).revertLower(lowerProof)).to.be.revertedWithCustomError(bridge, 'PermissionDenied');
    });

    it('rejects legacy lower revert', async () => {
      const [legacyLowerProof] = await createLowerProof(bridge, token, amount, owner.address, ethers.ZeroHash);
      await expect(bridge.connect(owner).revertLower(legacyLowerProof)).to.be.revertedWithCustomError(bridge, 'LegacyLower');
    });

    it('rejects invalid proof on revertLower', async () => {
      await expect(bridge.revertLower(randomBytes32())).to.be.revertedWithCustomError(bridge, 'InvalidProof');
    });

    it('rejects used proof on revertLower', async () => {
      const [usedProof] = await createLowerProof(bridge, token, amount, owner.address, randomBytes32(), Math.floor(Date.now() / 1000) - OWNER_REVERT_LOWER_DELAY - 10);

      await bridge.connect(owner).revertLower(usedProof);
      await expect(bridge.connect(owner).revertLower(usedProof)).to.be.revertedWithCustomError(bridge, 'LowerIsUsed');
    });
  });

  describe('reentrancy', function () {
    let reentrantToken;
    const amount = 100n;

    beforeEach(async () => {
      const ReentrantToken = await ethers.getContractFactory('MockReentrantToken');
      reentrantToken = await ReentrantToken.deploy(bridge.target);
      await reentrantToken.approve(bridge.target, amount * 5n);
    });

    it('rejects reentrant call paths', async () => {
      for (const point of [0, 1, 2, 3, 4, 5]) {
        await reentrantToken.setReentryPoint(point);
        await expect(bridge.lift(reentrantToken.target, t2PubKey, amount)).to.be.revertedWithCustomError(bridge, 'ReentrancyGuardReentrantCall');
      }
    });
  });

  describe('confirmTransaction', function () {
    it('confirms leaf inclusion against published root', async () => {
      const tree = await createTreeAndPublishRoot(bridge, token.target, 0n, owner.address);
      expect(await bridge.confirmTransaction(tree.leafHash, tree.merklePath)).to.equal(true);
      expect(await bridge.confirmTransaction(randomBytes32(), tree.merklePath)).to.equal(false);
    });
  });
});
