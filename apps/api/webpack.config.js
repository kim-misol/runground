const nodeExternals = require('webpack-node-externals');

module.exports = function (options, webpack) {
  return {
    ...options,
    externals: [
      nodeExternals({
        // 여기에 컴파일이 필요한 내부 패키지를 적어줍니다.
        allowlist: [/^@runground/], 
      }),
    ],
  };
};
