// Taro Babel 预设：框架 React + 编译目标小程序
module.exports = {
  presets: [
    [
      'taro',
      {
        framework: 'react',
        ts: true,
        compiler: 'webpack5',
        useBuiltIns: false
      }
    ]
  ]
}