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
    owner: '0x97AF8c9Ca1e26FF28e67d1e7109c2F342D20a144',
    feed: '0x73B338B277E82f05E74487E321B2e588A0d4E4E3',
    pool: '0x73B338B277E82f05E74487E321B2e588A0d4E4E3',
    sanctions: '0x73B338B277E82f05E74487E321B2e588A0d4E4E3',
    prd: '0xDF1E384d36A6EE55a1b3c89bF6ec720fC5c611EB',
    usdc: '0x73B338B277E82f05E74487E321B2e588A0d4E4E3',
    usdt: '0xC737a683Cf220E46f42577cd8e950ce69AfE2D94',
    weth: '0x73B338B277E82f05E74487E321B2e588A0d4E4E3',
    authors: [
      {
        ethAddress: '0x0f1dC3B7e07a8E198A70Ae2e167cA54EF4c21635',
        ethUncompressedPublicKey: '0x04354a1e31f0015e66ab9411bd7aaeb9317c352632b1dc2296b3de6170ac591cced41dbf4dc5304003faf0aba9c37d43a860920c8f17dd0bad6f1e6c05489b7c7b',
        t2PublicKey: '0xba082380ebb1257e75e52bfc7bb1f5aea0d310676a6c436008e03f2948d3ac0a'
      },
      {
        ethAddress: '0xEC70c92A562DDDf75EfB4b2A922EEA338FED0D21',
        ethUncompressedPublicKey: '0x0459c96588a5da5696736e546b19225c1cdc156f549a8d876c7a7d4cdf578a7122a0271e9c0fc5d65d7baa38c86f5c935db0c6950c6fadcff22ea7e2fa75c8de69',
        t2PublicKey: '0xbc16ae9651730c20af25a0cbca3dea84bf9cb6f32feb53fcb215dc268225c871'
      },
      {
        ethAddress: '0x8d1423c9ab168147f0a853098E738b2F8f462Ba2',
        ethUncompressedPublicKey: '0x048e05b95ae7a3b105f1e36e9334dcf697cdb382c97b71ffa5003bddd6dbf0a4cc60cfdd28895e9c52919b4e6ab5d9a217037b127860701fffcbda7b2f1721f0b9',
        t2PublicKey: '0xdce4542b5c0d24080b984a1e883a0749225f8b12332811453f9bd7c36fa8d339'
      },
      {
        ethAddress: '0x430E61B21E45aB66877E0af3d10302cBf60f754C',
        ethUncompressedPublicKey: '0x04f3d3019e7c0a9b027ccb4bf701947d0d7e4114e4120b949f1a0a8b3f4777d842c476453c7563dd4bf20a7bd367c365889a9795a8bb3458ba77f7785acea32968',
        t2PublicKey: '0xf0fa9d4925459b439076ffa9800c13d65f47e5cf892a0de5cbceec18074a2e4c'
      },
      {
        ethAddress: '0xe639bdf2779b5D31e840A02F7AFf20bF5a4f3567',
        ethUncompressedPublicKey: '0x049ed9bfe6048fba6e1aea40bc78db58d21fcf667380c617d5834fb02bcdd7e3b687f0abea99832648701626ab480c9c56f3ad01a3007fa5085cfdd37ee8b9fbb3',
        t2PublicKey: '0x7aeb0cdf5bc4a343a0d736e257b60c22c449eefffbdf19292d089d20f2bdf513'
      }
    ]
  }
};

export default bridgeConfig;
