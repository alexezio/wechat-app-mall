// pages/farm/index.js
const WXAPI = require('apifm-wxapi')
const AUTH = require('../../utils/auth')

Page({
  data: {
    banners: [], // 农庄轮播图
    farmInfo: null, // 农庄信息
    videos: [], // 监控视频
    environmentData: {
      temperature: '--',
      humidity: '--',
      updateTime: ''
    },
    features: [], // 养殖特色
    diary: null, // 养殖日记
    qualityReports: [], // 质量报告
    certifications: [], // 认证资质
    farmNews: [], // 农庄动态
    activeTab: 0, // 当前激活的tab
    showPanorama: false, // 是否显示全景
    newsPage: 1,
    newsPageSize: 10,
    hasMoreNews: true,
    loadingNews: false
  },

  onLoad: function (options) {
    this.getBanners()
    this.getFarmInfo()
    this.getFeatures()
  },

  onShow: function () {
    // 根据当前tab加载对应数据
    this.loadTabData(this.data.activeTab)
  },

  // Tab切换
  onTabChange(e) {
    const index = e.detail.index
    this.setData({
      activeTab: index
    })
    this.loadTabData(index)
  },

  // 根据tab索引加载数据
  loadTabData(index) {
    switch(index) {
      case 0: // 全景展示
        // 全景展示数据已在onLoad加载
        break
      case 1: // 实时监控
        this.getMonitorVideos()
        AUTH.checkHasLogined().then(isLogined => {
          if (isLogined) {
            this.getEnvironmentData()
            this.getDiary()
          }
        })
        break
      case 2: // 质量溯源
        this.getQualityReports()
        this.getCertifications()
        break
      case 3: // 农庄动态
        if (this.data.farmNews.length === 0) {
          this.getFarmNews()
        }
        break
    }
  },

  // ========== 获取农庄轮播图 ==========
  async getBanners() {
    try {
      const res = await WXAPI.banners({ type: 'farm' })
      if (res.code == 0) {
        this.setData({ banners: res.data })
      }
    } catch (error) {
      console.error('获取轮播图失败:', error)
    }
  },

  // ========== 获取农庄信息 ==========
  async getFarmInfo() {
    try {
      // 调用后端接口
      const res = await WXAPI.request('/farm/info', true, 'get', {})
      if (res.code == 0) {
        this.setData({
          farmInfo: res.data
        })
      }
    } catch (error) {
      console.error('获取农庄信息失败:', error)
      // 使用模拟数据作为降级方案
      this.setData({
        farmInfo: {
          name: '生态农庄',
          intro: '我们的农庄位于山清水秀的生态环境中，占地500亩，主打天然无抗养殖。跑山鸡在开阔的山林中自由奔跑，以虫草、玉米为食，生长周期180天以上，肉质鲜美营养丰富。',
          panoramaUrl: '/images/farm-panorama.jpg',
          address: '广东省清远市某生态园区',
          area: '500亩',
          phone: '400-123-4567',
          openTime: '周一至周日 9:00-18:00'
        }
      })
    }
  },

  // ========== 获取养殖特色 ==========
  async getFeatures() {
    try {
      const res = await WXAPI.request('/farm/features', true, 'get', {})
      if (res.code == 0) {
        this.setData({ features: res.data })
      }
    } catch (error) {
      console.error('获取养殖特色失败:', error)
      // 使用模拟数据
      this.setData({
        features: [
          { icon: '🏔️', name: '山林散养', description: '500亩生态山林' },
          { icon: '🌾', name: '天然饲料', description: '虫草玉米喂养' },
          { icon: '💊', name: '无抗养殖', description: '零抗生素添加' },
          { icon: '⏱️', name: '足龄出栏', description: '180天以上' }
        ]
      })
    }
  },

  // ========== 获取监控视频 ==========
  async getMonitorVideos() {
    try {
      const res = await WXAPI.request('/farm/monitors', true, 'get', {})
      if (res.code == 0) {
        this.setData({ videos: res.data })
      }
    } catch (error) {
      console.error('获取监控视频失败:', error)
      // 使用模拟数据
      this.setData({
        videos: [
          {
            id: 1,
            name: '养殖区监控',
            url: '',
            cover: '/images/monitor-1.jpg',
            isLive: true,
            position: 'A区养殖场'
          },
          {
            id: 2,
            name: '散养区监控',
            url: '',
            cover: '/images/monitor-2.jpg',
            isLive: true,
            position: 'B区山林'
          },
          {
            id: 3,
            name: '水产区监控',
            url: '',
            cover: '/images/monitor-3.jpg',
            isLive: true,
            position: 'C区水塘'
          }
        ]
      })
    }
  },

  // ========== 获取环境数据 ==========
  async getEnvironmentData() {
    try {
      const res = await WXAPI.request('/farm/environment', true, 'get', {})
      if (res.code == 0) {
        this.setData({
          environmentData: {
            temperature: res.data.temperature + '℃',
            humidity: res.data.humidity + '%',
            pm25: res.data.pm25,
            updateTime: this.formatTime(res.data.updateTime)
          }
        })
      }
    } catch (error) {
      console.error('获取环境数据失败:', error)
      // 使用模拟数据
      const now = new Date()
      this.setData({
        environmentData: {
          temperature: '25℃',
          humidity: '65%',
          pm25: 15,
          updateTime: `${this.padZero(now.getHours())}:${this.padZero(now.getMinutes())}`
        }
      })
    }
  },

  // ========== 获取养殖日记 ==========
  async getDiary() {
    try {
      const res = await WXAPI.request('/farm/diary', true, 'get', {})
      if (res.code == 0) {
        this.setData({ diary: res.data })
      }
    } catch (error) {
      console.error('获取养殖日记失败:', error)
      // 使用模拟数据
      this.setData({
        diary: {
          batchNo: '2024120301',
          startDate: '2024-06-01',
          currentStage: '散养阶段',
          timeline: [
            {
              stage: '鸡苗入场',
              date: '2024-06-01',
              description: '选用优质鸡苗，确保基因健康',
              status: 'completed'
            },
            {
              stage: '散养阶段',
              date: '2024-07-01',
              description: '山林自由觅食，增强体质',
              status: 'in_progress'
            },
            {
              stage: '健康检测',
              date: '2024-09-15',
              description: '定期兽医检查，确保健康',
              status: 'pending'
            },
            {
              stage: '足龄出栏',
              date: '2024-11-28',
              description: '180天以上，肉质鲜美',
              status: 'pending'
            }
          ]
        }
      })
    }
  },

  // ========== 获取质量报告 ==========
  async getQualityReports() {
    try {
      const res = await WXAPI.request('/farm/quality-reports', true, 'get', {})
      if (res.code == 0) {
        this.setData({ qualityReports: res.data })
      }
    } catch (error) {
      console.error('获取质量报告失败:', error)
      // 使用模拟数据
      this.setData({
        qualityReports: [
          { reportName: '兽药残留检测', status: 'pass' },
          { reportName: '重金属检测', status: 'pass' },
          { reportName: '微生物检测', status: 'pass' },
          { reportName: '营养成分检测', status: 'pass' }
        ]
      })
    }
  },

  // ========== 获取认证资质 ==========
  async getCertifications() {
    try {
      const res = await WXAPI.request('/farm/certifications', true, 'get', {})
      if (res.code == 0) {
        this.setData({ certifications: res.data })
      }
    } catch (error) {
      console.error('获取认证资质失败:', error)
      // 使用模拟数据
      this.setData({
        certifications: [
          { certName: '有机认证', certImage: '/images/cert-1.png' },
          { certName: '无公害认证', certImage: '/images/cert-2.png' },
          { certName: 'ISO认证', certImage: '/images/cert-3.png' }
        ]
      })
    }
  },

  // ========== 获取农庄动态 ==========
  async getFarmNews(loadMore = false) {
    if (this.data.loadingNews) return
    
    this.setData({ loadingNews: true })

    try {
      const page = loadMore ? this.data.newsPage + 1 : 1
      const res = await WXAPI.request('/farm/news', true, 'get', {
        page: page,
        pageSize: this.data.newsPageSize
      })
      
      if (res.code == 0) {
        const newsList = loadMore ? 
          [...this.data.farmNews, ...res.data.list] : 
          res.data.list
        
        this.setData({
          farmNews: newsList,
          newsPage: page,
          hasMoreNews: res.data.list.length >= this.data.newsPageSize,
          loadingNews: false
        })
      }
    } catch (error) {
      console.error('获取农庄动态失败:', error)
      // 使用模拟数据
      if (!loadMore) {
        this.setData({
          farmNews: [
            {
              id: 1,
              title: '新一批跑山鸡已出栏',
              image: '/images/news-1.jpg',
              publishDate: '2025-12-01',
              views: 1580,
              category: '产品动态'
            },
            {
              id: 2,
              title: '冬季水产品供应充足',
              image: '/images/news-2.jpg',
              publishDate: '2025-11-28',
              views: 1230,
              category: '养殖动态'
            }
          ],
          loadingNews: false
        })
      }
    }
  },

  // ========== 显示全景 ==========
  showPanorama() {
    if (!this.data.farmInfo || !this.data.farmInfo.panoramaUrl) {
      wx.showToast({
        title: '全景图片加载中',
        icon: 'none'
      })
      return
    }
    this.setData({ showPanorama: true })
  },

  // ========== 隐藏全景 ==========
  hidePanorama() {
    this.setData({ showPanorama: false })
  },

  // ========== 播放监控视频 ==========
  playVideo(e) {
    const id = e.currentTarget.dataset.id
    const video = this.data.videos.find(v => v.id === id)
    
    if (!video || !video.url) {
      wx.showToast({
        title: '视频流暂未配置',
        icon: 'none'
      })
      return
    }

    // 跳转到视频播放页面
    wx.navigateTo({
      url: `/pages/farm/video-player?url=${encodeURIComponent(video.url)}&name=${video.name}`
    })
  },

  // ========== 查看新闻详情 ==========
  goNewsDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/farm/news-detail?id=${id}`
    })
  },

  // ========== 查看质量报告 ==========
  viewReport(e) {
    const url = e.currentTarget.dataset.url
    if (!url) {
      wx.showToast({
        title: '报告文件暂未上传',
        icon: 'none'
      })
      return
    }
    
    // 下载并打开PDF
    wx.showLoading({ title: '加载中...' })
    wx.downloadFile({
      url: url,
      success: (res) => {
        wx.hideLoading()
        if (res.statusCode === 200) {
          wx.openDocument({
            filePath: res.tempFilePath,
            fileType: 'pdf',
            success: () => {},
            fail: (err) => {
              wx.showToast({
                title: '打开失败',
                icon: 'none'
              })
            }
          })
        }
      },
      fail: () => {
        wx.hideLoading()
        wx.showToast({
          title: '下载失败',
          icon: 'none'
        })
      }
    })
  },

  // ========== 查看证书大图 ==========
  previewCert(e) {
    const url = e.currentTarget.dataset.url
    const urls = this.data.certifications.map(c => c.certImage)
    
    wx.previewImage({
      current: url,
      urls: urls
    })
  },

  // ========== 扫码溯源 ==========
  scanTrace() {
    wx.scanCode({
      onlyFromCamera: true,
      scanType: ['qrCode'],
      success: (res) => {
        console.log('扫码结果:', res)
        const code = res.result
        
        // 跳转到溯源详情页
        wx.navigateTo({
          url: `/pages/farm/trace-detail?code=${code}`
        })
      },
      fail: (err) => {
        console.error('扫码失败:', err)
      }
    })
  },

  // ========== 下拉刷新 ==========
  onPullDownRefresh() {
    // 刷新当前tab的数据
    this.loadTabData(this.data.activeTab)
    setTimeout(() => {
      wx.stopPullDownRefresh()
    }, 1000)
  },

  // ========== 触底加载更多（农庄动态） ==========
  onReachBottom() {
    if (this.data.activeTab === 3 && this.data.hasMoreNews && !this.data.loadingNews) {
      this.getFarmNews(true)
    }
  },

  // ========== 分享 ==========
  onShareAppMessage: function () {
    return {
      title: '生态农庄 - 天然无抗 健康养殖',
      path: '/pages/farm/index',
      imageUrl: this.data.farmInfo?.panoramaUrl || '/images/farm-share.jpg'
    }
  },

  onShareTimeline: function () {
    return {
      title: '生态农庄 - 天然无抗 健康养殖',
      query: '',
      imageUrl: this.data.farmInfo?.panoramaUrl || '/images/farm-share.jpg'
    }
  },

  // ========== 工具函数 ==========
  formatTime(timeStr) {
    if (!timeStr) return ''
    const date = new Date(timeStr)
    return `${this.padZero(date.getHours())}:${this.padZero(date.getMinutes())}`
  },

  padZero(num) {
    return num < 10 ? '0' + num : num
  }
})

