// pages/login/index-new.js - 新的登录注册页面
const AUTH = require('../../utils/auth-new')
const CONFIG = require('../../config')

Page({
  data: {
    phoneNumber: '',
    openid: '',
    nick: '',
    step: 1, // 1-获取手机号 2-完善信息
    loading: false
  },

  onLoad(options) {
    // 获取openid（从全局或URL参数）
    const app = getApp()
    const openid = options.openid || app.globalData.openid || wx.getStorageSync('openid')
    
    if (!openid) {
      wx.showModal({
        title: '提示',
        content: '请先获取登录凭证',
        showCancel: false,
        success: () => {
          wx.navigateBack()
        }
      })
      return
    }
    
    this.setData({ openid })
  },

  /**
   * 获取手机号（微信授权）
   */
  async getPhoneNumber(e) {
    if (this.data.loading) return
    
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

