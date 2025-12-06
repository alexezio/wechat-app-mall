const CONFIG = require('../../config.js')
const WXAPI = CONFIG.useNewApi ? require('../../utils/wxapi-adapter') : require('apifm-wxapi')
const { wxaCode } = require('../../utils/auth');
Component({
  options: {
    addGlobalClass: true,
  },
  /**
   * 组件的对外属性，是属性名到属性设置的映射表
   */
  properties: {
    money: Number,
    remark: String,
    nextAction: Object,
    extData: Object,
    show: Boolean,
  },

  /**
   * 组件的内部数据，和 properties 一同用于组件的模板渲染
   */
  data: {
    payType: 'wx',
    alipayOpenMod: '0'
  },
  // 组件数据字段监听器，用于监听 properties 和 data 的变化
  observers: {
    'show': function(show) {
      this.setData({
        alipayQrcode: null,
        alipayOpenMod: wx.getStorageSync('alipay')
      })
    }
  },
  lifetimes: {
    attached() {
      
    },
    detached() {
      // 在组件实例被从页面节点树移除时执行
    },
  },
  /**
   * 组件的方法列表
   */
  methods: {
    close() {
      this.triggerEvent('cancel')
    },
    payTypeChange(event) {
      this.setData({
        payType: event.detail,
        alipayQrcode: null,
      });
    },
    payTypeClick(event) {
      const { name } = event.currentTarget.dataset;
      this.setData({
        payType: name,
        alipayQrcode: null,
      });
    },
    async submit() {
      const orderNumber = this.data.nextAction && (this.data.nextAction.orderNumber || this.data.nextAction.id)
      if (!orderNumber) {
        wx.showModal({
          content: '缺少订单号，无法发起支付',
          showCancel: false
        })
        this.close()
        return
      }
      if (this.data.payType !== 'wx') {
        wx.showModal({
          content: '暂不支持该支付方式',
          showCancel: false
        })
        this.close()
        return
      }

      // 调用新后端支付接口
      const res = await WXAPI.orderPay(wx.getStorageSync('token'), orderNumber, { pay_type: 'wxpay' })
      if (res.code != 0 || !res.data) {
        wx.showModal({
          content: res.msg || '获取支付参数失败',
          showCancel: false
        })
        this.close()
        return
      }

      const payParams = res.data.wxpay_params || res.data
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
          this.triggerEvent('ok', this.data)
        }
      })
    },
  }
})