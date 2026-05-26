import { createLowerProof, createTreeAndPublishRoot, deployFixture, expect, getAccounts, getAuthors, getEthers, init, toAuthorAccount } from '../helper.js';

describe('PredictorBridgeResettable', function () {
  let ethers;
  let owner;
  let user;
  let bridge;
  let token;
  let originalAuthors;

  beforeEach(async () => {
    await init({ numAuthors: 6 });
    ethers = getEthers();
    [owner, user] = getAccounts();
    originalAuthors = getAuthors().slice(0, 5);
    ({ bridge, token } = await deployFixture({ numAuthors: 5, contractName: 'PredictorBridgeResettable' }));
  });

  it('resetState clears per-run bridge state and bumps the nonce', async () => {
    const amount = 100n;

    await token.approve(bridge.target, amount);
    await bridge.lift(token.target, await bridge.deriveT2PublicKey(owner.address), amount);

    const merkleTree = await createTreeAndPublishRoot(bridge, token.target, amount, owner.address);
    const lastT2TxId = 1;

    const [lowerProof, lowerId] = await createLowerProof(bridge, token, amount, user);
    await bridge.claimLower(lowerProof);

    expect(await bridge.isPublishedRootHash(merkleTree.rootHash)).to.equal(true);
    expect(await bridge.isUsedLower(lowerId)).to.equal(true);
    expect(await bridge.corroborate(lastT2TxId, 0)).to.equal(1);
    expect(await bridge.resetNonce()).to.equal(0);

    await expect(bridge.resetState(lowerId, lastT2TxId, [merkleTree.rootHash]))
      .to.emit(bridge, 'LogReset')
      .withArgs(1);

    expect(await bridge.isPublishedRootHash(merkleTree.rootHash)).to.equal(false);
    expect(await bridge.isUsedLower(lowerId)).to.equal(false);
    expect(await bridge.corroborate(lastT2TxId, 0)).to.equal(-1);
    expect(await bridge.resetNonce()).to.equal(1);
  });

  it('resetState preserves the existing author set', async () => {
    await bridge.resetState(0, 0, []);

    expect(await bridge.numActiveAuthors()).to.equal(BigInt(originalAuthors.length));
    for (const author of originalAuthors) {
      const id = await bridge.t1AddressToId(author.t1Address);
      expect(id).to.not.equal(0);
      expect(await bridge.isAuthor(id)).to.equal(true);
      expect(await bridge.authorIsActive(id)).to.equal(true);
    }
  });

  it('resetAuthors clears existing authors and re-seeds with replacements', async () => {
    const replacementAuthors = [];
    while (replacementAuthors.length < 4) {
      const signer = ethers.Wallet.createRandom().connect(ethers.provider);
      await owner.sendTransaction({ to: signer.address, value: ethers.parseEther('1') });
      replacementAuthors.push(toAuthorAccount(signer));
    }

    await expect(
      bridge.resetAuthors(
        replacementAuthors.map(a => a.t1Address),
        replacementAuthors.map(a => a.t1PubKeyLHS),
        replacementAuthors.map(a => a.t1PubKeyRHS),
        replacementAuthors.map(a => a.t2PubKey)
      )
    ).to.emit(bridge, 'LogAuthorsReset');

    for (const old of originalAuthors) {
      expect(await bridge.t1AddressToId(old.t1Address)).to.equal(0);
      expect(await bridge.t2PubKeyToId(old.t2PubKey)).to.equal(0);
    }
    expect(await bridge.numActiveAuthors()).to.equal(BigInt(replacementAuthors.length));
    expect(await bridge.nextAuthorId()).to.equal(BigInt(replacementAuthors.length + 1));
    for (let i = 0; i < replacementAuthors.length; i++) {
      const id = i + 1;
      expect(await bridge.idToT1Address(id)).to.equal(replacementAuthors[i].t1Address);
      expect(await bridge.idToT2PubKey(id)).to.equal(replacementAuthors[i].t2PubKey);
      expect(await bridge.isAuthor(id)).to.equal(true);
      expect(await bridge.authorIsActive(id)).to.equal(true);
    }
  });

  it('rejects non-owner calls to resetState and resetAuthors', async () => {
    await expect(bridge.connect(user).resetState(0, 0, [])).to.be.revertedWithCustomError(bridge, 'OwnableUnauthorizedAccount');
    await expect(bridge.connect(user).resetAuthors([], [], [], [])).to.be.revertedWithCustomError(bridge, 'OwnableUnauthorizedAccount');
  });

  it('preserves owner across resets', async () => {
    const fresh = [];
    while (fresh.length < 4) {
      const signer = ethers.Wallet.createRandom().connect(ethers.provider);
      await owner.sendTransaction({ to: signer.address, value: ethers.parseEther('1') });
      fresh.push(toAuthorAccount(signer));
    }

    await bridge.resetState(0, 0, []);
    await bridge.resetAuthors(
      fresh.map(a => a.t1Address),
      fresh.map(a => a.t1PubKeyLHS),
      fresh.map(a => a.t1PubKeyRHS),
      fresh.map(a => a.t2PubKey)
    );

    expect(await bridge.owner()).to.equal(owner.address);
  });

  it('lets the same lowerId be claimed again after resetState', async () => {
    const amount = 50n;
    await token.approve(bridge.target, amount * 2n);
    await bridge.lift(token.target, await bridge.deriveT2PublicKey(owner.address), amount * 2n);

    const [firstProof, lowerId] = await createLowerProof(bridge, token, amount, user);
    await bridge.claimLower(firstProof);
    await expect(bridge.claimLower(firstProof)).to.be.revertedWithCustomError(bridge, 'LowerIsUsed');

    await bridge.resetState(lowerId, 0, []);
    expect(await bridge.isUsedLower(lowerId)).to.equal(false);

    await bridge.claimLower(firstProof);
    expect(await bridge.isUsedLower(lowerId)).to.equal(true);
  });
});
