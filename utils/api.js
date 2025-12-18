// utils/api.js - 新的后端API工具类
const CONFIG = require('../config.js')

// API基础URL - 从配置文件读取或设置默认值
const API_BASE_URL = CONFIG.apiBaseUrl || 'https://your-backend-api.com'

/**
 * 统一请求方法
 */
function request(url, method = 'GET', data = {}, needAuth = false) {
  const header = {
    'Content-Type': 'application/json'
  }

  // 需要认证的接口添加Authorization头
  if (needAuth) {
    const token = wx.getStorageSync('jwt_token')
    if (token) {
      header['Authorization'] = `Bearer ${token}`
    }
  }

  return new Promise((resolve, reject) => {
    const requestUrl = API_BASE_URL + url
    console.log('[API] 请求:', method, requestUrl, data)
    
    wx.request({
      url: requestUrl,
      method: method,
      data: data,
      header: header,
      success: (res) => {
        console.log('[API] 响应:', requestUrl, res)
        
        if (res.statusCode === 200) {
          // 后端返回格式: {code: 0, msg: "success", data: {...}}
          if (res.data) {
            // 不管 code 是什么，都返回给上层处理
            resolve(res.data)
          } else {
            // 没有返回数据
            console.error('[API] 响应数据为空:', res)
            wx.showToast({
              title: '响应数据为空',
              icon: 'none'
            })
            reject({ code: -1, msg: '响应数据为空' })
          }
        } else {
          // HTTP错误
          console.error('[API] HTTP错误:', res.statusCode, res)
          wx.showToast({
            title: `请求失败(${res.statusCode})`,
            icon: 'none'
          })
          reject({ code: -1, msg: `HTTP错误: ${res.statusCode}` })
        }
      },
      fail: (error) => {
        console.error('[API] 网络请求失败:', requestUrl, error)
        wx.showToast({
          title: '网络请求失败',
          icon: 'none'
        })
        reject(error)
      }
    })
  })
}

/**
 * 微信登录相关API
 */
const WechatAPI = {
  /**
   * 通过微信code获取用户token
   * @param {string} code - 微信登录code
   * @returns {Promise} 返回 {openid, is_register, user_info?, jwt_token?}
   */
  getUserToken(code) {
    return request('/wechat/user/token', 'POST', { code })
  },

  /**
   * 获取手机号
   * @param {string} code - 手机号授权code
   * @returns {Promise}
   */
  getPhoneNumber(code) {
    return request('/wechat/phonenumber', 'GET', { code })
  },

  /**
   * 注册用户
   * @param {object} data - {phone_number, openid, nick?}
   * @returns {Promise}
   */
  registerUser(data) {
    return request('/wechat/user/register', 'POST', data)
  },

  /**
   * 获取当前用户信息
   * @returns {Promise}
   */
  getUserInfo() {
    return request('/wechat/user/info', 'GET', {}, true)
  }
}

/**
 * 首页相关API
 */
const HomeAPI = {
  /**
   * 批量获取系统配置
   * @param {string} keys - 配置key列表，逗号分隔
   */
  getConfigValues(keys) {
    return request(`/config/values?keys=${keys}`, 'GET')
  },

  /**
   * 获取轮播图
   * @param {string} type - 轮播图类型，默认index
   */
  getBanners(type = 'index') {
    return request(`/banner/list?type=${type}`, 'GET')
  },

  /**
   * 获取所有商品分类
   */
  getAllCategories() {
    return request('/goods/category/all', 'GET')
  },

  /**
   * 获取商品列表
   * @param {object} params - 查询参数
   */
  getGoodsList(params = {}) {
    const queryStr = Object.keys(params)
      .filter(key => {
        const value = params[key]
        // 过滤掉 undefined、null、空字符串
        return value !== undefined && value !== null && value !== ''
      })
      .map(key => `${key}=${encodeURIComponent(params[key])}`)
      .join('&')
    return request(`/goods/v2/list${queryStr ? '?' + queryStr : ''}`, 'GET')
  },

  /**
   * 获取商品详情
   * @param {number} goodsId - 商品ID
   */
  getGoodsDetail(goodsId) {
    return request(`/goods/detail/${goodsId}`, 'GET')
  },

  /**
   * 获取优惠券列表
   */
  getCoupons() {
    return request('/discounts/coupons', 'GET')
  },

  /**
   * 获取通知列表
   * @param {number} pageSize - 每页数量
   */
  getNotices(pageSize = 5) {
    return request(`/notice/list?page_size=${pageSize}`, 'GET')
  }
}

/**
 * 商品模块API
 */
const GoodsAPI = {
  /**
   * 获取商品详情
   * @param {number} goodsId - 商品ID
   */
  getDetail(goodsId) {
    return request(`/goods/detail/${goodsId}`, 'GET')
  },

  /**
   * 获取商品评价列表
   * @param {number} goodsId - 商品ID
   * @param {number} page - 页码
   * @param {number} pageSize - 每页数量
   */
  getReputations(goodsId, page = 1, pageSize = 10) {
    return request(`/goods/${goodsId}/reputations?page=${page}&page_size=${pageSize}`, 'GET')
  }
}

/**
 * 农场模块API
 */
const FarmAPI = {
  /**
   * 获取农庄轮播图
   */
  getBanners() {
    return request('/farm/banners', 'GET')
  },

  /**
   * 获取农庄信息
   */
  getInfo() {
    return request('/farm/info', 'GET')
  },

  /**
   * 获取监控设备列表
   * @param {number} page
   * @param {number} pageSize
   */
  getDevices(page = 0, pageSize = 50) {
    return request(`/farm/devices?page=${page}&page_size=${pageSize}`, 'GET', {}, true)
  },

  /**
   * 获取播放配置（包含 accessToken + url）
   * @param {object} params
   *  - device_serial: string
   *  - channel_no?: number
   *  - protocol?: number (1-ezopen 2-hls 3-rtmp 4-flv, 默认3)
   *  - type?: number (1预览 2本地回放 3云回放，默认1)
   *  - start_time?: string
   *  - stop_time?: string
   */
  getPlayConfig(params = {}) {
    const query = []
    if (params.device_serial) query.push(`device_serial=${params.device_serial}`)
    if (params.channel_no !== undefined) query.push(`channel_no=${params.channel_no}`)
    if (params.protocol !== undefined) query.push(`protocol=${params.protocol}`)
    if (params.type !== undefined) query.push(`type=${params.type}`)
    if (params.start_time) query.push(`start_time=${encodeURIComponent(params.start_time)}`)
    if (params.stop_time) query.push(`stop_time=${encodeURIComponent(params.stop_time)}`)
    const qs = query.join('&')
    return request(`/farm/live/play-config${qs ? '?' + qs : ''}`, 'GET', {}, true)
  },

  /**
   * 获取监控视频列表
   */
  getMonitors() {
    return request('/farm/monitors', 'GET')
  },

  /**
   * 获取环境数据
   */
  getEnvironment() {
    return request('/farm/environment', 'GET', {}, true)
  },

  /**
   * 获取养殖日记
   * @param {string} batchNo - 批次号
   */
  getDiary(batchNo = null) {
    const url = batchNo ? `/farm/diary?batch_no=${batchNo}` : '/farm/diary'
    return request(url, 'GET', {}, true)
  },

  /**
   * 获取质量报告
   */
  getQualityReports() {
    return request('/farm/quality-reports', 'GET')
  },

  /**
   * 获取认证资质
   */
  getCertifications() {
    return request('/farm/certifications', 'GET')
  },

  /**
   * 获取农庄动态
   * @param {number} page - 页码
   * @param {number} pageSize - 每页数量
   */
  getNews(page = 1, pageSize = 10) {
    return request(`/farm/news?page=${page}&page_size=${pageSize}`, 'GET')
  },

  /**
   * 获取养殖特色
   */
  getFeatures() {
    return request('/farm/features', 'GET')
  },

  /**
   * 获取溯源信息
   * @param {string} code - 溯源码
   */
  getTrace(code) {
    return request(`/farm/trace?code=${code}`, 'GET')
  }
}

/**
 * 购物车模块API
 */
const CartAPI = {
  /**
   * 获取购物车列表
   */
  getInfo() {
    return request('/cart/info', 'GET', {}, true)
  },

  /**
   * 添加到购物车
   * @param {object} data - {goods_id, number, property_child_ids?}
   */
  add(data) {
    return request('/cart/add', 'POST', data, true)
  },

  /**
   * 修改商品数量
   * @param {string} key - 购物车项key
   * @param {number} number - 新数量
   */
  modifyNumber(key, number) {
    return request('/cart/modify-number', 'POST', { key, number }, true)
  },

  /**
   * 删除购物车商品
   * @param {string} key - 购物车项key
   */
  remove(key) {
    return request('/cart/remove', 'POST', { key }, true)
  },

  /**
   * 选择/取消商品
   * @param {string} key - 购物车项key
   * @param {boolean} selected - 是否选中
   */
  select(key, selected) {
    return request('/cart/select', 'POST', { key, selected }, true)
  },

  /**
   * 清空购物车
   */
  clear() {
    return request('/cart/clear', 'POST', {}, true)
  },

  /**
   * 获取购物车数量
   */
  getCount() {
    return request('/cart/count', 'GET', {}, true)
  }
}

/**
 * 个人中心模块API
 */
const UserAPI = {
  /**
   * 修改用户信息
   * @param {object} data - {nick?, avatar_url?, gender?, birthday?}
   */
  modify(data) {
    return request('/user/modify', 'POST', data, true)
  },

  /**
   * 获取用户资产
   */
  getAmount() {
    return request('/user/amount', 'GET', {}, true)
  },

  /**
   * 获取资产明细
   * @param {string} type - 类型 balance/score
   * @param {number} page - 页码
   * @param {number} pageSize - 每页数量
   */
  getAmountLog(type = null, page = 1, pageSize = 20) {
    const params = { page, page_size: pageSize }
    if (type) params.type = type
    const queryStr = Object.keys(params)
      .map(key => `${key}=${params[key]}`)
      .join('&')
    return request(`/user/amount/log?${queryStr}`, 'GET', {}, true)
  },

  /**
   * 退出登录
   */
  logout() {
    return request('/user/logout', 'POST', {}, true)
  }
}

/**
 * 订单模块API
 */
const OrderAPI = {
  /**
   * 获取订单统计
   */
  getStatistics() {
    return request('/order/statistics', 'GET', {}, true)
  },

  /**
   * 获取订单列表
   * @param {number} status - 订单状态
   * @param {number} page - 页码
   * @param {number} pageSize - 每页数量
   */
  getList(status = undefined, page = 1, pageSize = 10) {
    const params = {
      page,
      page_size: pageSize
    }
    // 只有在明确传入状态且不是 9999/空/undefined/null 时才附加 status
    if (
      status !== undefined &&
      status !== null &&
      status !== '' &&
      status !== 9999
    ) {
      params.status = status
    }
    const queryStr = Object.keys(params)
      .map(key => `${key}=${params[key]}`)
      .join('&')
    return request(`/order/list?${queryStr}`, 'GET', {}, true)
  },

  /**
   * 创建订单
   * @param {object} data - 订单数据
   */
  create(data) {
    return request('/order/create', 'POST', data, true)
  },

  /**
   * 发起支付（返回微信支付参数）
   * @param {object} data - {order_number, pay_type?, use_balance?}
   */
  pay(data) {
    return request('/order/pay', 'POST', data, true)
  },

  /**
   * 获取订单详情（通过订单号/序列号）
   * @param {string} orderSn - 订单号
   */
  getDetail(orderSn) {
    return request(`/order/detail/${orderSn}`, 'GET', {}, true)
  },

  /**
   * 取消订单（通过订单号/序列号）
   * @param {string} orderSn - 订单号
   */
  cancel(orderSn) {
    return request(`/order/${orderSn}/cancel`, 'POST', {}, true)
  },

  /**
   * 确认收货
   * @param {string} orderSn - 订单号
   */
  confirm(orderSn) {
    return request(`/order/${orderSn}/confirm`, 'POST', { order_number: orderSn }, true)
  },

  /**
   * 提交订单评价
   * @param {object} data - 评价数据
   * @returns {Promise}
   */
  submitReputation(data) {
    return request('/order/reputation', 'POST', data, true)
  }
}

/**
 * 优惠券模块API
 */
const CouponAPI = {
  /**
   * 获取我的优惠券
   * @param {number} status - 状态 0-未使用 1-已使用 2-已过期
   */
  getMyCoupons(status = null) {
    const url = status !== null ? `/discounts/my?status=${status}` : '/discounts/my'
    return request(url, 'GET', {}, true)
  },

  /**
   * 领取优惠券
   * @param {number} couponId - 优惠券ID
   */
  fetch(couponId) {
    return request('/discounts/fetch', 'POST', { coupon_id: couponId }, true)
  }
}

/**
 * 收藏模块API
 */
const FavoriteAPI = {
  /**
   * 获取收藏列表
   * @param {number} page - 页码
   * @param {number} pageSize - 每页数量
   */
  getList(page = 1, pageSize = 20) {
    return request(`/goods/fav/list?page=${page}&page_size=${pageSize}`, 'GET', {}, true)
  },

  /**
   * 添加收藏
   * @param {number} goodsId - 商品ID
   */
  add(goodsId) {
    return request('/goods/fav/add', 'POST', { goods_id: goodsId }, true)
  },

  /**
   * 取消收藏
   * @param {number} goodsId - 商品ID
   */
  delete(goodsId) {
    return request('/goods/fav/delete', 'POST', { goods_id: goodsId }, true)
  }
}

/**
 * 浏览记录API
 */
const HistoryAPI = {
  /**
   * 获取浏览记录
   * @param {number} page - 页码
   * @param {number} pageSize - 每页数量
   */
  getList(page = 1, pageSize = 20) {
    return request(`/goods/history?page=${page}&page_size=${pageSize}`, 'GET', {}, true)
  }
}

/**
 * 地址管理API
 */
const AddressAPI = {
  /**
   * 获取地址列表
   */
  getList() {
    return request('/user/shipping-address/list', 'GET', {}, true)
  },

  /**
   * 添加地址
   * @param {object} data - 地址信息
   */
  add(data) {
    return request('/user/shipping-address/add', 'POST', data, true)
  },

  /**
   * 修改地址
   * @param {object} data - 地址信息（包含id）
   */
  update(data) {
    return request('/user/shipping-address/update', 'POST', data, true)
  },

  /**
   * 删除地址
   * @param {number} id - 地址ID
   */
  delete(id) {
    return request(`/user/shipping-address/delete?id=${id}`, 'POST', {}, true)
  },

  /**
   * 设置默认地址
   * @param {number} id - 地址ID
   */
  setDefault(id) {
    return request(`/user/shipping-address/default?id=${id}`, 'POST', {}, true)
  }
}

/**
 * 意见反馈API
 */
const FeedbackAPI = {
  /**
   * 提交意见反馈
   * @param {object} data - {content, mobile?, pics?}
   */
  post(data) {
    return request('/feedback/post', 'POST', data, true)
  }
}

module.exports = {
  WechatAPI,
  HomeAPI,
  GoodsAPI,
  FarmAPI,
  CartAPI,
  UserAPI,
  OrderAPI,
  CouponAPI,
  FavoriteAPI,
  HistoryAPI,
  AddressAPI,
  FeedbackAPI
}

