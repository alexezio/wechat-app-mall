// pages/farm/index.js
const WXAPI = require('apifm-wxapi')
const AUTH = require('../../utils/auth')

Page({
  data: {
    banners: [], // 农庄轮播图
    videos: [], // 监控视频
    panoramaUrl: '', // 全景图地址
    farmIntro: '', // 农庄简介
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
    this.getMonitorVideos()
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
      panoramaUrl: '/images/farm-panorama.jpg' // 全景图地址
    })
  },

  // 获取监控视频
  async getMonitorVideos() {
    // 调用后台接口获取监控视频流
    // 暂时使用模拟数据
    this.setData({
      videos: [
        {
          id: 1,
          name: '养殖区监控',
          url: '',
          cover: '/images/monitor-1.jpg'
        },
        {
          id: 2,
          name: '散养区监控',
          url: '',
          cover: '/images/monitor-2.jpg'
        },
        {
          id: 3,
          name: '水产区监控',
          url: '',
          cover: '/images/monitor-3.jpg'
        }
      ]
    })
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


