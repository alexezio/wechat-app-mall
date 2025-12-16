module.exports = {
  version: '25.11.09.2',
  note: '成长值页面优化', // 这个为版本描述，无需修改
  subDomain: '2e7706fc1fa1758515737942e6d57d0e', // 此处改成你自己的专属域名。什么是专属域名？请看教程 https://www.it120.cc/help/qr6l4m.html
  merchantId: 75692, // 商户ID，可在后台工厂设置-->商户信息查看
  sdkAppID: 1400450467, // 腾讯实时音视频应用编号，请看教程 https://www.it120.cc/help/nxoqsl.html
  bindSeller: false, // true 开启三级分销抢客； false 为不开启
  customerServiceType: 'XCX', // 客服类型，QW为企业微信，需要在后台系统参数配置企业ID和客服URL，XCX 为小程序的默认客服
  openIdAutoRegister: true, // 用户打开小程序的时候自动注册新用户【用户不存在的时候】
  
  // ==================== 新增：后端API配置 ====================
  // apiBaseUrl: 'https://api1.xiaofamoyu.com', // 后端API地址，请修改为你的实际地址
  apiBaseUrl: 'http://localhost:8000',
  useNewApi: true, // 是否使用新的API（true使用新API，false使用旧的apifm-wxapi）
  bigPackageSizeSupport: true
}