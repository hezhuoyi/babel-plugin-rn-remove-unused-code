const presets = ['@babel/preset-react']

const plugins = [
  [
    './dist/index.js',
    {
      imports: {
        ignoreLibraries: 'react',
        remove: true,
        customImports: {
          libraryName: '@ctrip/ztbusiness',
          libraryDirectory: 'src/Components',
          customMapping: {
            'RobTicketComponent': 'src/Components/RobTicketCommend',
            'WeixinDiversionBanner': 'src/Components/WeixinDiversion/WeixinDiversionBanner',
            'WeixinDiversionToast': 'src/Components/WeixinDiversion/WeixinDiversionToast',
            'StudentCashbackToast': 'src/Components/StudentCashback/StudentCashbackToast',
            'UnlockStudentCashbackToast': 'src/Components/StudentCashback/UnlockStudentCashbackToast',
            'FreeVipSavingsBanner': 'src/Components/FreeVipSavings',
            'SuperCodeNoticeBar': 'src/Components/SuperCode',
            'SuperCodeNoticeToast': 'src/Components/SuperCode/SuperCodeToast'
          }
        },
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
