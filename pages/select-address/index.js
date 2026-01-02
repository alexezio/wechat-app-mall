const WXAPI = require('../../utils/wxapi-adapter')
const CONFIG = require('../../config.js')
const AUTH = CONFIG.useNewApi ? require('../../utils/auth-new') : require('../../utils/auth')

const app = getApp()
Page({
  data: {

  },
  selectTap: async function(e) {
    console.log(e);
    const id = e.currentTarget.dataset.id;
    // 调用新API设置默认地址
    const res = await WXAPI.setDefaultAddress(id)
    if (res.code === 0) {
      wx.navigateBack({})
    } else {
      wx.showToast({
        title: res.msg || '设置失败',
        icon: 'none'
      })
    }
  },

  addAddess: function() {
    wx.navigateTo({
      url: "/pages/address-add/index"
    })
  },

  editAddess: function(e) {
    console.log(e);
    
    wx.navigateTo({
      url: "/pages/address-add/index?id=" + e.currentTarget.dataset.id
    })
  },

  onLoad: function() {
    console.log('[收货地址] onLoad 执行')
    console.log('[收货地址] 使用认证模块:', CONFIG.useNewApi ? 'auth-new' : 'auth')
    console.log('[收货地址] jwt_token:', wx.getStorageSync('jwt_token'))
    console.log('[收货地址] old token:', wx.getStorageSync('token'))
    // 页面加载时就查询地址列表
    AUTH.checkHasLogined().then(isLogined => {
      console.log('[收货地址] onLoad 登录状态:', isLogined)
      if (isLogined) {
        console.log('[收货地址] onLoad 开始查询地址列表')
        this.initShippingAddress();
      } else {
        console.log('[收货地址] 未登录，跳转登录页')
        wx.navigateTo({
          url: '/pages/login/index-new'
        })
      }
    })
  },
  onShow: function() {
    console.log('[收货地址] onShow 执行')
    // onShow 时也查询（从其他页面返回时刷新）
    AUTH.checkHasLogined().then(isLogined => {
      console.log('[收货地址] onShow 登录状态:', isLogined)
      if (isLogined) {
        console.log('[收货地址] onShow 开始查询地址列表')
        this.initShippingAddress();
      }
    })
  },
  async initShippingAddress() {
    console.log('[收货地址] initShippingAddress 开始执行')
    wx.showLoading({
      title: '加载中...',
    })
    console.log('[收货地址] 准备调用 WXAPI.queryAddress()')
    const res = await WXAPI.queryAddress()
    console.log('[收货地址] WXAPI.queryAddress() 返回结果:', res)
    wx.hideLoading({
      success: (res) => {},
    })
    if (res.code == 0) {
      console.log('[收货地址] 查询成功，地址数量:', res.data ? res.data.length : 0)
      // 转换字段格式为旧格式，方便页面使用
      const addressList = (res.data || []).map(item => ({
        id: item.id,
        linkMan: item.link_man || item.linkMan,
        mobile: item.mobile,
        address: item.address,
        code: item.code,
        // 支持新的编码格式和旧的ID格式
        provinceCode: item.province_code || item.provinceCode,
        cityCode: item.city_code || item.cityCode,
        areaCode: item.area_code || item.areaCode || item.district_code,
        streetCode: item.street_code || item.streetCode,
        provinceName: item.province_name || item.provinceName,
        cityName: item.city_name || item.cityName,
        areaName: item.area_name || item.areaName || item.district_name || item.districtName,
        streetName: item.street_name || item.streetName,
        isDefault: item.is_default || item.isDefault,
        latitude: item.latitude,
        longitude: item.longitude
      }))
      console.log('[收货地址] 设置地址列表到页面:', addressList)
      this.setData({
        addressList: addressList
      });
    } else if (res.code == 700) {
      console.log('[收货地址] 查询结果code=700，无地址')
      this.setData({
        addressList: null
      });
    } else {
      console.log('[收货地址] 查询失败:', res.msg)
      wx.showToast({
        title: res.msg,
        icon: 'none'
      })
    }
  },
  onPullDownRefresh() {
    this.initShippingAddress()
    wx.stopPullDownRefresh()
  },
  deleteAddress(e) {
    const id = e.currentTarget.dataset.id
    const index = e.currentTarget.dataset.index
    console.log('index', index);
    wx.showModal({
      content: '确定要删除该收货地址吗？',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({
            title: '',
          })
          const result = await WXAPI.deleteAddress(id)
          wx.hideLoading()
          if (result.code != 0) {
            wx.showToast({
              title: result.msg || '删除失败',
              icon: 'none'
            })
          } else {
            wx.showToast({
              title: '删除成功',
              icon: 'none'
            })
            this.initShippingAddress()
          }
        }
      }
    })
  },
})