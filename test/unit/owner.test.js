import { MIN_AUTHORS, deployFixture, expect, getAccounts, getAuthors, getEthers, init, randomBytes32 } from '../helper.js';

describe('PredictorBridge owner tests', function () {
  let ethers;
  let owner;
  let otherAccount;
  let newOwner;
  let authors;
  let bridge;
  let feed;
  let pool;
  let usdc;
  let usdt;
  let weth;
  let sanctions;

  beforeEach(async () => {
    await init({ numAuthors: 6 });
    ethers = getEthers();
    [owner, newOwner, otherAccount] = getAccounts();
    authors = getAuthors();
    ({ bridge, feed, pool, sanctions, usdc, usdt, weth } = await deployFixture({ numAuthors: 6 }));
  });

  describe('ownership transfer', function () {
    it('allows owner to transfer and pending owner to accept', async () => {
      await expect(bridge.transferOwnership(newOwner.address)).to.emit(bridge, 'OwnershipTransferStarted').withArgs(owner.address, newOwner.address);

      expect(await bridge.owner()).to.equal(owner.address);
      expect(await bridge.pendingOwner()).to.equal(newOwner.address);

      await expect(bridge.connect(newOwner).acceptOwnership()).to.emit(bridge, 'OwnershipTransferred').withArgs(owner.address, newOwner.address);

      expect(await bridge.owner()).to.equal(newOwner.address);
      expect(await bridge.pendingOwner()).to.equal(ethers.ZeroAddress);
    });

    it('rejects non-owner transferOwnership', async () => {
      await expect(bridge.connect(otherAccount).transferOwnership(newOwner.address)).to.be.revertedWithCustomError(bridge, 'OwnableUnauthorizedAccount');
    });

    it('rejects non-pending-owner acceptOwnership', async () => {
      await bridge.transferOwnership(newOwner.address);
      await expect(bridge.connect(otherAccount).acceptOwnership()).to.be.revertedWithCustomError(bridge, 'OwnableUnauthorizedAccount');
    });
  });

  describe('renounce ownership', function () {
    it('is disabled for owner', async () => {
      await expect(bridge.renounceOwnership()).to.be.revertedWith('Disabled');
      expect(await bridge.owner()).to.equal(owner.address);
    });

    it('still rejects non-owner first', async () => {
      await expect(bridge.connect(otherAccount).renounceOwnership()).to.be.revertedWithCustomError(bridge, 'OwnableUnauthorizedAccount');
    });
  });

  describe('pause / unpause', function () {
    it('allows owner to pause and unpause', async () => {
      await bridge.pause();
      expect(await bridge.paused()).to.equal(true);

      await bridge.unpause();
      expect(await bridge.paused()).to.equal(false);
    });

    it('rejects non-owner pause', async () => {
      await expect(bridge.connect(otherAccount).pause()).to.be.revertedWithCustomError(bridge, 'OwnableUnauthorizedAccount');
    });

    it('rejects non-owner unpause', async () => {
      await bridge.pause();
      await expect(bridge.connect(otherAccount).unpause()).to.be.revertedWithCustomError(bridge, 'OwnableUnauthorizedAccount');
    });

    it('rejects double pause', async () => {
      await bridge.pause();
      await expect(bridge.pause()).to.be.revertedWithCustomError(bridge, 'EnforcedPause');
    });

    it('rejects unpause when not paused', async () => {
      await expect(bridge.unpause()).to.be.revertedWithCustomError(bridge, 'ExpectedPause');
    });
  });

  describe('initialization', function () {
    async function deployAndExpectRevert({ initArgs, constructorArgs, error }) {
      const PredictorBridge = await ethers.getContractFactory('PredictorBridge');
      await expect(
        PredictorBridge.deploy(...constructorArgs).then(async implementation => {
          await implementation.waitForDeployment();
          const ERC1967Proxy = await ethers.getContractFactory('ERC1967Proxy');
          const initData = implementation.interface.encodeFunctionData('initialize', initArgs);
          return ERC1967Proxy.deploy(implementation.target, initData);
        })
      ).to.be.revertedWithCustomError(PredictorBridge, error);
    }

    function baseInitValues() {
      return {
        t1Addresses: authors.slice(0, 5).map(a => a.t1Address),
        t1PubKeysLHS: authors.slice(0, 5).map(a => a.t1PubKeyLHS),
        t1PubKeysRHS: authors.slice(0, 5).map(a => a.t1PubKeyRHS),
        t2PubKeys: authors.slice(0, 5).map(a => a.t2PubKey),
        owner: owner.address,
        constructorArgs: [feed.target, pool.target, sanctions.target, usdc.target, usdt.target, weth.target]
      };
    }

    it('initialises expected author mappings and owner', async () => {
      for (let i = 0; i < 6; i++) {
        const authorId = i + 1;
        const author = authors[i];
        expect(await bridge.t1AddressToId(author.t1Address)).to.equal(authorId);
        expect(await bridge.t2PubKeyToId(author.t2PubKey)).to.equal(authorId);
        expect(await bridge.idToT1Address(authorId)).to.equal(author.t1Address);
        expect(await bridge.idToT2PubKey(authorId)).to.equal(author.t2PubKey);
        expect(await bridge.isAuthor(authorId)).to.equal(true);
        expect(await bridge.authorIsActive(authorId)).to.equal(true);
      }

      expect(await bridge.numActiveAuthors()).to.equal(6);
      expect(await bridge.nextAuthorId()).to.equal(7);
      expect(await bridge.owner()).to.equal(owner.address);
    });

    it('rejects zero constructor addresses', async () => {
      const v = baseInitValues();
      await deployAndExpectRevert({
        initArgs: [v.t1Addresses, v.t1PubKeysLHS, v.t1PubKeysRHS, v.t2PubKeys, v.owner],
        constructorArgs: [ethers.ZeroAddress, pool.target, sanctions.target, usdc.target, usdt.target, weth.target],
        error: 'AddressIsZero'
      });
    });

    it('rejects missing owner', async () => {
      const v = baseInitValues();
      const PredictorBridge = await ethers.getContractFactory('PredictorBridge');
      const implementation = await PredictorBridge.deploy(...v.constructorArgs);
      await implementation.waitForDeployment();

      const ERC1967Proxy = await ethers.getContractFactory('ERC1967Proxy');
      const initData = implementation.interface.encodeFunctionData('initialize', [v.t1Addresses, v.t1PubKeysLHS, v.t1PubKeysRHS, v.t2PubKeys, ethers.ZeroAddress]);

      await expect(ERC1967Proxy.deploy(implementation.target, initData)).to.be.revertedWithCustomError(PredictorBridge, 'OwnableInvalidOwner');
    });

    it('rejects address / pubkey mismatch', async () => {
      const v = baseInitValues();
      v.t1PubKeysLHS[0] = authors[5].t1PubKeyLHS;
      await deployAndExpectRevert({
        initArgs: [v.t1Addresses, v.t1PubKeysLHS, v.t1PubKeysRHS, v.t2PubKeys, v.owner],
        constructorArgs: v.constructorArgs,
        error: 'AddressMismatch'
      });
    });

    it('rejects missing key arrays', async () => {
      const v = baseInitValues();
      v.t2PubKeys.pop();
      await deployAndExpectRevert({
        initArgs: [v.t1Addresses, v.t1PubKeysLHS, v.t1PubKeysRHS, v.t2PubKeys, v.owner],
        constructorArgs: v.constructorArgs,
        error: 'MissingKeys'
      });
    });

    it('rejects duplicate t1 address', async () => {
      const v = baseInitValues();
      v.t1Addresses[1] = v.t1Addresses[0];
      v.t1PubKeysLHS[1] = v.t1PubKeysLHS[0];
      v.t1PubKeysRHS[1] = v.t1PubKeysRHS[0];
      await deployAndExpectRevert({
        initArgs: [v.t1Addresses, v.t1PubKeysLHS, v.t1PubKeysRHS, v.t2PubKeys, v.owner],
        constructorArgs: v.constructorArgs,
        error: 'T1AddressInUse'
      });
    });

    it('rejects duplicate t2 pubkey', async () => {
      const v = baseInitValues();
      v.t2PubKeys[1] = v.t2PubKeys[0];
      await deployAndExpectRevert({
        initArgs: [v.t1Addresses, v.t1PubKeysLHS, v.t1PubKeysRHS, v.t2PubKeys, v.owner],
        constructorArgs: v.constructorArgs,
        error: 'T2KeyInUse'
      });
    });

    it('rejects too few authors', async () => {
      const v = baseInitValues();
      v.t1Addresses.splice(MIN_AUTHORS - 1);
      v.t1PubKeysLHS.splice(MIN_AUTHORS - 1);
      v.t1PubKeysRHS.splice(MIN_AUTHORS - 1);
      v.t2PubKeys.splice(MIN_AUTHORS - 1);
      await deployAndExpectRevert({
        initArgs: [v.t1Addresses, v.t1PubKeysLHS, v.t1PubKeysRHS, v.t2PubKeys, v.owner],
        constructorArgs: v.constructorArgs,
        error: 'NotEnoughAuthors'
      });
    });

    it('rejects too many authors', async () => {
      const v = baseInitValues();

      while (v.t1Addresses.length < 256) {
        v.t1Addresses.push(ethers.Wallet.createRandom().address);
        v.t1PubKeysLHS.push(randomBytes32());
        v.t1PubKeysRHS.push(randomBytes32());
        v.t2PubKeys.push(randomBytes32());
      }

      await deployAndExpectRevert({
        initArgs: [v.t1Addresses, v.t1PubKeysLHS, v.t1PubKeysRHS, v.t2PubKeys, v.owner],
        constructorArgs: v.constructorArgs,
        error: 'TooManyAuthors'
      });
    });

    it('rejects zero t1 address in init authors', async () => {
      const v = baseInitValues();
      v.t1Addresses[0] = ethers.ZeroAddress;
      await deployAndExpectRevert({
        initArgs: [v.t1Addresses, v.t1PubKeysLHS, v.t1PubKeysRHS, v.t2PubKeys, v.owner],
        constructorArgs: v.constructorArgs,
        error: 'AddressIsZero'
      });
    });

    it('cannot reinitialize', async () => {
      await expect(
        bridge.initialize(
          authors.slice(0, 4).map(a => a.t1Address),
          authors.slice(0, 4).map(a => a.t1PubKeyLHS),
          authors.slice(0, 4).map(a => a.t1PubKeyRHS),
          authors.slice(0, 4).map(a => a.t2PubKey),
          owner.address
        )
      ).to.revert();
    });
  });

  describe('upgrade auth', function () {
    it('allows owner upgrade', async () => {
      const Upgraded = await ethers.getContractFactory('MockPredictorBridgeUpgrade');

      const newImpl = await Upgraded.deploy(feed.target, pool.target, sanctions.target, usdc.target, usdt.target, weth.target);
      await newImpl.waitForDeployment();
      const tx = await bridge.upgradeToAndCall(newImpl.target, '0x');
      await tx.wait();

      const upgradedBridge = Upgraded.attach(bridge.target);
      expect(await upgradedBridge.newFunction()).to.equal('PredictorBridge upgraded');
    });

    it('rejects non-owner upgrade', async () => {
      const Upgraded = await ethers.getContractFactory('MockPredictorBridgeUpgrade');
      const newImpl = await Upgraded.deploy(feed.target, pool.target, sanctions.target, usdc.target, usdt.target, weth.target);
      await newImpl.waitForDeployment();

      await expect(bridge.connect(otherAccount).upgradeToAndCall(newImpl.target, '0x')).to.be.revertedWithCustomError(bridge, 'OwnableUnauthorizedAccount');
    });
  });
});
