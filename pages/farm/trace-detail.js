// pages/farm/trace-detail.js
const WXAPI = require('apifm-wxapi')

Page({
  data: {
    code: '',
    traceInfo: null,
    loading: true
  },

  onLoad(options) {
    if (options.code) {
      this.setData({ code: options.code })
      this.getTraceInfo(options.code)
    } else {
      wx.showToast({
        title: '缺少溯源码',
        icon: 'none'
      })
    }
  },

  // 获取溯源信息
  async getTraceInfo(code) {
    wx.showLoading({ title: '查询中...' })
    
    try {
      const res = await WXAPI.request('/farm/trace', true, 'get', { code })
      
      wx.hideLoading()
      
      if (res.code === 0) {
        this.setData({
          traceInfo: res.data,
          loading: false
        })
      } else {
        wx.showModal({
          title: '查询失败',
          content: res.msg || '溯源码不存在',
          showCancel: false,
          success: () => {
            wx.navigateBack()
          }
        })
      }
    } catch (error) {
      wx.hideLoading()
      console.error('获取溯源信息失败:', error)
      wx.showToast({
        title: '查询失败',
        icon: 'none'
      })
    }
  },

  // 预览图片
  previewImage(e) {
    const { urls, current } = e.currentTarget.dataset
    wx.previewImage({
      current: current,
      urls: urls
    })
  },

  // 查看报告
  viewReport(e) {
    const url = e.currentTarget.dataset.url
    if (!url) {
      wx.showToast({
        title: '报告文件暂未上传',
        icon: 'none'
      })
      return
    }
    
    wx.showLoading({ title: '加载中...' })
    wx.downloadFile({
      url: url,
      success: (res) => {
        wx.hideLoading()
        if (res.statusCode === 200) {
          wx.openDocument({
            filePath: res.tempFilePath,
            fileType: 'pdf'
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

  onShareAppMessage() {
    return {
      title: '产品溯源 - ' + (this.data.traceInfo?.productName || '生态农产品'),
      path: '/pages/farm/trace-detail?code=' + this.data.code
    }
  }
})

