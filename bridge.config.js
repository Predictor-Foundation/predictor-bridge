const bridgeConfig = {
  mainnet: {
    owner: '0x0000000000000000000000000000000000000000',
    feed: '0x986b5E1e1755e3C2440e960477f25201B0a8bbD4',
    pool: '0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640',
    sanctions: '0x40C57923924B5c5c5455c48D93317139ADDaC8fb',
    prd: '0x50Ce6df72cFFCA748c2D9Cf80F1af693C36d176c',
    usdc: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    usdt: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    weth: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    authors: []
  },

  testnet: {
    owner: '0x43517f5a08152affd4e5395272C608d6e6064Cfd',
    feed: '0xA6B8979480263424C74d64EcFC552c39Fe3a03f3',
    pool: '0xA6B8979480263424C74d64EcFC552c39Fe3a03f3',
    sanctions: '0xA6B8979480263424C74d64EcFC552c39Fe3a03f3',
    prd: '0xDF1E384d36A6EE55a1b3c89bF6ec720fC5c611EB',
    usdc: '0xA6B8979480263424C74d64EcFC552c39Fe3a03f3',
    usdt: '0xc25EEEDd37b9BE1d9a186d31F6280e6B6dc0092e',
    weth: '0xA6B8979480263424C74d64EcFC552c39Fe3a03f3',
    authors: [
      {
        ethAddress: '0x073411c96F59ef379DE620fd3226eA3f222af1b9',
        ethUncompressedPublicKey: '0x047abd11467b065e7b12d7b61cf9d73c1c359c5ece1b15a560806a610ccb6d0e0949805c309f57329642457bbdfc65ab467d7335d130d417db27987827ff2432d9',
        t2PublicKey: '0xd8bea8fb05df6e07d27574f7e6890ec97182bd187167757f05573a866b4ceb0f'
      },
      {
        ethAddress: '0xE43ce3aEF589a1c413A4213F9937Ac60D341d214',
        ethUncompressedPublicKey: '0x04fe1be9394842c6a52e9d2acb7826331eb2d4fe3ab488c6f184e97767caa740d8a57b1f9f557bd26dfe065562d0447284797c2d5de2a2f05333471fac3bd43af3',
        t2PublicKey: '0xd64ae61b6621c48bc782b8983d666a30619bc8334a65b4323ba0036fc6e04278'
      },
      {
        ethAddress: '0xee2238986aE9C2D104cd11a3e2165c4684580eF9',
        ethUncompressedPublicKey: '0x04faee2e31f9f6f256f3fb58971448ae5bd0d353ed3d3a09c7d921b65349a6fb7ad0d6322621d4a0bdbf0b948938e619ca306b6ca93fb453fcfaa2e4cfff58d76d',
        t2PublicKey: '0x1ed9ea9808b2077169fa554f2084582a63a12cf3b7ac51952677ac60f960846f'
      },
      {
        ethAddress: '0xF6D4696405B4D6971bb0532cf5e76774259575aA',
        ethUncompressedPublicKey: '0x04006f92d93a4cb34528bd4db425489b4bca783cd29a06a752c0c14e909e9836ae64f83f724670fd2ab00e32d5f5fc07379635233fc063568051fe81b18df2e81b',
        t2PublicKey: '0xc4a51e4fe4065c6c95891c0fbb33ca1249deb922121a423dffbd7a01b03e7053'
      },
      {
        ethAddress: '0xF45337E8A2ffE96809B71a6D6Be186985457f6bB',
        ethUncompressedPublicKey: '0x0440831337647a7e796f4e9feca9a8af14b50e17e1cc7be25fbc9928ac9a2914b5cd97ce178c2bb2e217c74fcef96d7fe4bb1f451fa3282e766ff698ea20c0e92b',
        t2PublicKey: '0xc88510affc6377d814686c2b6f865125205c7108ae7a80bc94d74d99c8f97e39'
      }
    ]
  },

  dev: {
    owner: '0x43517f5a08152affd4e5395272C608d6e6064Cfd',
    feed: '0x9271D49FC2467419cad65Dd405baDc60d989c75A',
    pool: '0x9271D49FC2467419cad65Dd405baDc60d989c75A',
    sanctions: '0x9271D49FC2467419cad65Dd405baDc60d989c75A',
    prd: '0xDF1E384d36A6EE55a1b3c89bF6ec720fC5c611EB',
    usdc: '0x9271D49FC2467419cad65Dd405baDc60d989c75A',
    usdt: '0xb7E2e5A4161036Af058336F07ADAbC9aE932FCf5',
    weth: '0x9271D49FC2467419cad65Dd405baDc60d989c75A',
    authors: [
      {
        ethAddress: '0xcc66EC55E0cdF70e1549beBE969e5988603Ef960',
        ethUncompressedPublicKey: '0x0485c59f553aa213cf9ff9e583ee7bd863e8fb6251676686cc58966c71e020c524545e3875fd5bc8516efba9c0cba632c7f56e71afa8ecc5304857f0973b182fc7',
        t2PublicKey: '0x8cc63d804b737eeb1969b06e8e2aa7704d517c451baced7221a6e3c2b9af265d'
      },
      {
        ethAddress: '0x890E39BaF40792D0Df2582c7C232CE4a8D5Bf965',
        ethUncompressedPublicKey: '0x04716144732ac662116c9763026a77a93b2f50add8c143f32e7067a60738521e4350cf54cceaa6a12343b8c84323daa8a0141f09cf3f552263b94dc9d791ad7168',
        t2PublicKey: '0x6ef3fe612098566f341dedb59c124f90fbfba55f7fa4fd2ae65357da72e6a64e'
      },
      {
        ethAddress: '0x2cC51c7b7b795088Ac10c06cDfc0593a821d3C55',
        ethUncompressedPublicKey: '0x040d91de7d1a039d3f1c66caa6da89ee71f06b79b7cdcf380a72e098d164cd41b009df0f2d5b0688487850a4ef0d17f79952235f21e924fcc07313e7562e138f1a',
        t2PublicKey: '0xca7eb5e465a06fdd960a408286e5675a5c3a64dd93b6add63c930ec3d6057a34'
      },
      {
        ethAddress: '0x548e68b384fd8Ac91C88Ad16Cb919b24d7afed52',
        ethUncompressedPublicKey: '0x04b802f4066d418778e8f7f4b1c38b23620ab98f1047304f20a077723e5d51c76be5010977dfbca40b2198940f551e33dc2c7da982966f4ed73f87e93f17a2aaff',
        t2PublicKey: '0xca627bec2987ad6ba3768ec290c186532f9041848f753dd1d3fbb7a800840a71'
      }
    ]
  }
};

export default bridgeConfig;
