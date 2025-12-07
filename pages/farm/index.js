// pages/farm/index.js
const CONFIG = require('../../config')
const WXAPI = CONFIG.useNewApi ? require('../../utils/wxapi-adapter') : require('apifm-wxapi')
const AUTH = require('../../utils/auth')

Page({
  data: {
    banners: [], // 农庄轮播图
    videos: [], // 监控视频（可选，本期按设备列表+直播为主）
    devices: [], // 监控设备列表
    selectedDevice: null, // 当前选中的设备
    panoramaUrl: '', // 全景图地址
    farmIntro: '', // 农庄简介
    farmName: '连氏生态农庄',
    farmAddress: '湖北省监利市平强家庭农场',
    latitude: 29.641055,
    longitude: 112.963159,
    liveConfig: null, // 直播配置
    liveLoading: false,
    farmNews: [], // 农庄动态
    environmentData: {
      temperature: '--',
      humidity: '--',
      updateTime: ''
    },
    activeTab: 0, // 当前激活的tab
    showPanorama: false // 是否显示全景
  },

  onLoad: function (options) {
    this.getBanners()
    this.getFarmInfo()
    this.getDevices()
    this.getFarmNews()
  },

  onShow: function () {
    AUTH.checkHasLogined().then(isLogined => {
      if (isLogined) {
        this.getEnvironmentData()
      }
    })
  },

  // 获取轮播图
  async getBanners() {
    const res = await WXAPI.banners({
      type: 'farm'
    })
    if (res.code == 0) {
      this.setData({
        banners: res.data
      })
    }
  },

  // 获取农庄信息
  async getFarmInfo() {
    // 这里调用后台接口获取农庄简介
    // 暂时使用模拟数据
    this.setData({
      farmIntro: '我们的农庄位于山清水秀的生态环境中，占地500亩，主打天然无抗养殖。跑山鸡在开阔的山林中自由奔跑，以虫草、玉米为食，生长周期180天以上，肉质鲜美营养丰富。',
      panoramaUrl: '/images/farm-panorama.jpg', // 全景图地址
      // 如后端提供经纬度，请在此覆盖
      // latitude: res.data.latitude,
      // longitude: res.data.longitude,
      // farmName: res.data.name,
      // farmAddress: res.data.address,
    })
  },

  // 按需加载直播流（避免前端存储 accessToken）
  async loadLiveStream(e) {
    if (this.data.liveLoading) return
    const dataset = e && e.currentTarget ? e.currentTarget.dataset : {}
    const deviceSerial = dataset.serial || (this.data.selectedDevice && this.data.selectedDevice.device_serial)
    const channelNo = dataset.channel || (this.data.selectedDevice && this.data.selectedDevice.channel_no) || 1
    if (!deviceSerial) {
      wx.showToast({ title: '未选择设备', icon: 'none' })
      return
    }

    this.setData({ liveLoading: true })
    try {
      // 调用后端 play-config，获取 accessToken + url 等播放参数
      const res = await WXAPI.farmPlayConfig({
        device_serial: deviceSerial,
        channel_no: channelNo
      })
      console.log('[农庄] live-stream 返回:', res)
      if (res.code === 0 && res.data && (res.data.accessToken || res.data.access_token) && res.data.url) {
        this.setData({
          selectedDevice: this.data.devices.find(d => d.device_serial === deviceSerial && d.channel_no === channelNo) || this.data.selectedDevice,
          liveConfig: {
            accessToken: res.data.accessToken || res.data.access_token,
            url: res.data.url,
            plugins: res.data.plugins || 'voice,ptz',
            ratio: res.data.ratio || '16:9',
            width: res.data.width || '100%',
            height: res.data.height || '240px',
            theme: res.data.theme || { showCapture: true, showBottomBar: true, showDatePicker: true, showTypeSwitch: true },
            recPlayTime: res.data.recPlayTime || ''
          }
        })
      } else {
        wx.showToast({
          title: res.msg || '获取播放参数失败',
          icon: 'none'
        })
      }
    } catch (error) {
      console.error('[农庄] 获取直播参数异常:', error)
      wx.showToast({
        title: '获取直播参数失败',
        icon: 'none'
      })
    } finally {
      this.setData({ liveLoading: false })
    }
  },

  handleLiveError(e) {
    console.error('[农庄] 直播错误:', e.detail || e)
    wx.showToast({
      title: (e.detail && e.detail.msg) ? e.detail.msg : '直播播放出错',
      icon: 'none'
    })
  },

  handleLiveControl(e) {
    console.log('[农庄] 直播控制事件:', e.detail)
  },

  // 查看农庄位置 / 导航
  openFarmLocation() {
    const latitude = Number(this.data.latitude)
    const longitude = Number(this.data.longitude)
    if (!latitude || !longitude) {
      wx.showToast({
        title: '暂无位置信息',
        icon: 'none'
      })
      return
    }
    wx.openLocation({
      latitude,
      longitude,
      name: this.data.farmName || '农庄位置',
      address: this.data.farmAddress || '',
      scale: 16
    })
  },

  // 获取设备列表
  async getDevices() {
    try {
      const res = await WXAPI.farmDevices()
      console.log('[农庄] devices 返回:', res)
      if (res.code === 0 && Array.isArray(res.data)) {
        this.setData({ devices: res.data })
        // 默认选择第一个设备但不自动拉流，等待用户点击以节省流量
        if (res.data.length > 0) {
          this.setData({ selectedDevice: res.data[0] })
        }
      } else {
        wx.showToast({
          title: res.msg || '获取设备失败',
          icon: 'none'
        })
      }
    } catch (e) {
      console.error('[农庄] 获取设备异常:', e)
      wx.showToast({
        title: '获取设备失败',
        icon: 'none'
      })
    }
  },

  // 获取环境数据
  async getEnvironmentData() {
    // 调用后台接口获取实时环境数据
    const now = new Date()
    this.setData({
      environmentData: {
        temperature: '25℃',
        humidity: '65%',
        updateTime: `${now.getHours()}:${now.getMinutes()}`
      }
    })
  },

  // 获取农庄动态
  async getFarmNews() {
    // 调用后台接口获取农庄动态
    this.setData({
      farmNews: [
        {
          id: 1,
          title: '新一批跑山鸡已出栏',
          date: '2025-12-01',
          image: '/images/news-1.jpg'
        },
        {
          id: 2,
          title: '冬季水产品供应充足',
          date: '2025-11-28',
          image: '/images/news-2.jpg'
        }
      ]
    })
  },

  // Tab切换
  onTabChange(e) {
    this.setData({
      activeTab: e.detail.index
    })
  },

  // 显示全景
  showPanorama() {
    this.setData({
      showPanorama: true
    })
  },

  // 隐藏全景
  hidePanorama() {
    this.setData({
      showPanorama: false
    })
  },

  // 播放监控视频
  playVideo(e) {
    const id = e.currentTarget.dataset.id
    wx.showToast({
      title: '监控视频播放功能需要接入实时视频流',
      icon: 'none'
    })
  },

  // 查看新闻详情
  goNewsDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/cms/detail?id=${id}`
    })
  },

  // 扫码溯源
  scanTrace() {
    wx.scanCode({
      success: (res) => {
        wx.showToast({
          title: '溯源功能开发中',
          icon: 'none'
        })
      }
    })
  },

  onShareAppMessage: function () {
    return {
      title: '生态农庄 - 天然无抗 健康养殖',
      path: '/pages/farm/index'
    }
  }
})


