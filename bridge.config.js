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
    owner: '0x97AF8c9Ca1e26FF28e67d1e7109c2F342D20a144',
    feed: '0x01519c462044aEBc7bF9a786005880ecE32AfeeF',
    pool: '0x01519c462044aEBc7bF9a786005880ecE32AfeeF',
    sanctions: '0x01519c462044aEBc7bF9a786005880ecE32AfeeF',
    prd: '0x0000000000000000000000000000000000000000',
    usdc: '0x01519c462044aEBc7bF9a786005880ecE32AfeeF',
    usdt: '0x904E2E61E71d186418511A37a6C6D022d69344f4',
    weth: '0x01519c462044aEBc7bF9a786005880ecE32AfeeF',
    authors: [
      {
        ethAddress: '0x97249Cd69BA44E2F29855a884bC4ff6701d9929d',
        ethUncompressedPublicKey: '0x0410877db661951b6c3c3fdf3e372cc809edd1760a429c979b5d1259c099cd32dd37dd9dcbb97ed8f69b7ed2f089c639c76530d397842e36db18f657f977a8222a',
        t2PublicKey: '0x70ba00bb8d9bdbe0d792139f9c4dc152d98b0683ea0f6f9f67f2401176982b19'
      },
      {
        ethAddress: '0xdD7a161770D7477644b29d0A3aD7b796A4880ab4',
        ethUncompressedPublicKey: '0x04e75e28d2cb588c3f7ff4bef474101aa40d864c85dcf600849687e26c074b3056a3f0ec7867a2a341e2ec1be5a9dba5c1a14eba5b4858ffccc4f66ad611491505',
        t2PublicKey: '0x8e8d0041d11f5dba1fd5a9b176c963efeaabefd5be4f66948d5a15c0a2aa8618'
      },
      {
        ethAddress: '0x692a1E365FD302Ad4d598617520ab3D272c50A6E',
        ethUncompressedPublicKey: '0x0451ad82d469e527c864c776a8ecaf45b847bca2230fff304aa6702f6e39d331d882d39f68a9602e61d7b535fbf5516a949162c302e7de4d0e17f8f018ec22edb2',
        t2PublicKey: '0x607c12ea18e52bee2a185e44cff6373ccb9959dd444785bff386c30ecdc1e717'
      },
      {
        ethAddress: '0x6B1D580fe8DdA058Fa2905D2a3d792a95bF5379A',
        ethUncompressedPublicKey: '0x04829f3dea719c36b1019288f2369528ea310e096998eb0d0e61600d57e36b03540f4010a88d22880f88f103ec39d303381a087b56c32f9b66baf2d978590ef421',
        t2PublicKey: '0x74d57e5488955c0746bb4b4b1172752021f26189bb88e9fc4a06b0c3463a511d'
      },
      {
        ethAddress: '0xee608Bd42D2A41919f7F93645b040F3eC5E1670b',
        ethUncompressedPublicKey: '0x04e61e24348a03ccf82bea7c25beac533c2ff1eccd4fe923460e98f893454c75558e5d8bfef19116ab26957aec64c68d3277191c748e82d12a08e2f28e17a6f3b0',
        t2PublicKey: '0xdad555a01a7b214087cde50ebbb955160c9d2af65476888183629ee061271a60'
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
