const CONFIG = require('../../config.js')
const WXAPI = CONFIG.useNewApi ? require('../../utils/wxapi-adapter') : require('apifm-wxapi')

Page({
  data: {
    page: 1,
    totalPage: 1,
    tabIndex: 0,
    statusType: [
      {
        status: 9999,
        label: '全部'
      },
      {
        status: 0,
        label: '待付款'
      },
      {
        status: 1,
        label: '待发货'
      },
      {
        status: 2,
        label: '待收货'
      },
      {
        status: 3,
        label: '待评价'
      },
    ],
    status: 9999,
    hasRefund: false,
    badges: [0, 0, 0, 0, 0]
  },
  statusTap: function(e) {
    const index = e.detail.index
    const status = this.data.statusType[index].status
    this.setData({
      page: 1,
      status
    });
    this.orderList();
  },
  cancelOrderTap: function(e) {
    const that = this;
    const orderId = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确定要取消该订单吗？',
      content: '',
      success: function(res) {
        if (res.confirm) {
          WXAPI.orderClose(wx.getStorageSync('token'), orderId).then(function(res) {
            if (res.code == 0) {
              that.data.page = 1
              that.orderList()
              that.getOrderStatistics()
            }
          })
        }
      }
    })
  },
  async refundApply (e) {
    // 申请售后 todo 判断是去申请页面还是去查看页面
    const orderId = e.currentTarget.dataset.id;
    const amount = e.currentTarget.dataset.amount;
    wx.navigateTo({
      url: "/pages/order/refundApply?id=" + orderId
    })
  },
  toPayTap: function(e) {
    // 防止连续点击--开始
    if (this.data.payButtonClicked) {
      wx.showToast({
        title: '休息一下~',
        icon: 'none'
      })
      return
    }
    this.data.payButtonClicked = true
    setTimeout(() => {
      this.data.payButtonClicked = false
    }, 3000)  // 可自行修改时间间隔（目前是3秒内只能点击一次支付按钮）
    // 防止连续点击--结束
    const that = this;
    const orderId = e.currentTarget.dataset.id;
    const orderNumber = e.currentTarget.dataset.orderNumber;
    let money = e.currentTarget.dataset.money;
    const needScore = e.currentTarget.dataset.score;
    WXAPI.userAmount(wx.getStorageSync('token')).then(function(res) {
      if (res.code == 0) {
        const order_pay_user_balance = wx.getStorageSync('order_pay_user_balance')
        if (order_pay_user_balance != '1') {
          res.data.balance = 0
        }
        // 增加提示框
        if (res.data.score < needScore) {
          wx.showToast({
            title: '您的积分不足，无法支付',
            icon: 'none'
          })
          return;
        }
        let _msg = '订单金额: ' + money +' 元'
        if (res.data.balance > 0) {
          _msg += ',可用余额为 ' + res.data.balance +' 元'
          if (money - res.data.balance > 0) {
            _msg += ',仍需微信支付 ' + (money - res.data.balance).toFixed(2) + ' 元'
          }          
        }
        if (needScore > 0) {
          _msg += ',并扣除 ' + needScore + ' 积分'
        }
        money = money - res.data.balance
        wx.showModal({
          title: '请确认支付',
          content: _msg,
          confirmText: "确认支付",
          cancelText: "取消支付",
          success: function (res) {
            console.log(res);
            if (res.confirm) {
              that._toPayTap(orderId, orderNumber, money)
            } else {
              console.log('用户点击取消支付')
            }
          }
        });
      } else {
        wx.showModal({
          title: '错误',
          content: '无法获取用户资金信息',
          showCancel: false
        })
      }
    })
  },
  async wxSphGetpaymentparams(e) {
    const orderNumber = e.currentTarget.dataset.orderNumber
    const res = await WXAPI.orderPay(wx.getStorageSync('token'), orderNumber, { pay_type: 'wxpay' })
    if (res.code != 0 || !res.data) {
      wx.showToast({
        title: res.msg || '获取支付参数失败',
        icon: 'none'
      })
      return;
    }
    const payParams = res.data.wxpay_params || res.data
    // 发起支付
    wx.requestPayment({
      timeStamp: payParams.timeStamp,
      nonceStr: payParams.nonceStr,
      package: payParams.package,
      signType: payParams.signType || payParams.sign_type || 'RSA',
      paySign: payParams.paySign || payParams.pay_sign,
      fail: err => {
        console.error(err)
        wx.showToast({
          title: '支付失败:' + (err.errMsg || ''),
          icon: 'none'
        })
      },
      success: () => {
        wx.showToast({
          title: '支付成功'
        })
        this.orderList()
      }
    })
  },
  _toPayTap: function (orderId, orderNumber, money){
    const _this = this
    if (money <= 0) {
      // 直接使用余额支付
      WXAPI.orderPay(wx.getStorageSync('token'), orderNumber).then(function (res) {
        _this.data.page = 1
        _this.orderList()
        _this.getOrderStatistics()
      })
    } else {
      this.setData({
        orderId,
        orderNumber,
        money,
        paymentShow: true,
        nextAction: {
          type: 0,
          id: orderId,
          orderNumber
        }
      })
    }
  },
  onLoad: function(options) {
    if (options && options.type) {
      if (options.type == 99) {
        this.setData({
          hasRefund: true
        });
      } else {
        const tabIndex = this.data.statusType.findIndex(ele => {
          return ele.status == options.type
        })
        this.setData({
          status: options.type,
          tabIndex
        });
      }      
    }
    this.getOrderStatistics();
    this.orderList();
    this.setData({
      sphpay_open: wx.getStorageSync('sphpay_open')
    })
  },
  onReady: function() {
    // 生命周期函数--监听页面初次渲染完成

  },
  getOrderStatistics() {
    WXAPI.orderStatistics(wx.getStorageSync('token')).then(res => {
      if (res.code == 0) {
        const badges = this.data.badges;
        badges[1] = res.data.count_id_no_pay
        badges[2] = res.data.count_id_no_transfer
        badges[3] = res.data.count_id_no_confirm
        badges[4] = res.data.count_id_no_reputation
        this.setData({
          badges
        })
      }
    })
  },
  onShow: function() {
  },
  onPullDownRefresh: function () {
    this.data.page = 1
    this.getOrderStatistics()
    this.orderList()
    wx.stopPullDownRefresh()
  },
  onReachBottom() {
    if (this.data.page >= this.data.totalPage) {
      wx.showToast({
        title: '没有更多了',
        icon: 'none'
      })
      return
    }
    this.setData({
      page: this.data.page + 1
    });
    this.orderList()
  },
  async orderList(){
    wx.showLoading({
      title: '',
    })
    var postData = {
      page: this.data.page,
      pageSize: 20,
      token: wx.getStorageSync('token')
    };
    if (this.data.hasRefund) {
      postData.hasRefund = true
    }
    if (!postData.hasRefund) {
      postData.status = this.data.status;
    }
    if (postData.status == 9999) {
      postData.status = ''
    }
    console.log('[订单列表] 请求参数:', postData)
    const res = await WXAPI.orderList(postData)
    wx.hideLoading()
    console.log('[订单列表] 返回数据:', res)
    if (res.code == 0) {
      const totalPage = res.data.totalPage || res.data.total_page || 1
      if (this.data.page == 1) {
        this.setData({
          orderList: res.data.orderList,
          logisticsMap: res.data.logisticsMap,
          goodsMap: res.data.goodsMap,
          totalPage
        })
      } else {
        this.setData({
          orderList: this.data.orderList.concat(res.data.orderList),
          logisticsMap: Object.assign(this.data.logisticsMap, res.data.logisticsMap),
          goodsMap: Object.assign(this.data.goodsMap, res.data.goodsMap),
          totalPage
        })
      }
    } else {
      if (this.data.page == 1) {
        this.setData({
          orderList: null,
          logisticsMap: {},
          goodsMap: {}
        })
      } else {
        wx.showToast({
          title: '没有更多了',
          icon: 'none'
        })
      }
    }
  },
  paymentOk(e) {
    console.log(e.detail); // 这里是组件里data的数据
    this.setData({
      paymentShow: false
    })
    wx.redirectTo({
      url: '/pages/order-list/index',
    })
  },
  paymentCancel() {
    this.setData({
      paymentShow: false
    })
  },
  goOrderDetail(e) {
    const item = e.currentTarget.dataset.item
    wx.navigateTo({
      url: '/pages/order-details/index?id=' + item.id,
    })
  },
})