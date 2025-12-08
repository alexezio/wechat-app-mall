const CONFIG = require('../../../config')
const WXAPI = CONFIG.useNewApi ? require('../../../utils/wxapi-adapter') : require('apifm-wxapi')

Page({
  data: {
    liveConfig: null,
    liveLoading: false
  },

  onLoad(options) {
    const eventChannel = this.getOpenerEventChannel && this.getOpenerEventChannel()
    if (eventChannel && eventChannel.on) {
      eventChannel.on('liveConfig', (payload) => {
        if (payload && payload.liveConfig) {
          this.setData({ liveConfig: payload.liveConfig })
        }
      })
    }

    // 兜底：如果通过 query 传了 device_serial/channel_no，则自行拉流
    if (options && options.device_serial) {
      const deviceSerial = options.device_serial
      const channelNo = options.channel_no ? Number(options.channel_no) : 1
      this.fetchAndPlay(deviceSerial, channelNo)
    }
  },

  async fetchAndPlay(deviceSerial, channelNo = 1) {
    this.setData({ liveLoading: true })
    try {
      const res = await WXAPI.farmPlayConfig({
        device_serial: deviceSerial,
        channel_no: channelNo
      })
      console.log('[农庄Live] play-config:', res)
      if (res.code === 0 && res.data && (res.data.accessToken || res.data.access_token)) {
        const playUrl = `rtmp://open.ys7.com/${deviceSerial}/${channelNo}/live`
        this.setData({
          liveConfig: {
            accessToken: res.data.accessToken || res.data.access_token,
            url: playUrl,
            plugins: res.data.plugins || 'voice,ptz',
            ratio: res.data.ratio || '16:9',
            width: res.data.width || '100%',
            height: res.data.height || '240px',
            theme: res.data.theme || { showCapture: true, showBottomBar: true, showDatePicker: true, showTypeSwitch: true },
            recPlayTime: res.data.recPlayTime || ''
          }
        })
      } else {
        wx.showToast({ title: res.msg || '获取播放参数失败', icon: 'none' })
      }
    } catch (error) {
      console.error('[农庄Live] 获取直播参数异常:', error)
      wx.showToast({ title: '获取直播参数失败', icon: 'none' })
    } finally {
      this.setData({ liveLoading: false })
    }
  },

  handleLiveError(e) {
    console.error('[农庄Live] 直播错误:', e.detail || e)
    wx.showToast({
      title: (e.detail && e.detail.msg) ? e.detail.msg : '直播播放出错',
      icon: 'none'
    })
  },

  handleLiveControl(e) {
    console.log('[农庄Live] 控制事件:', e.detail)
  }
})

