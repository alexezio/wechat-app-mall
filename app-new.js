// app-new.js - 使用新API的app.js
const CONFIG = require('config.js')

// 根据配置选择使用哪个API
const AUTH = CONFIG.useNewApi ? require('utils/auth-new') : require('utils/auth')
const API = CONFIG.useNewApi ? require('utils/api') : null

App({
  onLaunch: function() {
    const that = this
    
    // 检测新版本
    const updateManager = wx.getUpdateManager()
    updateManager.onUpdateReady(function () {
      wx.showModal({
        title: '更新提示',
        content: '新版本已经准备好，是否重启应用？',
        success(res) {
          if (res.confirm) {
            updateManager.applyUpdate()
          }
        }
      })
    })
    
    // 监听网络状态
    wx.getNetworkType({
      success(res) {
        const networkType = res.networkType
        if (networkType === 'none') {
          that.globalData.isConnected = false
          wx.showToast({
            title: '当前无网络',
            icon: 'loading',
            duration: 2000
          })
        }
      }
    })
    
    wx.onNetworkStatusChange(function(res) {
      if (!res.isConnected) {
        that.globalData.isConnected = false
        wx.showToast({
          title: '网络已断开',
          icon: 'loading',
          duration: 2000
        })
      } else {
        that.globalData.isConnected = true
        wx.hideToast()
      }
    })
    
    // 使用新API加载系统配置
    if (CONFIG.useNewApi) {
      this.loadSystemConfig()
    }
    
    // 获取导航栏高度
    let menuButtonObject = wx.getMenuButtonBoundingClientRect()
    console.log("小程序胶囊信息", menuButtonObject)
    wx.getSystemInfo({
      success: res => {
        let statusBarHeight = res.statusBarHeight,
          navTop = menuButtonObject.top,
          navHeight = statusBarHeight + menuButtonObject.height + (menuButtonObject.top - statusBarHeight)*2
        this.globalData.navHeight = navHeight
        this.globalData.navTop = navTop
        this.globalData.windowHeight = res.windowHeight
        this.globalData.menuButtonObject = menuButtonObject
        console.log("navHeight", navHeight)
      },
      fail(err) {
        console.log(err)
      }
    })
  },

  onShow(e) {
    // 保存邀请人
    if (e && e.query && e.query.inviter_id) {
      wx.setStorageSync('referrer', e.query.inviter_id)
    }
    
    // 自动登录
    this.autoLogin()
  },

  /**
   * 加载系统配置
   */
  async loadSystemConfig() {
    try {
      const keys = 'mallName,WITHDRAW_MIN,ALLOW_SELF_COLLECTION,order_hx_uids,subscribe_ids,share_profile,adminUserIds,goodsDetailSkuShowType,shopMod,needIdCheck,balance_pay_pwd,shipping_address_gps,shipping_address_region_level,shopping_cart_vop_open,cps_open,recycle_open,categoryMod,hide_reputation,show_seller_number,show_goods_echarts,show_buy_dynamic,goods_search_show_type,show_3_seller,show_quan_exchange_score,show_score_exchange_growth,show_score_sign,fx_subscribe_ids,share_pic,orderPeriod_open,order_pay_user_balance,wxpay_api_url,sphpay_open,fx_type,invoice_subscribe_ids,zt_open_hx,withdrawal,customerServiceChatCorpId,customerServiceChatUrl,invoice_open,alipay,comment_subscribe_ids,notice_subscribe_ids,hidden_goods_index,create_order_ext,needBindMobile,invoice_share_pic,hot_search_words'
      
      const res = await API.HomeAPI.getConfigValues(keys)
      if (res.code === 0 && res.data) {
        res.data.forEach(config => {
          wx.setStorageSync(config.key, config.value || '')
        })
        console.log('系统配置加载成功')
        if (this.configLoadOK) {
          this.configLoadOK()
        }
      }
    } catch (error) {
      console.error('加载系统配置失败:', error)
    }
  },

  /**
   * 自动登录
   */
  async autoLogin() {
    try {
      const result = await AUTH.autoLogin()
      
      if (result.success && result.isLogined) {
        // 已登录
        console.log('用户已登录')
        this.globalData.userInfo = result.userInfo
        
        // 触发登录成功回调
        if (this.loginOK) {
          this.loginOK(result.userInfo)
        }
      } else if (result.needRegister) {
        // 需要注册
        console.log('用户需要注册')
        this.globalData.needRegister = true
        this.globalData.openid = result.openid
        
        // 触发需要注册回调
        if (this.needRegister) {
          this.needRegister(result.openid)
        }
        
        // 如果开启了自动注册，跳转到登录页
        if (CONFIG.openIdAutoRegister) {
          // 延迟跳转，避免页面还未ready
          setTimeout(() => {
            wx.navigateTo({
              url: '/pages/login/index',
              fail: () => {
                console.log('登录页面跳转失败')
              }
            })
          }, 500)
        }
      } else {
        // 登录失败
        console.log('登录失败:', result.error)
        if (this.loginFail) {
          this.loginFail(result.error)
        }
      }
    } catch (error) {
      console.error('自动登录异常:', error)
    }
  },

  /**
   * 获取用户信息（供页面调用）
   */
  async getUserInfo(forceRefresh = false) {
    if (!CONFIG.useNewApi) {
      return this.globalData.apiUserInfoMap
    }
    
    try {
      const userInfo = await AUTH.getUserInfo(forceRefresh)
      this.globalData.userInfo = userInfo
      return userInfo
    } catch (error) {
      console.error('获取用户信息失败:', error)
      return null
    }
  },

  /**
   * 初始化昵称头像弹窗（兼容旧代码）
   */
  initNickAvatarUrlPOP(_this) {
    setTimeout(() => {
      const userInfo = this.globalData.userInfo || this.globalData.apiUserInfoMap?.base
      if (userInfo && (!userInfo.nick || !userInfo.avatar_url)) {
        _this.setData({
          nickPopShow: true,
          popnick: userInfo.nick || '',
          popavatarUrl: userInfo.avatar_url || '',
        })
      }
    }, 3000)
  },

  globalData: {
    isConnected: true,
    userInfo: null,
    apiUserInfoMap: undefined, // 兼容旧代码
    needRegister: false,
    openid: null,
    navHeight: 0,
    navTop: 0,
    windowHeight: 0,
    menuButtonObject: null
  }
})

