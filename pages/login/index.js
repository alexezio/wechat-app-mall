// pages/login/index-new.js - 新的登录注册页面
const AUTH = require('../../utils/auth-new')
const CONFIG = require('../../config')

Page({
  data: {
    phoneNumber: '',
    openid: '',
    nick: '',
    step: 1, // 1-获取手机号 2-完善信息
    loading: false,
    agreeProtocol: false // 是否同意隐私政策
  },

  async onLoad(options) {
    // 获取openid（从全局或URL参数）
    const app = getApp()
    let openid = options.openid || app.globalData.openid || wx.getStorageSync('openid')
    
    // 如果没有openid，尝试获取
    if (!openid) {
      wx.showLoading({ title: '初始化中...' })
      
      try {
        // 尝试调用登录获取openid
        const loginResult = await AUTH.login()
        wx.hideLoading()
        
        if (loginResult.needRegister && loginResult.openid) {
          // 获取到openid，需要注册
          openid = loginResult.openid
          this.setData({ openid })
        } else if (loginResult.success) {
          // 已经登录成功，直接返回
          wx.showToast({
            title: '您已登录',
            icon: 'success'
          })
          setTimeout(() => {
            wx.switchTab({
              url: '/pages/index/index',
              fail: () => {
                wx.navigateBack()
              }
            })
          }, 1500)
          return
        } else {
          throw new Error('获取登录凭证失败')
        }
      } catch (error) {
        wx.hideLoading()
        console.error('获取openid失败:', error)
        wx.showModal({
          title: '提示',
          content: '获取登录凭证失败，请稍后重试',
          showCancel: false,
          success: () => {
            wx.switchTab({
              url: '/pages/index/index',
              fail: () => {
                wx.navigateBack()
              }
            })
          }
        })
        return
      }
    } else {
      this.setData({ openid })
    }
  },

  /**
   * 切换隐私政策勾选状态
   */
  toggleAgreeProtocol() {
    this.setData({
      agreeProtocol: !this.data.agreeProtocol
    })
  },

  /**
   * 查看用户协议
   */
  viewUserAgreement() {
    wx.navigateTo({
      url: '/subpackages/more/about/index?key=yhxy',
    })
  },

  /**
   * 查看隐私政策
   */
  viewPrivacyPolicy() {
    wx.navigateTo({
      url: '/subpackages/more/about/index?key=ysxy',
    })
  },

  /**
   * 获取手机号（微信授权）
   */
  async getPhoneNumber(e) {
    if (this.data.loading) return
    
    // 检查是否同意隐私政策
    if (!this.data.agreeProtocol) {
      wx.showToast({
        title: '请先阅读并同意用户协议和隐私政策',
        icon: 'none',
        duration: 2500
      })
      return
    }
    
    try {
      this.setData({ loading: true })
      
      const result = await AUTH.getPhoneNumber(e)
      
      if (result.success) {
        const phoneNumber = result.purePhoneNumber || result.phoneNumber
        console.log('获取到手机号:', phoneNumber)
        
        this.setData({
          phoneNumber: phoneNumber,
          step: 2,
          loading: false
        })
        
        // 如果不需要完善信息，直接注册
        if (!CONFIG.needNick) {
          this.register()
        }
      }
    } catch (error) {
      this.setData({ loading: false })
      console.error('获取手机号失败:', error)
    }
  },

  /**
   * 输入昵称
   */
  onNickInput(e) {
    this.setData({
      nick: e.detail.value
    })
  },

  /**
   * 注册
   */
  async register() {
    if (this.data.loading) return
    
    const { phoneNumber, openid, nick } = this.data
    
    if (!phoneNumber) {
      wx.showToast({
        title: '请先授权手机号',
        icon: 'none'
      })
      return
    }
    
    try {
      this.setData({ loading: true })
      wx.showLoading({ title: '注册中...' })
      
      const result = await AUTH.register(phoneNumber, openid, nick)
      
      wx.hideLoading()
      
      if (result.success) {
        wx.showToast({
          title: '注册成功',
          icon: 'success'
        })
        
        // 触发全局回调
        const app = getApp()
        if (app.loginOK) {
          app.loginOK(result.userInfo)
        }
        
        // 延迟跳转到首页
        setTimeout(() => {
          wx.switchTab({
            url: '/pages/index/index',
            fail: () => {
              wx.navigateBack()
            }
          })
        }, 1500)
      }
    } catch (error) {
      wx.hideLoading()
      this.setData({ loading: false })
      console.error('注册失败:', error)
    }
  },

  /**
   * 跳过注册（如果允许）
   */
  skipRegister() {
    wx.showModal({
      title: '提示',
      content: '跳过注册后部分功能将无法使用，确定要跳过吗？',
      success: (res) => {
        if (res.confirm) {
          wx.switchTab({
            url: '/pages/index/index',
            fail: () => {
              wx.navigateBack()
            }
          })
        }
      }
    })
  }
})

