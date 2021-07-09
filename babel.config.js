const presets = ['@babel/preset-react']

const plugins = [
  [
    './dist/index.js',
    {
      imports: {
        ignoreLibraries: ['react'],
        remove: true,
        customImports: {
          libraryName: 'antd',
          customMapping: {
            'Button': 'customPath/Button'
          }
      }
      },
      styles: {
        remove: true,
      },
      propTypes: {
        remove: true,
        onlyProduction: false
      }
    }
  ]
]

module.exports = { presets, plugins }
