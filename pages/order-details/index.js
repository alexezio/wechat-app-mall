const CONFIG = require('../../config.js')
const WXAPI = CONFIG.useNewApi ? require('../../utils/wxapi-adapter') : require('apifm-wxapi')

function getToken() {
  return CONFIG.useNewApi ? wx.getStorageSync('jwt_token') : wx.getStorageSync('token')
}

Page({
    data:{
      orderId:0,
      orderSn:'',
      goodsList:[]
    },
    onLoad:function(e){
      // e.id = e.sfsdffd
      // e.payOrderNo = 'ZF2408290780106421'
      this.setData({
        orderId: e.id,
        orderSn: e.order_number || e.orderSn || e.id || '',
        payOrderNo: e.payOrderNo,
      })
      if (e.payOrderNo) {
        this.payLogs()
      }
    },
    onShow() {
      this.orderDetail()
    },
    async payLogs() {
      wx.showLoading({
        title: '',
      })
      const res = await WXAPI.payLogs({
        token: wx.getStorageSync('token'),
        orderNo: this.data.payOrderNo
      })
      wx.hideLoading()
      if (res.code != 0) {
        wx.showModal({
          content: res.msg,
          showCancel: false
        })
        return
      }
      const nextAction = res.data[0].nextAction
      if(!nextAction) {
        wx.navigateTo({
          url: '/subpackages/more/asset/index',
        })
        return
      }
      const _nextAction = JSON.parse(nextAction)
      if (_nextAction.type != 0) {
        wx.navigateTo({
          url: '/subpackages/more/asset/index',
        })
        return
      }
      this.setData({
        orderId: _nextAction.id,
      })
      this.orderDetail()
    },
    async orderDetail() {
      if (!this.data.orderId) {
        return
      }
      wx.showLoading({
        title: '',
      })
      let res
      if (CONFIG.useNewApi) {
        res = await WXAPI.orderDetail(this.data.orderSn || this.data.orderId)
      } else {
        res = await WXAPI.orderDetail(getToken(), this.data.orderId)
      }
      wx.hideLoading()
      if (res.code != 0) {
        wx.showModal({
          content: res.msg,
          showCancel: false
        })
        return
      }
      // 适配新接口结构
      let detail = res.data
      if (CONFIG.useNewApi && res.data) {
        const d = res.data
        const oi = d.order_info || {}
        const orderInfo = {
          id: oi.id,
          orderNumber: oi.order_number,
          status: oi.status,
          statusStr: oi.status_str || '',
          amountReal: oi.amount_real,
          amountGoods: oi.amount_goods,
          amountLogistics: oi.freight,
          amountGoods: oi.amount_goods,
          freight: oi.freight,
          couponAmount: oi.coupon_amount,
          deductionMoney: oi.deduction_money,
          score: oi.score || 0,
          remark: oi.remark || '',
          peisongType: oi.peisong_type,
          dateAdd: oi.date_add,
          datePay: oi.date_pay,
          dateSend: oi.date_send,
          dateConfirm: oi.date_confirm,
          hxNumber: oi.hx_number,
          linkMan: oi.link_man,
          mobile: oi.mobile,
          address: oi.address,
          provinceName: oi.province_name,
          cityName: oi.city_name,
          districtName: oi.district_name,
          streetName: oi.street_name,
          logisticsCompany: oi.logistics_company,
          logisticsNumber: oi.logistics_number
        }
        const goods = (d.goods || []).map(g => ({
          id: g.id,
          goods_id: g.goods_id,
          goodsId: g.goods_id,
          goods_name: g.goods_name,
          goodsName: g.goods_name,
          pic: g.pic,
          property: g.property,
          price: g.price,
          number: g.number,
          amount: g.amount,
          after_sale_status: g.after_sale_status,
          can_refund: g.can_refund
        }))
        const logistics = (oi.link_man || oi.address || oi.logistics_number) ? {
          trackingNumber: oi.logistics_number,
          linkMan: oi.link_man,
          mobile: oi.mobile,
          provinceStr: oi.province_name,
          cityStr: oi.city_name,
          areaStr: oi.district_name || oi.street_name,
          address: oi.address
        } : null
        const logs = (d.logs || []).map(log => ({
          typeStr: log.msg || log.type,
          dateAdd: log.date
        }))
        detail = {
          orderInfo,
          goods,
          logs,
          orderLogisticsShippers: [],
          logistics,
          logisticsTraces: null,
          extJson: d.ext_json || {}
        }
        // 同步内部使用的 orderId
        this.setData({
          orderId: oi.id,
          orderSn: oi.order_number
        })
      }

      // 绘制核销码
      if (detail.orderInfo && detail.orderInfo.hxNumber && detail.orderInfo.status > 0 && detail.orderInfo.status < 3) {
        this.wxaQrcode(detail.orderInfo.hxNumber)
      }
      // 子快递单信息
      if (detail.orderLogisticsShippers) {
        detail.orderLogisticsShippers.forEach(ele => {
          if (ele.traces) {
            ele.tracesArray = JSON.parse (ele.traces)
            if (ele.tracesArray && ele.tracesArray.length > 0) {
              ele.tracesLast = ele.tracesArray[ele.tracesArray.length - 1].AcceptStation + '\n' + ele.tracesArray[ele.tracesArray.length - 1].AcceptTime
            }
          }
        })
      }
      let iotControl = false
      ;(detail.goods || []).forEach(ele => {
        if (ele.iotControl) {
          iotControl = true
        }
      })
      if (iotControl) {
        // 读取IoT设备列表
        this._shopIotDevices()
      }
      let orderStores = null
      if (detail.orderStores) {
        orderStores = detail.orderStores.filter(ele => ele.type == 2)
      }
      if (!detail.extJson || Object.keys(detail.extJson).length == 0) {
        delete detail.extJson
      }
      if (!detail.logs || detail.logs.length === 0) {
        delete detail.logs
      }
      if (!detail.orderLogisticsShippers || detail.orderLogisticsShippers.length === 0) {
        delete detail.orderLogisticsShippers
      }
      this.setData({
        orderDetail: detail,
        orderStores
      })
    },
    wuliuDetailsTap:function(e){
      var orderId = e.currentTarget.dataset.id;
      wx.navigateTo({
        url: "/subpackages/more/wuliu/index?id=" + orderId
      })
    },
    confirmBtnTap:function(e){
      let that = this;
      let orderId = this.data.orderId;
      wx.showModal({
          title: '确认您已收到商品？',
          content: '',
          success: function(res) {
            if (res.confirm) {
              WXAPI.orderDelivery(wx.getStorageSync('token'), orderId).then(function (res) {
                if (res.code == 0) {
                  that.orderDetail()
                }
              })
            }
          }
      })
    },
    async submitReputation(e) {
      let that = this;
      let postJsonString = {};
      postJsonString.token = wx.getStorageSync('token');
      postJsonString.orderId = this.data.orderId;
      let reputations = [];
      let i = 0;
      while (e.detail.value["orderGoodsId" + i]) {
        let orderGoodsId = e.detail.value["orderGoodsId" + i];
        let goodReputation = e.detail.value["goodReputation" + i];
        const goodReputationNumber = goodReputation
        let goodReputationRemark = e.detail.value["goodReputationRemark" + i];

        if (!goodReputation) {
          goodReputation = 0
        } else if(goodReputation <= 1) {
          goodReputation = 0
        } else if(goodReputation <= 4) {
          goodReputation = 1
        } else {
          goodReputation = 2
        }

        let reputations_json = {};
        reputations_json.id = orderGoodsId;
        reputations_json.reputation = goodReputation;
        reputations_json.reputationNumber = goodReputationNumber
        reputations_json.remark = goodReputationRemark;
        if (this.data.picsList && this.data.picsList[i] && this.data.picsList[i].length > 0) {
          reputations_json.pics = []
          for (let index = 0; index < this.data.picsList[i].length; index++) {
            const pic = this.data.picsList[i][index];
            const res = await WXAPI.uploadFileV2(wx.getStorageSync('token'), pic.url)
            if (res.code == 0) {
              reputations_json.pics.push(res.data.url)
            }
          }
        }
        reputations.push(reputations_json);
        i++;
      }
      postJsonString.reputations = reputations;
      WXAPI.orderReputation({
        postJsonString: JSON.stringify(postJsonString)
      }).then(function (res) {
        if (res.code == 0) {
          that.orderDetail()
        }
      })
    },
    afterPicRead(e) {
      const idx = e.currentTarget.dataset.idx
      let picsList = this.data.picsList
      if (!picsList) {
        picsList = []
        for (let index = 0; index < this.data.orderDetail.goods.length; index++) {
          picsList[index] = []
        }
      }
      picsList[idx] = picsList[idx].concat(e.detail.file)
      this.setData({
        picsList
      })
    },
    afterPicDel(e) {
      const idx = e.currentTarget.dataset.idx
      let picsList = this.data.picsList
      picsList[idx].splice(e.detail.index, 1)
      this.setData({
        picsList
      })
    },
    async wxaQrcode(hxNumber) {
      // https://www.yuque.com/apifm/nu0f75/ak40es
      const accountInfo = wx.getAccountInfoSync()
      const envVersion = accountInfo.miniProgram.envVersion
      const res = await WXAPI.wxaQrcode({
        scene: hxNumber,
        page: 'pages/order-details/scan-result',
        autoColor: true,
        expireHours: 1,
        env_version: envVersion,
        check_path: envVersion == 'release' ? true : false,
      })
      if (res.code != 0) {
        wx.showModal({
          content: res.msg,
          showCancel: false
        })
        return
      }
      this.setData({
        hxNumberQrcode: res.data
      })
    },
    async _shopIotDevices() {
      // https://www.yuque.com/apifm/nu0f75/ibg4icu15di25hfc
      const res = await WXAPI.shopIotDevices({
        token: wx.getStorageSync('token'),
        orderId: this.data.orderId
      })
      if (res.code == 0) {
        this.setData({
          shopIotDevices: res.data
        })
      }
    },
    async shopIotCmds(e) {
      const idx = e.target.dataset.idx
      const item = this.data.shopIotDevices[idx]
      // https://www.yuque.com/apifm/nu0f75/rek5dwng8b9cdoko
      const res = await WXAPI.shopIotCmds({
        token: wx.getStorageSync('token'),
        orderId: this.data.orderId,
        topic: item.topic
      })
      if (res.code != 0) {
        wx.showModal({
          content: res.msg
        })
        return
      }
      this.setData({
        cmdList: res.data,
        cmdListShow: true
      })
    },
    cmdClose() {
      this.setData({ cmdListShow: false });
    },
  
    async cmdSelect(event) {
      // https://www.yuque.com/apifm/nu0f75/uq495hlq3ho5kw4t
      console.log(event.detail);
      const res = await WXAPI.shopIotExecute({
        token: wx.getStorageSync('token'),
        orderId: this.data.orderId,
        topic: event.detail.topic,
        cmdId: event.detail.id,
      })
      if (res.code != 0) {
        wx.showModal({
          content: res.msg
        })
      } else {
        wx.showToast({
          title: '已发送',
        })
      }
    },
})