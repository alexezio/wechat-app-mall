const CONFIG = require('../../../config.js')
const WXAPI = require('apifm-wxapi')
const AUTH = require('../../../utils/auth')
Page({
  data: {
    enableDebug: wx.getSystemInfoSync().enableDebug
  },
  onLoad: function (options) {
    this.setData({
      version: CONFIG.version
    })
  },
  onShow: function () {
    this.getUserApiInfo()
  },
  async getUserApiInfo() {
    const res = await WXAPI.userDetail(wx.getStorageSync('token'))
    if (res.code == 0) {
      let _data = {}
      _data.apiUserInfoMap = res.data
      if (res.data.base.mobile) {
        _data.userMobile = res.data.base.mobile
      }
      if (this.data.order_hx_uids && this.data.order_hx_uids.indexOf(res.data.base.id) != -1) {
        _data.canHX = true // 具有扫码核销的权限
      }
      if (res.data.peisongMember && res.data.peisongMember.status == 1) {
        _data.memberChecked = false
      } else {
        _data.memberChecked = true
      }
      this.setData(_data);
    }
  },
  clearStorage(){
    wx.clearStorageSync()
    wx.showToast({
      title: '已清除',
      icon: 'success'
    })
  },
  setEnableDebug() {
    const enableDebug = wx.getSystemInfoSync().enableDebug
    if (enableDebug) {
      wx.setEnableDebug({
        enableDebug: false
      })
    } else {
      wx.setEnableDebug({
        enableDebug: true
      })
    }
  },
  openSetting() {
    wx.openSetting({
      withSubscriptions: true
    })
  },
  loginOut() {
    wx.showModal({
      title: '确认退出',
      content: '退出后需要重新登录，确定要退出吗？',
      confirmText: '确定退出',
      cancelText: '取消',
      confirmColor: '#ff5252',
      success: (res) => {
        if (res.confirm) {
          // 清除旧系统的token
          wx.removeStorageSync('token')
          wx.removeStorageSync('uid')
          wx.removeStorageSync('openid')
          wx.removeStorageSync('mobile')
          
          // 清除新系统的jwt_token
          wx.removeStorageSync('jwt_token')
          wx.removeStorageSync('userInfo')
          
          // 清除其他可能的用户相关数据
          wx.removeStorageSync('referrer')
          
          wx.showToast({
            title: '已退出登录',
            icon: 'success',
            duration: 2000,
            success: () => {
              setTimeout(() => {
                // 跳转到首页
                wx.reLaunch({
                  url: '/pages/index/index'
                })
              }, 2000)
            }
          })
        }
      }
    })
  },
})