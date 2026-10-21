export default defineAppConfig({
  pages: [
    // 底部 Tab 四个入口
    'pages/board/index',
    'pages/orders/index',
    'pages/customers/index',
    'pages/referral/index',

    // 服务者工作台子页
    'pages/auth/login/index',
    'pages/auth/register/index',
    'pages/profile/index',
    'pages/page-edit/index',
    'pages/order-detail/index',
    'pages/order-create/index',
    'pages/customer-detail/index',
    'pages/settings/index',
    'pages/feedback/index',

    // 客户扫码路径（公开，无需登录）
    'pages/provider/index',
    'pages/booking/index',

    // 协议页面（公开，无需登录）—— 微信审核要求可访问的《用户服务协议》《隐私政策》
    'pages/legal/terms/index',
    'pages/legal/privacy/index'
  ],

  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#ffffff',
    navigationBarTitleText: '邻小来',
    navigationBarTextStyle: 'black'
  },

  tabBar: {
    color: '#9AA3AF',
    selectedColor: '#2B6CF0',
    backgroundColor: '#ffffff',
    borderStyle: 'white',
    list: [
      {
        pagePath: 'pages/board/index',
        text: '今日台账',
        iconPath: 'assets/tabbar/board.png',
        selectedIconPath: 'assets/tabbar/board-active.png'
      },
      {
        pagePath: 'pages/orders/index',
        text: '全部订单',
        iconPath: 'assets/tabbar/orders.png',
        selectedIconPath: 'assets/tabbar/orders-active.png'
      },
      {
        pagePath: 'pages/customers/index',
        text: '我的客户',
        iconPath: 'assets/tabbar/customers.png',
        selectedIconPath: 'assets/tabbar/customers-active.png'
      },
      {
        pagePath: 'pages/referral/index',
        text: '我的推广',
        iconPath: 'assets/tabbar/referral.png',
        selectedIconPath: 'assets/tabbar/referral-active.png'
      }
    ]
  }
})