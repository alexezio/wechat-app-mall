// utils/wxapi-adapter.js - WXAPI适配器，兼容旧代码
const CONFIG = require('../config.js')
const API = require('./api.js')

// 从API导入各个模块
const { 
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
} = API

// 定义缺失的模块别名（HomeAPI包含这些功能）
const ConfigAPI = HomeAPI
const BannerAPI = HomeAPI
const NoticeAPI = HomeAPI

// 缓存商品详情数据，用于价格计算
const goodsDetailCache = {}

// 购物车 key -> id 映射表（cart_item_key_xxx -> 后端cart项主键）
const cartKeyIdMap = {}

// 订单状态映射
const ORDER_STATUS_MAP = {
  0: '待付款',
  1: '待发货',
  2: '待收货',
  3: '待评价',
  4: '已完成',
  '-1': '已取消',
  '-2': '退款中',
  '-3': '已退款'
}

/**
 * 解析 property 字符串为 sku 数组
 * @param {string} propertyStr - "规格:1:3" 或 "颜色:红色 尺寸:L"
 * @returns {array} [{optionName: "规格", optionValueName: "1:3"}]
 */
function parsePropertyString(propertyStr) {
  if (!propertyStr || typeof propertyStr !== 'string') {
    return []
  }
  
  // 尝试按空格分割多个属性
  const parts = propertyStr.trim().split(/\s+/)
  const skuArray = []
  
  parts.forEach(part => {
    // 按冒号分割属性名和值
    const colonIndex = part.indexOf(':')
    if (colonIndex > 0) {
      const optionName = part.substring(0, colonIndex)
      const optionValueName = part.substring(colonIndex + 1)
      skuArray.push({
        optionName: optionName,
        optionValueName: optionValueName
      })
    }
  })
  
  return skuArray
}

/**
 * 适配器：让旧代码可以无缝使用新API
 * 保持apifm-wxapi的接口签名不变
 */
const WXAPIAdapter = {
  /**
   * 初始化（兼容旧代码，实际不需要）
   */
  init(subDomain) {
    console.log('WXAPI Adapter initialized with subDomain:', subDomain)
  },

  setMerchantId(merchantId) {
    console.log('WXAPI Adapter set merchantId:', merchantId)
  },

  /**
   * 批量获取配置
   */
  async queryConfigBatch(keys) {
    try {
      const res = await HomeAPI.getConfigValues(keys)
      return res
    } catch (error) {
      return { code: -1, msg: error.message || error.msg }
    }
  },

  /**
   * 获取轮播图
   */
  async banners(params) {
    try {
      const type = params?.type || 'index'
      const res = await HomeAPI.getBanners(type)
      
      // 转换字段名：pic_url -> picUrl, link_url -> linkUrl
      if (res.code === 0 && res.data && Array.isArray(res.data)) {
        const converted = res.data.map(item => ({
          id: item.id,
          picUrl: item.pic_url,
          linkType: item.link_type,
          linkUrl: item.link_url,
          appid: item.appid,
          orderSort: item.order_sort,
          status: item.status
        }))
        return { code: 0, data: converted }
      }
      
      return res
    } catch (error) {
      return { code: -1, msg: error.message || error.msg }
    }
  },

  /**
   * 获取商品分类
   */
  async goodsCategory() {
    try {
      const res = await HomeAPI.getAllCategories()
      console.log('[适配器] goodsCategory 原始返回:', res)
      
      // 确保返回格式正确
      if (res.code === 0 && res.data) {
        // 如果 data 是数组，直接返回
        if (Array.isArray(res.data)) {
          return res
        }
        // 如果 data.result 是数组，提取出来
        if (res.data.result && Array.isArray(res.data.result)) {
          return {
            code: 0,
            data: res.data.result
          }
        }
      }
      
      return res
    } catch (error) {
      console.error('[适配器] goodsCategory 错误:', error)
      return { code: -1, msg: error.message || error.msg }
    }
  },

  /**
   * 获取商品列表V2
   */
  async goodsv2(params) {
    try {
      // 参数转换：旧参数名 -> 新参数名，且过滤掉空值
      const newParams = {}
      
      // 只添加有值的参数（不为undefined、null、空字符串）
      if (params.categoryId !== undefined && params.categoryId !== null && params.categoryId !== '') {
        newParams.category_id = params.categoryId
      }
      if (params.page !== undefined && params.page !== null) {
        newParams.page = params.page
      }
      if (params.pageSize !== undefined && params.pageSize !== null) {
        newParams.page_size = params.pageSize
      }
      if (params.recommendStatus !== undefined && params.recommendStatus !== null) {
        newParams.recommend_status = params.recommendStatus
      }
      if (params.miaosha !== undefined && params.miaosha !== null) {
        newParams.miaosha = params.miaosha
      }
      if (params.kanjia !== undefined && params.kanjia !== null) {
        newParams.kanjia = params.kanjia
      }
      if (params.pingtuan !== undefined && params.pingtuan !== null) {
        newParams.pingtuan = params.pingtuan
      }
      
      console.log('[适配器] goodsv2 请求参数:', newParams)
      const res = await HomeAPI.getGoodsList(newParams)
      console.log('[适配器] goodsv2 返回数据:', res)
      
      // 后端返回格式：{code: 0, data: {result: [...], total_row: 8}}
      // 需要将字段名从 snake_case 转换为 camelCase
      if (res.code === 0 && res.data && res.data.result) {
        const convertedResult = res.data.result.map(item => ({
          id: item.id,
          name: item.goods_name,
          goodsId: item.id,
          pic: item.pic,
          minPrice: item.min_price,
          originalPrice: item.original_price,
          stores: item.stores,
          soldNumber: item.sold_number,
          categoryId: item.category_id,
          status: item.status,
          dateStart: item.date_start,
          dateEnd: item.date_end
        }))
        
        return {
          code: 0,
          data: {
            result: convertedResult,
            totalRow: res.data.total_row,
            totalPage: res.data.total_page,
            currentPage: res.data.current_page,
            pageSize: res.data.page_size
          }
        }
      }
      
      return res
    } catch (error) {
      console.error('[适配器] goodsv2 错误:', error)
      return { code: -1, msg: error.message || error.msg }
    }
  },

  /**
   * 获取优惠券
   */
  async coupons() {
    try {
      const res = await HomeAPI.getCoupons()
      
      // 转换字段名
      if (res.code === 0 && res.data && Array.isArray(res.data)) {
        const converted = res.data.map(item => ({
          id: item.id,
          name: item.name,
          moneyHreshold: item.money_hreshold,
          moneyOff: item.money_off,
          dateStart: item.date_start,
          dateEnd: item.date_end,
          status: item.status
        }))
        return { code: 0, data: converted }
      }
      
      return res
    } catch (error) {
      return { code: -1, msg: error.message || error.msg }
    }
  },

  /**
   * 获取通知列表
   */
  async noticeList(params) {
    try {
      const pageSize = params?.pageSize || 5
      const res = await HomeAPI.getNotices(pageSize)
      
      // 转换字段名，包装成 {dataList: [...]} 格式
      if (res.code === 0 && res.data && Array.isArray(res.data)) {
        const converted = res.data.map(item => ({
          id: item.id,
          title: item.title,
          content: item.content,
          dateAdd: item.date_add
        }))
        return { code: 0, data: { dataList: converted } }
      }
      
      return res
    } catch (error) {
      return { code: -1, msg: error.message || error.msg }
    }
  },

  /**
   * 获取用户详情
   */
  async userDetail(token) {
    try {
      const res = await WechatAPI.getUserInfo()
      if (res.code === 0) {
        // 转换为旧格式
        const userData = res.data
        return {
          code: 0,
          msg: 'success',
          data: {
            base: {
              id: userData.id || userData.user_id,
              nick: userData.nick,
              avatarUrl: userData.avatar_url,
              mobile: userData.mobile,
              gender: userData.gender,
              dateAdd: userData.date_add
            },
            ext: {
              balance: parseFloat(userData.balance || 0),
              freeze: parseFloat(userData.freeze || 0),
              score: userData.score || 0,
              growth: userData.growth || 0
            }
          }
        }
      }
      return res
    } catch (error) {
      return { code: -1, msg: error.message }
    }
  },

  /**
   * 获取用户资产
   */
  async userAmount(token) {
    try {
      const res = await UserAPI.getAmount()
      if (res.code === 0) {
        return {
          code: 0,
          msg: 'success',
          data: {
            balance: parseFloat(res.data.balance),
            freeze: parseFloat(res.data.freeze),
            score: res.data.score,
            growth: res.data.growth
          }
        }
      }
      return res
    } catch (error) {
      return { code: -1, msg: error.message }
    }
  },

  /**
   * 获取订单统计
   */
  async orderStatistics(token) {
    try {
      const res = await OrderAPI.getStatistics()
      if (res.code === 0 && res.data) {
        // 兼容老字段：count_id_no_pay / count_id_no_transfer / count_id_no_confirm / count_id_no_reputation
        return {
          code: 0,
          data: {
            count_id_no_pay: res.data.unpaid || 0,
            count_id_no_transfer: res.data.unshipped || 0,
            count_id_no_confirm: res.data.shipped || 0,
            count_id_no_reputation: res.data.uncommented || 0,
            refunding: res.data.refunding || 0
          }
        }
      }
      return res
    } catch (error) {
      return { code: -1, msg: error.message }
    }
  },

  /**
   * 订单详情（通过订单号/序列号）
   */
  async orderDetail(orderSn) {
    try {
      const res = await OrderAPI.getDetail(orderSn)
      return res
    } catch (error) {
      return { code: -1, msg: error.message || error.msg }
    }
  },

  /**
   * 取消订单
   */
  async orderClose(token, orderSn) {
    try {
      const res = await OrderAPI.cancel(orderSn)
      return res
    } catch (error) {
      return { code: -1, msg: error.message || error.msg }
    }
  },

  /**
   * 确认收货
   */
  async orderConfirm(token, orderSn) {
    try {
      const res = await OrderAPI.confirm(orderSn)
      return res
    } catch (error) {
      return { code: -1, msg: error.message || error.msg }
    }
  },

  /**
   * 购物车相关
   */
  async shippingCarInfo(token) {
    try {
      const res = await CartAPI.getInfo()
      console.log('[适配器] 购物车原始数据:', res)
      
      // 转换字段名
      if (res.code === 0 && res.data && res.data.items) {
        const convertedItems = res.data.items.map(item => {
          const key = item.key || `cart_item_key_${item.id}`
          // 建立 key -> id 映射，用于删除/修改数量时还原数据库主键
          cartKeyIdMap[key] = item.id
          return {
            id: item.id,
            key,
            goodsId: item.goods_id,
            name: item.goods_name,
            pic: item.pic,
            price: item.price,
            number: item.number,
            selected: item.selected,
            stores: item.stores,
            status: item.status,
            dateAdd: item.date_add,
            // 解析 property 字段为 sku 数组
            sku: parsePropertyString(item.property),
            shopId: item.shop_id || 0,
            left: 'left:0rpx'
          }
        })
        
        // 生成 shopList（如果商品有 shopId，按店铺分组；否则使用默认店铺）
        const shopSet = new Set()
        convertedItems.forEach(item => {
          if (item.shopId) {
            shopSet.add(item.shopId)
          }
        })
        
        let shopList = []
        if (shopSet.size > 0) {
          // 有店铺信息
          shopSet.forEach(shopId => {
            shopList.push({
              id: shopId,
              name: `店铺${shopId}` // 如果后端有店铺名称，这里可以映射
            })
          })
        } else {
          // 没有店铺信息，使用默认店铺
          shopList = [{
            id: 0,
            name: '自营商品'
          }]
        }
        
        const converted = {
          code: 0,
          data: {
            items: convertedItems,
            price: res.data.total_price,        // 模板期望的字段名
            totalPrice: res.data.total_price,   // 保留驼峰命名
            totalNumber: res.data.total_number,
            selectedCount: res.data.selected_count,
            shopList: shopList,
            score: 0 // 积分，暂时为0
          }
        }
        
        console.log('[适配器] 购物车转换后 - items数量:', converted.data.items.length)
        console.log('[适配器] 购物车转换后 - shopList:', converted.data.shopList)
        console.log('[适配器] 购物车转换后 - price:', converted.data.price)
        return converted
      }
      
      return res
    } catch (error) {
      console.error('[适配器] 获取购物车错误:', error)
      return { code: -1, msg: error.message || error.msg }
    }
  },

  async shippingCarInfoRemoveItem(token, key) {
    try {
      // 将传入的 cart_item_key_xxx 规范化为 cart_item_key_{id}（无前导0）
      let keys = []
      if (Array.isArray(key)) {
        keys = key
      } else {
        keys = String(key || '').split(',').map(s => s.trim()).filter(Boolean)
      }
      const normalizedKeys = keys
        .map(k => {
          // 优先使用映射表还原真实id
          const mappedId = cartKeyIdMap[k]
          if (mappedId) {
            return `cart_item_key_${mappedId}`
          }
          // 若无映射，尝试解析末尾数字并去掉前导0
          const m = k.match(/(\d+)$/)
          if (m) {
            const id = m[1].replace(/^0+/, '') || '0'
            return `cart_item_key_${id}`
          }
          return k
        })
        .filter(Boolean)
        .join(',')

      const res = await CartAPI.remove(normalizedKeys)
      // 转换返回格式
      if (res.code === 0 && res.data) {
        return {
          code: 0,
          data: {
            cartCount: res.data.cart_count
          }
        }
      }
      return res
    } catch (error) {
      return { code: -1, msg: error.message || error.msg }
    }
  },

  async shippingCarInfoModifyNumber(token, key, number) {
    try {
      const res = await CartAPI.modifyNumber(key, number)
      // 转换返回格式
      if (res.code === 0 && res.data) {
        return {
          code: 0,
          data: {
            number: res.data.number,
            price: res.data.total_price,        // 模板期望的字段名
            totalPrice: res.data.total_price,
            cartCount: res.data.cart_count
          }
        }
      }
      return res
    } catch (error) {
      return { code: -1, msg: error.message || error.msg }
    }
  },

  async shippingCartSelected(token, key, selected) {
    try {
      const res = await CartAPI.select(key, selected)
      // 转换返回格式
      if (res.code === 0 && res.data) {
        return {
          code: 0,
          data: {
            selected: res.data.selected,
            price: res.data.total_price,          // 模板期望的字段名
            totalPrice: res.data.total_price,
            selectedCount: res.data.selected_count
          }
        }
      }
      return res
    } catch (error) {
      return { code: -1, msg: error.message || error.msg }
    }
  },

  /**
   * 修改用户信息
   */
  async modifyUserInfoV2(data) {
    try {
      // 参数转换
      const newData = {}
      if (data.nick !== undefined) newData.nick = data.nick
      if (data.avatarUrl !== undefined) newData.avatar_url = data.avatarUrl
      if (data.gender !== undefined) newData.gender = data.gender
      if (data.birthday !== undefined) newData.birthday = data.birthday
      
      const res = await UserAPI.modify(newData)
      return res
    } catch (error) {
      return { code: -1, msg: error.message }
    }
  },

  /**
   * 我的优惠券
   */
  async myCoupons(token, status) {
    try {
      const res = await CouponAPI.getMyCoupons(status)
      return res
    } catch (error) {
      return { code: -1, msg: error.message }
    }
  },

  /**
   * 领取优惠券
   */
  async fetchCoupons(token, couponId) {
    try {
      const res = await CouponAPI.fetch(couponId)
      return res
    } catch (error) {
      return { code: -1, msg: error.message }
    }
  },

  /**
   * 收藏列表
   */
  async goodsFavList(token, page, pageSize) {
    try {
      const res = await FavoriteAPI.getList(page, pageSize)
      return res
    } catch (error) {
      return { code: -1, msg: error.message }
    }
  },

  /**
   * 添加收藏
   */
  async goodsFavAdd(token, goodsId) {
    try {
      const res = await FavoriteAPI.add(goodsId)
      return res
    } catch (error) {
      return { code: -1, msg: error.message }
    }
  },

  /**
   * 取消收藏
   */
  async goodsFavDelete(token, goodsId) {
    try {
      const res = await FavoriteAPI.delete(goodsId)
      return res
    } catch (error) {
      return { code: -1, msg: error.message }
    }
  },

  /**
   * 浏览记录
   */
  async goodsBrowse(token, goodsId, page, pageSize) {
    try {
      const res = await HistoryAPI.getList(page, pageSize)
      return res
    } catch (error) {
      return { code: -1, msg: error.message }
    }
  },

  /**
   * 地址列表
   */
  async queryAddress(token) {
    try {
      const res = await AddressAPI.getList()
      return res
    } catch (error) {
      return { code: -1, msg: error.message }
    }
  },

  /**
   * 添加地址
   */
  async addAddress(token, data) {
    try {
      const res = await AddressAPI.add(data)
      return res
    } catch (error) {
      return { code: -1, msg: error.message }
    }
  },

  /**
   * 修改地址
   */
  async updateAddress(token, data) {
    try {
      const res = await AddressAPI.update(data)
      return res
    } catch (error) {
      return { code: -1, msg: error.message }
    }
  },

  /**
   * 删除地址
   */
  async deleteAddress(token, id) {
    try {
      const res = await AddressAPI.delete(id)
      return res
    } catch (error) {
      return { code: -1, msg: error.message }
    }
  },

  /**
   * 订单列表
   */
  async orderList(token, params) {
    try {
      // 兼容调用方式：orderList(token, params) 或 orderList(params)
      if (token && typeof token === 'object' && !params) {
        params = token
        token = params.token
      }

      const status = (params && 'status' in params) ? params.status : 0
      const page = params?.page || 1
      const pageSize = params?.pageSize || 10

      // 状态参数：9999/''/null/undefined 视为全部，其余传原值
      const statusParam = (status === '' || status === null || typeof status === 'undefined' || status === 9999)
        ? undefined
        : status

      const res = await OrderAPI.getList(statusParam, page, pageSize)
      if (res.code === 0 && res.data) {
        const filterStatus = (status === '' || status === null || typeof status === 'undefined' || status === 9999)
          ? null
          : Number(status)

        const filtered = (res.data.result || []).filter(o => {
          if (filterStatus === null) return true
          return Number(o.status) === filterStatus
        })

        const orderList = filtered.map(o => ({
          id: o.id,
          orderNumber: o.order_number,
          status: o.status,
          statusStr: o.status_str || ORDER_STATUS_MAP[o.status] || '',
          amountReal: o.amount_real,
          score: o.score || 0,
          goodsNumber: o.goods_number,
          dateAdd: o.date_add,
          remark: o.remark || '',
          payTimeout: o.pay_timeout,
          canCancel: o.can_cancel,
          canPay: o.can_pay,
          canRefund: o.can_refund,
          canConfirm: o.can_confirm,
          canComment: o.can_comment,
          logisticsCompany: o.logistics_company,
          logisticsNumber: o.logistics_number
        }))

        // goodsMap: 订单ID -> 商品数组（前端需要）
        const goodsMap = {}
        filtered.forEach(o => {
          goodsMap[o.id] = (o.goods || []).map(g => ({
            id: g.goods_id,
            goodsId: g.goods_id,
            goodsName: g.goods_name,
            pic: g.pic,
            property: g.property,
            number: g.number,
            price: g.price,
            amountSingle: g.amount || g.price
          }))
        })

        return {
          code: 0,
          msg: 'success',
          data: {
            orderList,
            goodsMap,
            logisticsMap: {},
            // 优先使用后端的分页数据；如无则用本地过滤结果
            totalRow: res.data.total_row || filtered.length,
            totalPage: res.data.total_page || Math.max(1, Math.ceil(filtered.length / pageSize)),
            currentPage: res.data.current_page || page
          }
        }
      }
      return res
    } catch (error) {
      return { code: -1, msg: error.message }
    }
  },

  /**
   * 发起支付，返回支付参数
   * @param {string} token
   * @param {string} orderNumber 订单号（order_number）
   * @param {object} extra 可选 { pay_type, payType, use_balance }
   */
  async orderPay(token, orderNumber, extra = {}) {
    try {
      if (!orderNumber) {
        return { code: -1, msg: '缺少订单号' }
      }
      // 根据支付方式传递 payType，默认余额支付
      const payType = extra.payType || extra.pay_type || 'balance'
      const res = await OrderAPI.pay({
        order_number: orderNumber,
        pay_type: payType,
        ...extra
      })
      return res
    } catch (error) {
      return { code: -1, msg: error.message || error.msg || '支付失败' }
    }
  },

  /**
   * 提交订单评价
   * @param {object} params - { postJsonString: JSON.stringify({ token, orderId, reputations }) }
   */
  async orderReputation(params) {
    try {
      if (!params || !params.postJsonString) {
        return { code: -1, msg: '缺少评价参数' }
      }
      const data = JSON.parse(params.postJsonString)
      if (!data.orderId || !data.reputations || !Array.isArray(data.reputations)) {
        return { code: -1, msg: '评价参数格式错误' }
      }
      
      // 转换为后端需要的格式
      const requestData = {
        order_id: data.orderId,
        reputations: data.reputations.map(r => ({
          order_goods_id: r.id,
          reputation: r.reputation,
          reputation_score: r.reputationNumber || r.reputation,
          remark: r.remark || '',
          pics: r.pics || []
        }))
      }
      
      const res = await OrderAPI.submitReputation(requestData)
      return res
    } catch (error) {
      return { code: -1, msg: error.message || error.msg || '提交评价失败' }
    }
  },

  /**
   * 其他可能需要的方法（暂时返回空数据）
   */
  async goodsDynamic(goodsId) {
    return { code: 700, msg: '暂无数据', data: [] }
  },

  async kanjiaSet(ids) {
    return { code: 700, msg: '暂无数据', data: [] }
  },

  async adPosition(key) {
    return { code: 700, msg: '暂无数据', data: null }
  },

  async cmsCategories() {
    return { code: 700, msg: '暂无数据', data: [] }
  },

  async cardMyList(token) {
    return { code: 700, msg: '暂无数据', data: [] }
  },

  async bindSeller(data) {
    return { code: 0, msg: 'success' }
  },

  async checkToken(token) {
    try {
      const res = await WechatAPI.getUserInfo()
      return res
    } catch (error) {
      return { code: -1, msg: error.message }
    }
  },

  async uploadFileV2(token, filePath) {
    // TODO: 实现文件上传
    return { code: -1, msg: '文件上传功能待实现' }
  },

  async peisongMemberChangeWorkStatus(token) {
    return { code: -1, msg: '配送功能待实现' }
  },

  /**
   * 商品详情相关
   */
  async goodsDetail(goodsId, token) {
    try {
      const res = await HomeAPI.getGoodsDetail(goodsId)
      console.log('[适配器] goodsDetail 原始返回:', res)
      
      // 转换字段名格式
      if (res.code === 0 && res.data) {
        const item = res.data
        
        // 处理图片数组：将字符串数组转为对象数组
        let pics = []
        if (item.pics && Array.isArray(item.pics)) {
          pics = item.pics.map(url => ({ pic: url }))
        } else if (item.pic) {
          pics = [{ pic: item.pic }]
        }
        
        // 处理商品规格和SKU列表
        let properties = []
        let skuList = []
        
        if (item.properties && Array.isArray(item.properties) && item.properties.length > 0) {
          // 有规格的情况
          const basePrice = parseFloat(item.min_price)
          
          properties = item.properties.map((prop, propIndex) => {
            const mappedProp = {
              id: prop.id,
              name: prop.name,
              optionValueId: null, // 用于标记当前选中的选项ID
              childsCurGoods: (prop.childsCurGoods || []).map((child, childIndex) => {
                const addPrice = parseFloat(child.price || 0)
                const actualPrice = basePrice + addPrice
                
                return {
                  id: child.id,
                  name: child.name,
                  price: actualPrice.toFixed(2), // 实际价格（基础价+加价）
                  originalPrice: child.price, // 保留原始加价
                  stores: child.stores,
                  propertyChildIds: child.propertyChildIds || child.property_child_ids,
                  active: propIndex === 0 && childIndex === 0 // 默认选中第一个规格的第一个选项
                }
              })
            }
            
            // 设置第一个属性的第一个选项为默认选中
            if (propIndex === 0 && mappedProp.childsCurGoods.length > 0) {
              mappedProp.optionValueId = mappedProp.childsCurGoods[0].id
            }
            
            return mappedProp
          })
          
          // 生成 skuList（所有规格组合）
          if (properties.length > 0) {
            properties.forEach(prop => {
              prop.childsCurGoods.forEach(child => {
                skuList.push({
                  id: child.id,
                  propertyChildIds: `${prop.id}:${child.id}`,
                  price: parseFloat(child.price), // child.price 已经是实际价格了
                  stores: child.stores,
                  pic: item.pic
                })
              })
            })
          }
        } else {
          // 如果没有规格，添加一个默认规格（允许直接购买）
          properties = [{
            id: 1,
            name: '规格',
            childsCurGoods: [{
              id: 1,
              name: '默认',
              price: '0.00',
              stores: item.stores,
              propertyChildIds: '1:1',
              active: true // 默认选中
            }]
          }]
          
          // 默认SKU
          skuList = [{
            id: 1,
            propertyChildIds: '1:1',
            price: parseFloat(item.min_price),
            stores: item.stores,
            pic: item.pic
          }]
        }
        
        // 计算默认选中的规格信息
        let defaultPropertyChildIds = ''
        let defaultPropertyChildNames = ''
        let defaultCanSubmit = false
        
        if (properties.length > 0) {
          // 检查所有规格是否都有默认选中的选项
          let allSelected = true
          properties.forEach(prop => {
            const selectedChild = prop.childsCurGoods.find(c => c.active)
            if (selectedChild) {
              defaultPropertyChildIds += `${prop.id}:${selectedChild.id},`
              defaultPropertyChildNames += `${prop.name}:${selectedChild.name}  `
            } else {
              allSelected = false
            }
          })
          defaultCanSubmit = allSelected
        }
        
        // 转换为旧API格式
        const converted = {
          basicInfo: {
            id: item.id,
            name: item.goods_name || item.name,
            goodsId: item.id,
            pic: item.pic,
            minPrice: item.min_price,
            originalPrice: item.original_price,
            stores: item.stores,
            soldNumber: item.sold_number,
            categoryId: item.category_id,
            status: item.status,
            views: item.views || 0,
            characteristic: item.characteristic || '',
            description: item.description || '',
            purchaseNotes: item.purchase_notes || '',
            weight: item.weight,
            unit: item.unit || '件',
            minBuy: item.min_buy || 1,
            minBuyNumber: item.min_buy || 1, // 默认购买数量
            maxBuy: item.max_buy || 999,
            videoId: item.video_id || null,
            pingtuan: item.pingtuan || false,
            kanjia: item.kanjia || false,
            miaosha: item.miaosha || false,
            dateStart: item.date_start,
            dateEnd: item.date_end
          },
          pics: pics,
          properties: properties,
          skuList: skuList,
          content: item.content || '',
          logistics: item.logistics || {
            type: '快递配送',
            freight: '0.00'
          },
          isFav: item.is_fav || false,
          reputation: item.reputation || {
            good: 100,
            total: 0,
            list: []
          },
          // 添加初始化的规格选择信息
          _initialPropertyChildIds: defaultPropertyChildIds,
          _initialPropertyChildNames: defaultPropertyChildNames,
          _initialCanSubmit: defaultCanSubmit
        }
        
        console.log('[适配器] goodsDetail 转换后 - properties:', converted.properties)
        console.log('[适配器] goodsDetail 转换后 - skuList:', converted.skuList)
        
        // 缓存商品数据，供 goodsPriceV2 使用
        goodsDetailCache[item.id] = {
          skuList: converted.skuList,
          basicInfo: converted.basicInfo
        }
        
        return { code: 0, data: converted }
      }
      
      return res
    } catch (error) {
      console.error('[适配器] goodsDetail 错误:', error)
      return { code: -1, msg: error.message || error.msg }
    }
  },

  async goodsAddition(goodsId) {
    try {
      return {
        code: 700,
        msg: '商品附加信息接口待实现',
        data: []
      }
    } catch (error) {
      return { code: -1, msg: error.message || error.msg }
    }
  },

  async goodsFavCheck(token, goodsId) {
    try {
      // 检查是否收藏
      return {
        code: 0,
        data: false // 默认未收藏
      }
    } catch (error) {
      return { code: -1, msg: error.message || error.msg }
    }
  },

  async goodsFavPut(token, goodsId) {
    try {
      const res = await FavoriteAPI.add(goodsId)
      return res
    } catch (error) {
      return { code: -1, msg: error.message || error.msg }
    }
  },

  async kanjiaSet(goodsId) {
    // 砍价商品设置
    return { code: 700, msg: '暂无砍价活动', data: [] }
  },

  async pingtuanSet(goodsId) {
    // 拼团商品设置
    return { code: 700, msg: '暂无拼团活动', data: [] }
  },

  async goodsPriceV2(params) {
    try {
      // 获取商品价格（根据规格计算）
      const { goodsId, propertyChildIds } = params
      
      console.log('[适配器] goodsPriceV2 请求:', params)
      
      // 从缓存中获取商品数据
      const cachedGoods = goodsDetailCache[goodsId]
      if (!cachedGoods) {
        console.warn('[适配器] goodsPriceV2 未找到缓存商品:', goodsId)
        return {
          code: 0,
          data: {
            price: '0.00',
            score: 0,
            originalPrice: '0.00',
            stores: 999
          }
        }
      }
      
      // 清理 propertyChildIds（去掉末尾的逗号）
      const cleanPropertyChildIds = propertyChildIds ? propertyChildIds.replace(/,+$/g, '') : ''
      console.log('[适配器] goodsPriceV2 清理后的ID:', cleanPropertyChildIds)
      
      // 从 skuList 中查找匹配的 SKU
      const sku = cachedGoods.skuList.find(item => 
        item.propertyChildIds === cleanPropertyChildIds
      )
      
      if (sku) {
        console.log('[适配器] goodsPriceV2 找到匹配SKU:', sku)
        return {
          code: 0,
          data: {
            price: sku.price.toString(),
            score: 0,
            originalPrice: cachedGoods.basicInfo.originalPrice || sku.price.toString(),
            stores: sku.stores
          }
        }
      }
      
      // 未找到匹配的SKU，返回基础价格
      console.warn('[适配器] goodsPriceV2 未找到匹配SKU, 缓存的SKU列表:', cachedGoods.skuList)
      return {
        code: 0,
        data: {
          price: cachedGoods.basicInfo.minPrice,
          score: 0,
          originalPrice: cachedGoods.basicInfo.originalPrice || cachedGoods.basicInfo.minPrice,
          stores: cachedGoods.basicInfo.stores
        }
      }
    } catch (error) {
      console.error('[适配器] goodsPriceV2 错误:', error)
      return { code: -1, msg: error.message || error.msg }
    }
  },

  async shippingCarInfoAddItem(token, goodsId, number, sku, addition) {
    try {
      console.log('[适配器] 加入购物车参数:', { goodsId, number, sku, addition })
      
      // 转换 sku 格式
      let propertyChildIds = null
      
      if (typeof sku === 'string' && sku.trim()) {
        // 如果是字符串，直接使用（如 "1:2"）
        propertyChildIds = sku.trim()
      } else if (Array.isArray(sku) && sku.length > 0) {
        // 如果是数组，转换为字符串格式
        // sku = [{optionId: 1, optionValueId: 2}] -> "1:2"
        propertyChildIds = sku.map(item => `${item.optionId}:${item.optionValueId}`).join(',')
      }
      
      console.log('[适配器] 转换后的 property_child_ids:', propertyChildIds)
      
      const requestData = {
        goods_id: goodsId,
        number: number
      }
      
      // 只有在有规格时才传 property_child_ids
      if (propertyChildIds) {
        requestData.property_child_ids = propertyChildIds
      }
      
      console.log('[适配器] 最终请求数据:', requestData)
      
      const res = await CartAPI.add(requestData)
      return res
    } catch (error) {
      console.error('[适配器] 加入购物车错误:', error)
      return { code: -1, msg: error.message || error.msg }
    }
  },

  async goodsReputationV2(params) {
    try {
      const goodsId = params.goodsId
      if (!goodsId) {
        return { code: -1, msg: '缺少商品ID' }
      }
      
      const page = params.page || 1
      const pageSize = params.pageSize || 10
      
      const res = await GoodsAPI.getReputations(goodsId, page, pageSize)
      
      if (res.code === 0 && res.data) {
        // 转换为前端需要的格式
        const result = (res.data.result || []).map(item => ({
          id: item.id,
          user: {
            id: item.user_id,
            nick: item.user_nick || item.user_name || `用户${item.user_id}`,
            avatarUrl: item.user_avatar || ''
          },
          goods: {
            goodReputation: item.reputation,
            goodReputationRemark: item.remark || '',
            dateReputation: item.created_at || item.date_add,
            goodReputationReply: item.reply || ''
          },
          reputationPics: (item.pics || []).map(pic => ({
            pic: pic
          }))
        }))
        
        return {
          code: 0,
          data: {
            result,
            goodReputation: res.data.good_reputation_rate || 100,
            totalreputation: res.data.total || result.length
          }
        }
      }
      
      return res
    } catch (error) {
      console.error('[适配器] 获取商品评价错误:', error)
      return { code: -1, msg: error.message || error.msg || '获取评价失败' }
    }
  },

  async pingtuanList(params) {
    // 拼团列表
    return { code: 700, data: [] }
  },

  async videoDetail(videoId) {
    // 视频详情
    return { code: 700, data: null }
  },

  async kanjiaJoin(token, kanjiaId) {
    return { code: 700, msg: '暂无砍价活动' }
  },

  async kanjiaHelp(token, kanjiaId, joinUid, remark) {
    return { code: 700, msg: '暂无砍价活动' }
  },

  async kanjiaDetail(kanjiaId, uid) {
    return { code: 700, data: null }
  },

  async kanjiaHelpDetail(token, kanjiaId, uid) {
    return { code: 700, data: null }
  },

  async pingtuanOpen(token, goodsId) {
    return { code: 700, msg: '暂无拼团活动' }
  },

  async shopSubdetail(shopId) {
    // 店铺详情
    return { code: 700, data: null }
  },

  async wxaQrcode(params) {
    // 生成小程序码
    return { code: 700, data: null }
  },

  // ========== 农场直播/监控 ==========
  async farmDevices(params = {}) {
    try {
      const page = params.page || 0
      const pageSize = params.pageSize || 50
      return await FarmAPI.getDevices(page, pageSize)
    } catch (error) {
      return { code: -1, msg: error.message || error.msg }
    }
  },

  async farmPlayConfig(params = {}) {
    try {
      return await FarmAPI.getPlayConfig(params)
    } catch (error) {
      return { code: -1, msg: error.message || error.msg }
    }
  },

  /**
   * 获取默认收货地址
   */
  async defaultAddress(token) {
    try {
      const res = await AddressAPI.getList()
      if (res.code === 0 && res.data && res.data.length > 0) {
        // 找到默认地址
        const defaultAddr = res.data.find(addr => addr.is_default)
        if (defaultAddr) {
          return {
            code: 0,
            msg: 'success',
            data: {
              info: {
                id: defaultAddr.id,
                linkMan: defaultAddr.link_man,
                mobile: defaultAddr.mobile,
                address: defaultAddr.address,
                code: defaultAddr.code,
                provinceId: defaultAddr.province_id,
                cityId: defaultAddr.city_id,
                districtId: defaultAddr.district_id,
                streetId: defaultAddr.street_id,
                provinceName: defaultAddr.province_name,
                cityName: defaultAddr.city_name,
                districtName: defaultAddr.district_name,
                streetName: defaultAddr.street_name,
                isDefault: defaultAddr.is_default
              }
            }
          }
        }
        // 没有默认地址，返回第一个
        const firstAddr = res.data[0]
        return {
          code: 0,
          msg: 'success',
          data: {
            info: {
              id: firstAddr.id,
              linkMan: firstAddr.link_man,
              mobile: firstAddr.mobile,
              address: firstAddr.address,
              code: firstAddr.code,
              provinceId: firstAddr.province_id,
              cityId: firstAddr.city_id,
              districtId: firstAddr.district_id,
              streetId: firstAddr.street_id,
              provinceName: firstAddr.province_name,
              cityName: firstAddr.city_name,
              districtName: firstAddr.district_name,
              streetName: firstAddr.street_name,
              isDefault: firstAddr.is_default
            }
          }
        }
      }
      // 没有地址
      return { code: 700, msg: '请先添加收货地址' }
    } catch (error) {
      console.error('[适配器] defaultAddress 错误:', error)
      return { code: -1, msg: error.message || error.msg }
    }
  },

  /**
   * 创建订单
   */
  async orderCreate(postData) {
    try {
      console.log('[适配器] orderCreate 收到参数:', postData)
      
      // 解析 goodsJsonStr 为商品列表，并清洗无效规格
      let items = []
      if (postData.goodsJsonStr) {
        try {
          items = JSON.parse(postData.goodsJsonStr)
          items = items
            .map(item => {
              // 规格清洗：去掉 undefined、首尾逗号、重复逗号
              let prop = item.propertyChildIds || item.sku || ''
              if (prop) {
                prop = prop
                  .toString()
                  .replace(/undefined:undefined/g, '')
                  .replace(/^,|,$/g, '')
                  .replace(/,{2,}/g, ',')
                  .replace(/^,|,$/g, '')
              }
              return {
                goodsId: item.goodsId,
                number: item.number,
                propertyChildIds: prop || '',
                price: item.price // 保留前端传入的价格，计算预览用
              }
            })
            .filter(item => item.goodsId && item.number) // 丢弃无效行
        } catch (e) {
          console.error('[适配器] 解析 goodsJsonStr 失败:', e)
          return { code: -1, msg: '订单参数格式错误' }
        }
      }
      
      // 构造新API需要的数据格式
      const orderData = {
        items: items.map(item => ({
          goods_id: item.goodsId,
          number: item.number,
          property_child_ids: (item.propertyChildIds || '').replace(/^,|,$/g, '')
        })),
        peisong_type: postData.peisongType || 'kd',
        remark: postData.remark || ''
      }
      
      // 添加收货地址信息
      if (postData.peisongType === 'kd') {
        if (postData.linkMan) orderData.link_man = postData.linkMan
        if (postData.mobile) orderData.mobile = postData.mobile
        if (postData.address) orderData.address = postData.address
        if (postData.code) orderData.code = postData.code
        if (postData.provinceId) orderData.province_id = postData.provinceId
        if (postData.cityId) orderData.city_id = postData.cityId
        if (postData.districtId) orderData.district_id = postData.districtId
        if (postData.streetId) orderData.street_id = postData.streetId
      }
      
      // 添加优惠券
      if (postData.couponId) {
        orderData.coupon_id = postData.couponId
      }
      
      // 添加积分抵扣
      if (postData.deductionScore) {
        orderData.deduction_score = parseInt(postData.deductionScore)
      }
      
      // 如果是计算订单（预览），不实际创建
      const isCalculate = postData.calculate === 'true' || postData.calculate === true
      
      console.log('[适配器] orderCreate 请求数据:', orderData)
      console.log('[适配器] orderCreate 是否为计算模式:', isCalculate)
      
      if (isCalculate) {
        // 计算模式：返回预览数据，不实际创建订单
        // 从购物车获取商品价格信息
        let totalAmount = 0
        for (const item of items) {
          // 优先使用商品自带的价格（从购物车或立即购买传来）
          if (item.price) {
            totalAmount += parseFloat(item.price) * item.number
            console.log(`[适配器] orderCreate 计算: 商品${item.goodsId}, 价格${item.price} x ${item.number}`)
          } else {
            // 如果没有价格，尝试从缓存中获取
            const cachedGoods = goodsDetailCache[item.goodsId]
            if (cachedGoods) {
              const sku = cachedGoods.skuList.find(s => 
                s.propertyChildIds === (item.sku || item.propertyChildIds || '').replace(/,+$/g, '')
              )
              if (sku) {
                totalAmount += parseFloat(sku.price) * item.number
                console.log(`[适配器] orderCreate 计算(缓存): 商品${item.goodsId}, SKU价格${sku.price} x ${item.number}`)
              } else {
                totalAmount += parseFloat(cachedGoods.basicInfo.minPrice) * item.number
                console.log(`[适配器] orderCreate 计算(缓存): 商品${item.goodsId}, 基础价格${cachedGoods.basicInfo.minPrice} x ${item.number}`)
              }
            } else {
              console.warn(`[适配器] orderCreate 计算: 商品${item.goodsId}没有价格信息`)
            }
          }
        }
        
        console.log(`[适配器] orderCreate 计算总金额: ${totalAmount.toFixed(2)}`)
        
        return {
          code: 0,
          msg: 'success',
          data: {
            score: 0,
            amountReal: totalAmount.toFixed(2),
            amountToPayStr: totalAmount.toFixed(2),
            isNeedLogistics: postData.peisongType === 'kd' ? 1 : 0,
            logisticsList: [],
            goodsAmount: totalAmount.toFixed(2),
            goodsAndYunPrice: totalAmount.toFixed(2),
            deductionMoney: 0,
            yunPrice: 0,
            couponAmount: 0,
            couponUserList: []
          }
        }
      }
      
      // 实际创建订单
      const res = await OrderAPI.create(orderData)
      
      if (res.code === 0 && res.data) {
        // 转换响应格式
        return {
          code: 0,
          msg: 'success',
          data: {
            id: res.data.id,
            orderNumber: res.data.order_number,
            amountReal: res.data.amount_real,
            score: 0,
            dateAdd: res.data.date_add,
            status: res.data.status
          }
        }
      }
      
      return res
    } catch (error) {
      console.error('[适配器] orderCreate 错误:', error)
      return { code: -1, msg: error.message || error.msg || '创建订单失败' }
    }
  }
}

module.exports = WXAPIAdapter

