import {
  EXPIRY_WINDOW,
  MIN_AUTHORS,
  deployFixture,
  expect,
  getAccounts,
  getAuthors,
  getConfirmations,
  getCurrentBlockTimestamp,
  getEthers,
  getSingleConfirmation,
  getValidExpiry,
  increaseBlockTimestamp,
  init,
  nextT2TxId,
  randomBytes32,
  randomHex,
  strip0x,
  toAuthorAccount
} from '../helper.js';

describe('PredictorBridge author tests', function () {
  let ethers;
  let owner;
  let bridge;
  let authors;
  let senderAuthor;
  let existingAuthor;
  let newAuthor;
  let prospectiveAuthor;

  beforeEach(async () => {
    await init({ numAuthors: 6 });
    ethers = getEthers();
    [owner, newAuthor, prospectiveAuthor] = getAccounts();
    ({ bridge } = await deployFixture({ numAuthors: 6 }));
    authors = getAuthors().slice(0, 6);
    senderAuthor = authors[0].account;
    existingAuthor = authors[1];
    newAuthor = toAuthorAccount(newAuthor);
    prospectiveAuthor = toAuthorAccount(prospectiveAuthor);
  });

  describe('publishRoot', function () {
    it('publishes via authors', async () => {
      const rootHash = randomBytes32();
      const t2TxId = nextT2TxId();
      const expiry = await getValidExpiry();
      const confirmations = await getConfirmations(bridge, 'publishRoot', [rootHash, expiry, t2TxId]);

      await expect(bridge.connect(senderAuthor).publishRoot(rootHash, expiry, t2TxId, confirmations))
        .to.emit(bridge, 'LogRootPublished')
        .withArgs(rootHash, t2TxId);

      expect(await bridge.isPublishedRootHash(rootHash)).to.equal(true);
    });

    it('accepts more than the required number of confirmations', async () => {
      const rootHash = randomBytes32();
      const t2TxId = nextT2TxId();
      const expiry = await getValidExpiry();

      const requiredPayload = await getConfirmations(bridge, 'publishRoot', [rootHash, expiry, t2TxId]);
      const extraSig = await getSingleConfirmation(bridge, authors[4], 'publishRoot', [rootHash, expiry, t2TxId]);
      const confirmations = requiredPayload + extraSig.slice(2);

      await expect(bridge.connect(senderAuthor).publishRoot(rootHash, expiry, t2TxId, confirmations))
        .to.emit(bridge, 'LogRootPublished')
        .withArgs(rootHash, t2TxId);

      expect(await bridge.isPublishedRootHash(rootHash)).to.equal(true);
    });

    it('returns early from confirmation verification once the recalculated threshold is reached', async () => {
      const expiry = await getValidExpiry();

      const addTxId = nextT2TxId();
      await bridge
        .connect(senderAuthor)
        .addAuthor(
          prospectiveAuthor.t1PubKey,
          prospectiveAuthor.t2PubKey,
          expiry,
          addTxId,
          await getConfirmations(bridge, 'addAuthor', [prospectiveAuthor.t1PubKey, prospectiveAuthor.t2PubKey, expiry, addTxId])
        );

      const authorId = await bridge.t1AddressToId(prospectiveAuthor.t1Address);
      expect(await bridge.authorIsActive(authorId)).to.equal(false);

      const rootHash = randomBytes32();
      const publishExpiry = await getValidExpiry();
      const publishTxId = nextT2TxId();
      const sigPending = await getSingleConfirmation(bridge, prospectiveAuthor, 'publishRoot', [rootHash, publishExpiry, publishTxId]);
      const sig1 = await getSingleConfirmation(bridge, authors[1], 'publishRoot', [rootHash, publishExpiry, publishTxId]);
      const sig2 = await getSingleConfirmation(bridge, authors[2], 'publishRoot', [rootHash, publishExpiry, publishTxId]);
      const sig3 = await getSingleConfirmation(bridge, authors[3], 'publishRoot', [rootHash, publishExpiry, publishTxId]);

      const confirmations = sigPending + sig1.slice(2) + sig2.slice(2) + sig3.slice(2);

      await expect(bridge.connect(senderAuthor).publishRoot(rootHash, publishExpiry, publishTxId, confirmations))
        .to.emit(bridge, 'LogRootPublished')
        .withArgs(rootHash, publishTxId);

      expect(await bridge.authorIsActive(authorId)).to.equal(true);
    });

    it('rejects when paused', async () => {
      const rootHash = randomBytes32();
      const t2TxId = nextT2TxId();
      const expiry = await getValidExpiry();
      const confirmations = await getConfirmations(bridge, 'publishRoot', [rootHash, expiry, t2TxId]);

      await bridge.pause();
      await expect(bridge.connect(senderAuthor).publishRoot(rootHash, expiry, t2TxId, confirmations)).to.be.revertedWithCustomError(bridge, 'EnforcedPause');
    });

    it('rejects expired call window', async () => {
      const rootHash = randomBytes32();
      const t2TxId = nextT2TxId();
      const expiry = (await getCurrentBlockTimestamp()) - 1;
      const confirmations = await getConfirmations(bridge, 'publishRoot', [rootHash, expiry, t2TxId]);

      await expect(bridge.connect(senderAuthor).publishRoot(rootHash, expiry, t2TxId, confirmations)).to.be.revertedWithCustomError(bridge, 'WindowExpired');
    });

    it('rejects reused tx id', async () => {
      const expiry = await getValidExpiry();
      const t2TxId = nextT2TxId();
      const rootHash1 = randomBytes32();
      const rootHash2 = randomBytes32();

      await bridge.connect(senderAuthor).publishRoot(rootHash1, expiry, t2TxId, await getConfirmations(bridge, 'publishRoot', [rootHash1, expiry, t2TxId]));

      await expect(
        bridge.connect(senderAuthor).publishRoot(rootHash2, expiry, t2TxId, await getConfirmations(bridge, 'publishRoot', [rootHash2, expiry, t2TxId]))
      ).to.be.revertedWithCustomError(bridge, 'TxIdIsUsed');
    });

    it('rejects reused root', async () => {
      const expiry = await getValidExpiry();
      const rootHash = randomBytes32();
      const t2TxId1 = nextT2TxId();
      const t2TxId2 = nextT2TxId();

      await bridge.connect(senderAuthor).publishRoot(rootHash, expiry, t2TxId1, await getConfirmations(bridge, 'publishRoot', [rootHash, expiry, t2TxId1]));

      await expect(
        bridge.connect(senderAuthor).publishRoot(rootHash, expiry, t2TxId2, await getConfirmations(bridge, 'publishRoot', [rootHash, expiry, t2TxId2]))
      ).to.be.revertedWithCustomError(bridge, 'RootHashIsUsed');
    });

    it('rejects malformed confirmations payload', async () => {
      const expiry = await getValidExpiry();
      const rootHash = randomBytes32();
      const t2TxId = nextT2TxId();
      const good = await getConfirmations(bridge, 'publishRoot', [rootHash, expiry, t2TxId]);

      await expect(bridge.connect(senderAuthor).publishRoot(rootHash, expiry, t2TxId, `0xbadd${strip0x(good)}`)).to.be.revertedWithCustomError(bridge, 'BadConfirmations');
    });

    it('rejects empty confirmations payload', async () => {
      const expiry = await getValidExpiry();
      const rootHash = randomBytes32();
      const t2TxId = nextT2TxId();

      await expect(bridge.connect(senderAuthor).publishRoot(rootHash, expiry, t2TxId, '0x')).to.be.revertedWithCustomError(bridge, 'BadConfirmations');
    });

    it('rejects insufficient confirmations', async () => {
      const expiry = await getValidExpiry();
      const rootHash = randomBytes32();
      const t2TxId = nextT2TxId();
      const confirmations = await getConfirmations(bridge, 'publishRoot', [rootHash, expiry, t2TxId], -1);

      await expect(bridge.connect(senderAuthor).publishRoot(rootHash, expiry, t2TxId, confirmations)).to.be.revertedWithCustomError(bridge, 'BadConfirmations');
    });

    it('rejects duplicate confirmations', async () => {
      const expiry = await getValidExpiry();
      const rootHash = randomBytes32();
      const t2TxId = nextT2TxId();
      const half = await getConfirmations(bridge, 'publishRoot', [rootHash, expiry, t2TxId], -2);

      await expect(bridge.connect(senderAuthor).publishRoot(rootHash, expiry, t2TxId, half + strip0x(half))).to.be.revertedWithCustomError(bridge, 'BadConfirmations');
    });
  });

  describe('addAuthor', function () {
    it('adds a new pending author and activates them when later seen in a valid proof', async () => {
      const activeBefore = await bridge.numActiveAuthors();
      const authorId = await bridge.nextAuthorId();
      const expiry = await getValidExpiry();
      const t2TxId = nextT2TxId();
      const confirmations = await getConfirmations(bridge, 'addAuthor', [newAuthor.t1PubKey, newAuthor.t2PubKey, expiry, t2TxId]);

      await expect(bridge.connect(senderAuthor).addAuthor(newAuthor.t1PubKey, newAuthor.t2PubKey, expiry, t2TxId, confirmations))
        .to.emit(bridge, 'LogAuthorAdded')
        .withArgs(newAuthor.t1Address, newAuthor.t2PubKey, t2TxId);

      expect(await bridge.idToT1Address(authorId)).to.equal(newAuthor.t1Address);
      expect(await bridge.authorIsActive(authorId)).to.equal(false);
      expect(await bridge.numActiveAuthors()).to.equal(activeBefore);

      const rootHash = randomBytes32();
      const publishExpiry = await getValidExpiry();
      const publishTxId = nextT2TxId();
      const existingConfirmations = await getConfirmations(bridge, 'publishRoot', [rootHash, publishExpiry, publishTxId]);
      const newAuthorSig = await getSingleConfirmation(bridge, newAuthor, 'publishRoot', [rootHash, publishExpiry, publishTxId]);
      const combined = newAuthorSig + existingConfirmations.slice(2);

      await bridge.connect(senderAuthor).publishRoot(rootHash, publishExpiry, publishTxId, combined);

      expect(await bridge.authorIsActive(authorId)).to.equal(true);
      expect(await bridge.numActiveAuthors()).to.equal(activeBefore + 1n);
    });

    it('rejects when paused', async () => {
      await bridge.pause();
      const expiry = await getValidExpiry();
      const t2TxId = nextT2TxId();
      const confirmations = await getConfirmations(bridge, 'addAuthor', [prospectiveAuthor.t1PubKey, prospectiveAuthor.t2PubKey, expiry, t2TxId]);

      await expect(bridge.connect(senderAuthor).addAuthor(prospectiveAuthor.t1PubKey, prospectiveAuthor.t2PubKey, expiry, t2TxId, confirmations)).to.be.revertedWithCustomError(
        bridge,
        'EnforcedPause'
      );
    });

    it('rejects invalid t1 key', async () => {
      const expiry = await getValidExpiry();
      const t2TxId = nextT2TxId();

      await expect(
        bridge
          .connect(senderAuthor)
          .addAuthor('0x', prospectiveAuthor.t2PubKey, expiry, t2TxId, await getConfirmations(bridge, 'addAuthor', ['0x', prospectiveAuthor.t2PubKey, expiry, t2TxId]))
      ).to.be.revertedWithCustomError(bridge, 'InvalidT1Key');
    });

    it('rejects invalid t2 key', async () => {
      const expiry = await getValidExpiry();
      const t2TxId = nextT2TxId();

      await expect(
        bridge
          .connect(senderAuthor)
          .addAuthor(
            prospectiveAuthor.t1PubKey,
            ethers.ZeroHash,
            expiry,
            t2TxId,
            await getConfirmations(bridge, 'addAuthor', [prospectiveAuthor.t1PubKey, ethers.ZeroHash, expiry, t2TxId])
          )
      ).to.be.revertedWithCustomError(bridge, 'InvalidT2Key');
    });

    it('rejects expired addAuthor call', async () => {
      const expiry = (await getCurrentBlockTimestamp()) - 1;
      const t2TxId = nextT2TxId();

      await expect(
        bridge
          .connect(senderAuthor)
          .addAuthor(
            prospectiveAuthor.t1PubKey,
            prospectiveAuthor.t2PubKey,
            expiry,
            t2TxId,
            await getConfirmations(bridge, 'addAuthor', [prospectiveAuthor.t1PubKey, prospectiveAuthor.t2PubKey, expiry, t2TxId])
          )
      ).to.be.revertedWithCustomError(bridge, 'WindowExpired');
    });

    it('rejects adding an already added author', async () => {
      const expiry = await getValidExpiry();
      const t2TxId = nextT2TxId();

      await expect(
        bridge
          .connect(senderAuthor)
          .addAuthor(
            existingAuthor.t1PubKey,
            existingAuthor.t2PubKey,
            expiry,
            t2TxId,
            await getConfirmations(bridge, 'addAuthor', [existingAuthor.t1PubKey, existingAuthor.t2PubKey, expiry, t2TxId])
          )
      ).to.be.revertedWithCustomError(bridge, 'AlreadyAdded');
    });

    it('rejects adding an author with an in-use t2 key', async () => {
      const expiry = await getValidExpiry();
      const t2TxId = nextT2TxId();

      await expect(
        bridge
          .connect(senderAuthor)
          .addAuthor(
            prospectiveAuthor.t1PubKey,
            existingAuthor.t2PubKey,
            expiry,
            t2TxId,
            await getConfirmations(bridge, 'addAuthor', [prospectiveAuthor.t1PubKey, existingAuthor.t2PubKey, expiry, t2TxId])
          )
      ).to.be.revertedWithCustomError(bridge, 'T2KeyInUse');
    });

    it('rejects re-adding a removed author with a changed t2 key', async () => {
      const expiry = await getValidExpiry();

      const removeTxId = nextT2TxId();
      await bridge
        .connect(senderAuthor)
        .removeAuthor(
          existingAuthor.t2PubKey,
          existingAuthor.t1PubKey,
          expiry,
          removeTxId,
          await getConfirmations(bridge, 'removeAuthor', [existingAuthor.t2PubKey, existingAuthor.t1PubKey, expiry, removeTxId])
        );

      const badReAddTxId = nextT2TxId();
      await expect(
        bridge
          .connect(senderAuthor)
          .addAuthor(
            existingAuthor.t1PubKey,
            newAuthor.t2PubKey,
            expiry,
            badReAddTxId,
            await getConfirmations(bridge, 'addAuthor', [existingAuthor.t1PubKey, newAuthor.t2PubKey, expiry, badReAddTxId])
          )
      ).to.be.revertedWithCustomError(bridge, 'CannotChangeT2Key');
    });

    it('re-adds a removed author with the same t2 key', async () => {
      const activeBeforeRemove = await bridge.numActiveAuthors();
      const expiry = await getValidExpiry();

      const removeTxId = nextT2TxId();
      await expect(
        bridge
          .connect(senderAuthor)
          .removeAuthor(
            existingAuthor.t2PubKey,
            existingAuthor.t1PubKey,
            expiry,
            removeTxId,
            await getConfirmations(bridge, 'removeAuthor', [existingAuthor.t2PubKey, existingAuthor.t1PubKey, expiry, removeTxId])
          )
      ).to.emit(bridge, 'LogAuthorRemoved');

      const authorId = await bridge.t1AddressToId(existingAuthor.t1Address);
      expect(await bridge.isAuthor(authorId)).to.equal(false);
      expect(await bridge.authorIsActive(authorId)).to.equal(false);
      expect(await bridge.numActiveAuthors()).to.equal(activeBeforeRemove - 1n);

      const reAddTxId = nextT2TxId();
      await expect(
        bridge
          .connect(senderAuthor)
          .addAuthor(
            existingAuthor.t1PubKey,
            existingAuthor.t2PubKey,
            expiry,
            reAddTxId,
            await getConfirmations(bridge, 'addAuthor', [existingAuthor.t1PubKey, existingAuthor.t2PubKey, expiry, reAddTxId])
          )
      )
        .to.emit(bridge, 'LogAuthorAdded')
        .withArgs(existingAuthor.t1Address, existingAuthor.t2PubKey, reAddTxId);

      expect(await bridge.isAuthor(authorId)).to.equal(true);
      expect(await bridge.idToT1Address(authorId)).to.equal(existingAuthor.t1Address);
      expect(await bridge.idToT2PubKey(authorId)).to.equal(existingAuthor.t2PubKey);
      expect(await bridge.authorIsActive(authorId)).to.equal(false);
      expect(await bridge.numActiveAuthors()).to.equal(activeBeforeRemove - 1n);
    });

    it('rejects adding a new author once max authors is reached', async () => {
      const INITIAL_AUTHORS = 50;
      const MAX_AUTHORS = 255;
      const AUTHORS_TO_ADD = MAX_AUTHORS - INITIAL_AUTHORS;

      await init({ numAuthors: INITIAL_AUTHORS });
      ethers = getEthers();
      ({ bridge } = await deployFixture({ numAuthors: INITIAL_AUTHORS }));
      authors = getAuthors().slice(0, INITIAL_AUTHORS);
      senderAuthor = authors[0].account;

      for (let i = 0; i < AUTHORS_TO_ADD; i++) {
        const t1PubKey = randomHex(64);
        const t2PubKey = randomBytes32();
        const expiry = await getValidExpiry();
        const t2TxId = nextT2TxId();

        await bridge.connect(senderAuthor).addAuthor(t1PubKey, t2PubKey, expiry, t2TxId, await getConfirmations(bridge, 'addAuthor', [t1PubKey, t2PubKey, expiry, t2TxId]));
      }

      expect(await bridge.nextAuthorId()).to.equal(256);

      const extraT1PubKey = randomHex(64);
      const extraT2PubKey = randomBytes32();
      const extraExpiry = await getValidExpiry();
      const extraT2TxId = nextT2TxId();

      await expect(
        bridge
          .connect(senderAuthor)
          .addAuthor(
            extraT1PubKey,
            extraT2PubKey,
            extraExpiry,
            extraT2TxId,
            await getConfirmations(bridge, 'addAuthor', [extraT1PubKey, extraT2PubKey, extraExpiry, extraT2TxId])
          )
      ).to.be.revertedWithCustomError(bridge, 'TooManyAuthors');
    });
  });

  describe('removeAuthor', function () {
    it('removes an active author', async () => {
      const activeBefore = await bridge.numActiveAuthors();
      const target = authors[4];
      const expiry = await getValidExpiry();
      const t2TxId = nextT2TxId();
      const confirmations = await getConfirmations(bridge, 'removeAuthor', [target.t2PubKey, target.t1PubKey, expiry, t2TxId]);

      await expect(bridge.connect(senderAuthor).removeAuthor(target.t2PubKey, target.t1PubKey, expiry, t2TxId, confirmations))
        .to.emit(bridge, 'LogAuthorRemoved')
        .withArgs(target.t1Address, target.t2PubKey, t2TxId);

      expect(await bridge.isAuthor(await bridge.t1AddressToId(target.t1Address))).to.equal(false);
      expect(await bridge.numActiveAuthors()).to.equal(activeBefore - 1n);
    });

    it('removes a pending inactive author without changing active count', async () => {
      const activeBefore = await bridge.numActiveAuthors();
      const pending = prospectiveAuthor;
      const addExpiry = await getValidExpiry();
      const addTxId = nextT2TxId();

      await bridge
        .connect(senderAuthor)
        .addAuthor(
          pending.t1PubKey,
          pending.t2PubKey,
          addExpiry,
          addTxId,
          await getConfirmations(bridge, 'addAuthor', [pending.t1PubKey, pending.t2PubKey, addExpiry, addTxId])
        );

      const removeExpiry = await getValidExpiry();
      const removeTxId = nextT2TxId();
      await bridge
        .connect(senderAuthor)
        .removeAuthor(
          pending.t2PubKey,
          pending.t1PubKey,
          removeExpiry,
          removeTxId,
          await getConfirmations(bridge, 'removeAuthor', [pending.t2PubKey, pending.t1PubKey, removeExpiry, removeTxId])
        );

      expect(await bridge.numActiveAuthors()).to.equal(activeBefore);
    });

    it('rejects removeAuthor when paused', async () => {
      await bridge.pause();
      const expiry = await getValidExpiry();
      const t2TxId = nextT2TxId();

      await expect(
        bridge
          .connect(senderAuthor)
          .removeAuthor(
            authors[0].t2PubKey,
            authors[0].t1PubKey,
            expiry,
            t2TxId,
            await getConfirmations(bridge, 'removeAuthor', [authors[0].t2PubKey, authors[0].t1PubKey, expiry, t2TxId])
          )
      ).to.be.revertedWithCustomError(bridge, 'EnforcedPause');
    });

    it('rejects invalid t1 key on removeAuthor', async () => {
      const expiry = await getValidExpiry();
      const t2TxId = nextT2TxId();
      const invalidT1Key = randomHex(17);

      await expect(
        bridge.removeAuthor(
          authors[0].t2PubKey,
          invalidT1Key,
          expiry,
          t2TxId,
          await getConfirmations(bridge, 'removeAuthor', [authors[0].t2PubKey, invalidT1Key, expiry, t2TxId])
        )
      ).to.be.revertedWithCustomError(bridge, 'InvalidT1Key');
    });

    it('rejects expired removeAuthor call', async () => {
      const expired = (await getCurrentBlockTimestamp()) - 1;
      const expiredTxId = nextT2TxId();

      await expect(
        bridge.removeAuthor(
          authors[0].t2PubKey,
          authors[0].t1PubKey,
          expired,
          expiredTxId,
          await getConfirmations(bridge, 'removeAuthor', [authors[0].t2PubKey, authors[0].t1PubKey, expired, expiredTxId])
        )
      ).to.be.revertedWithCustomError(bridge, 'WindowExpired');
    });

    it('rejects removing a non-author', async () => {
      const expiry = await getValidExpiry();
      const t2TxId = nextT2TxId();

      await expect(
        bridge
          .connect(senderAuthor)
          .removeAuthor(
            prospectiveAuthor.t2PubKey,
            prospectiveAuthor.t1PubKey,
            expiry,
            t2TxId,
            await getConfirmations(bridge, 'removeAuthor', [prospectiveAuthor.t2PubKey, prospectiveAuthor.t1PubKey, expiry, t2TxId])
          )
      ).to.be.revertedWithCustomError(bridge, 'NotAnAuthor');
    });

    it('rejects removing an author when it would take active authors below minimum', async () => {
      // With 6 starting authors and MIN_AUTHORS = 4, remove exactly two authors.
      for (let i = authors.length - 1; i >= MIN_AUTHORS; i--) {
        const target = authors[i];
        const expiry = await getValidExpiry();
        const t2TxId = nextT2TxId();

        await bridge
          .connect(senderAuthor)
          .removeAuthor(target.t2PubKey, target.t1PubKey, expiry, t2TxId, await getConfirmations(bridge, 'removeAuthor', [target.t2PubKey, target.t1PubKey, expiry, t2TxId]));
      }

      expect(await bridge.numActiveAuthors()).to.equal(BigInt(MIN_AUTHORS));

      // Pick one of the still-active authors.
      const finalTarget = authors[0];
      const finalExpiry = await getValidExpiry();
      const finalTxId = nextT2TxId();

      await expect(
        bridge
          .connect(senderAuthor)
          .removeAuthor(
            finalTarget.t2PubKey,
            finalTarget.t1PubKey,
            finalExpiry,
            finalTxId,
            await getConfirmations(bridge, 'removeAuthor', [finalTarget.t2PubKey, finalTarget.t1PubKey, finalExpiry, finalTxId])
          )
      ).to.be.revertedWithCustomError(bridge, 'NotEnoughAuthors');
    });
  });

  describe('corroborate', function () {
    it('returns pending / failed / succeeded states', async () => {
      const pendingId = nextT2TxId();
      const pendingExpiry = await getValidExpiry();
      expect(await bridge.corroborate(pendingId, pendingExpiry)).to.equal(0);

      const failedId = nextT2TxId();
      const failedExpiry = await getValidExpiry();
      const failedRoot = randomBytes32();
      await bridge.pause();
      await expect(
        bridge.connect(senderAuthor).publishRoot(failedRoot, failedExpiry, failedId, await getConfirmations(bridge, 'publishRoot', [failedRoot, failedExpiry, failedId]))
      ).to.be.revertedWithCustomError(bridge, 'EnforcedPause');
      await increaseBlockTimestamp(EXPIRY_WINDOW + 1);
      await bridge.unpause();
      expect(await bridge.corroborate(failedId, failedExpiry)).to.equal(-1);

      const successId = nextT2TxId();
      const successExpiry = await getValidExpiry();
      const successRoot = randomBytes32();
      await bridge
        .connect(senderAuthor)
        .publishRoot(successRoot, successExpiry, successId, await getConfirmations(bridge, 'publishRoot', [successRoot, successExpiry, successId]));
      expect(await bridge.corroborate(successId, successExpiry)).to.equal(1);
    });
  });
});
