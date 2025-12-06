// utils/auth-new.js - 新的登录认证工具类
const { WechatAPI } = require('./api.js')
const CONFIG = require('../config.js')

/**
 * 获取微信登录code
 */
async function wxaCode() {
  return new Promise((resolve, reject) => {
    wx.login({
      success(res) {
        if (res.code) {
          return resolve(res.code)
        } else {
          reject(new Error('获取code失败'))
        }
      },
      fail(err) {
        wx.showToast({
          title: '获取code失败',
          icon: 'none'
        })
        reject(err)
      }
    })
  })
}

/**
 * 检查本地session是否有效
 */
async function checkSession() {
  return new Promise((resolve) => {
    wx.checkSession({
      success() {
        resolve(true)
      },
      fail() {
        resolve(false)
      }
    })
  })
}

/**
 * 检查是否已登录
 * 1. 检查本地是否有jwt_token
 * 2. 检查微信session是否有效
 * 3. 尝试获取用户信息验证token
 */
async function checkHasLogined() {
  const token = wx.getStorageSync('jwt_token')
  if (!token) {
    return false
  }

  // 检查微信session
  const sessionValid = await checkSession()
  if (!sessionValid) {
    // session失效，清除token
    wx.removeStorageSync('jwt_token')
    wx.removeStorageSync('openid')
    wx.removeStorageSync('userInfo')
    return false
  }

  // 验证token是否有效（尝试获取用户信息）
  try {
    const res = await WechatAPI.getUserInfo()
    if (res.code === 0 && res.data) {
      // token有效，更新用户信息
      wx.setStorageSync('userInfo', res.data)
      return true
    }
  } catch (error) {
    console.error('验证token失败:', error)
    // token无效，清除本地数据
    wx.removeStorageSync('jwt_token')
    wx.removeStorageSync('openid')
    wx.removeStorageSync('userInfo')
    return false
  }

  return false
}

/**
 * 登录流程
 * 1. 获取微信code
 * 2. 调用后端获取token
 * 3. 如果用户未注册，引导注册
 * 4. 保存token和用户信息
 */
async function login() {
  try {
    // 1. 获取微信code
    const code = await wxaCode()
    console.log('获取到code:', code)

    // 2. 调用后端获取token
    const res = await WechatAPI.getUserToken(code)
    console.log('getUserToken返回:', res)

    if (res.code === 0) {
      const { openid, is_register, user_info, jwt_token } = res.data

      // 保存openid
      wx.setStorageSync('openid', openid)

      if (is_register && jwt_token) {
        // 已注册，直接登录成功
        wx.setStorageSync('jwt_token', jwt_token)
        wx.setStorageSync('userInfo', user_info)
        wx.setStorageSync('uid', user_info.id || user_info.user_id)
        
        console.log('登录成功')
        return {
          success: true,
          needRegister: false,
          userInfo: user_info
        }
      } else {
        // 未注册，需要引导注册
        console.log('用户未注册，需要注册')
        return {
          success: false,
          needRegister: true,
          openid: openid
        }
      }
    } else {
      throw new Error(res.msg || '登录失败')
    }
  } catch (error) {
    console.error('登录失败:', error)
    wx.showToast({
      title: error.message || '登录失败',
      icon: 'none'
    })
    throw error
  }
}

/**
 * 注册用户
 * @param {string} phoneNumber - 手机号
 * @param {string} openid - 微信openid
 * @param {string} nick - 昵称（可选）
 */
async function register(phoneNumber, openid, nick = null) {
  try {
    const data = {
      phone_number: phoneNumber,
      openid: openid
    }
    
    if (nick) {
      data.nick = nick
    }

    const res = await WechatAPI.registerUser(data)
    
    if (res.code === 0) {
      const { user_info, jwt_token } = res.data
      
      // 保存token和用户信息
      wx.setStorageSync('jwt_token', jwt_token)
      wx.setStorageSync('userInfo', user_info)
      wx.setStorageSync('uid', user_info.id || user_info.user_id)
      
      console.log('注册成功')
      return {
        success: true,
        userInfo: user_info
      }
    } else {
      throw new Error(res.msg || '注册失败')
    }
  } catch (error) {
    console.error('注册失败:', error)
    wx.showToast({
      title: error.message || '注册失败',
      icon: 'none'
    })
    throw error
  }
}

/**
 * 获取手机号（通过微信授权）
 * @param {object} event - button open-type="getPhoneNumber" 的回调事件
 */
async function getPhoneNumber(event) {
  try {
    if (event.detail.code) {
      const code = event.detail.code
      const res = await WechatAPI.getPhoneNumber(code)
      
      if (res.code === 0) {
        const phoneInfo = res.data
        return {
          success: true,
          phoneNumber: phoneInfo.phoneNumber,
          purePhoneNumber: phoneInfo.purePhoneNumber,
          countryCode: phoneInfo.countryCode
        }
      } else {
        throw new Error(res.msg || '获取手机号失败')
      }
    } else {
      throw new Error('用户拒绝授权')
    }
  } catch (error) {
    console.error('获取手机号失败:', error)
    wx.showToast({
      title: error.message || '获取手机号失败',
      icon: 'none'
    })
    throw error
  }
}

/**
 * 完整的登录注册流程
 * 如果未登录，先登录；如果未注册，引导注册
 */
async function autoLogin() {
  try {
    // 1. 检查是否已登录
    const isLogined = await checkHasLogined()
    if (isLogined) {
      console.log('已登录')
      return {
        success: true,
        isLogined: true
      }
    }

    // 2. 尝试登录
    const loginResult = await login()
    
    if (loginResult.success) {
      // 登录成功
      return {
        success: true,
        isLogined: true,
        userInfo: loginResult.userInfo
      }
    } else if (loginResult.needRegister) {
      // 需要注册
      return {
        success: false,
        needRegister: true,
        openid: loginResult.openid
      }
    }
  } catch (error) {
    console.error('自动登录失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * 退出登录
 */
async function logout() {
  try {
    // 调用后端退出接口（可选）
    const { UserAPI } = require('./api.js')
    await UserAPI.logout()
  } catch (error) {
    console.error('调用退出接口失败:', error)
  } finally {
    // 清除本地存储
    wx.removeStorageSync('jwt_token')
    wx.removeStorageSync('openid')
    wx.removeStorageSync('userInfo')
    wx.removeStorageSync('uid')
    
    wx.showToast({
      title: '已退出登录',
      icon: 'success'
    })
  }
}

/**
 * 获取用户信息（从本地或服务器）
 * @param {boolean} forceRefresh - 是否强制从服务器刷新
 */
async function getUserInfo(forceRefresh = false) {
  if (!forceRefresh) {
    // 先尝试从本地获取
    const localUserInfo = wx.getStorageSync('userInfo')
    if (localUserInfo) {
      return localUserInfo
    }
  }

  // 从服务器获取
  try {
    const res = await WechatAPI.getUserInfo()
    if (res.code === 0) {
      wx.setStorageSync('userInfo', res.data)
      return res.data
    }
  } catch (error) {
    console.error('获取用户信息失败:', error)
  }
  
  return null
}

/**
 * 检查并授权
 * @param {string} scope - 权限范围
 */
async function checkAndAuthorize(scope) {
  return new Promise((resolve, reject) => {
    wx.getSetting({
      success(res) {
        if (!res.authSetting[scope]) {
          wx.authorize({
            scope: scope,
            success() {
              resolve()
            },
            fail(e) {
              console.error(e)
              wx.showModal({
                title: '无权操作',
                content: '需要获得您的授权',
                showCancel: false,
                confirmText: '立即授权',
                confirmColor: '#07c160',
                success(res) {
                  if (res.confirm) {
                    wx.openSetting()
                  }
                },
                fail(e) {
                  console.error(e)
                  reject(e)
                }
              })
            }
          })
        } else {
          resolve()
        }
      },
      fail(e) {
        console.error(e)
        reject(e)
      }
    })
  })
}

module.exports = {
  wxaCode,
  checkSession,
  checkHasLogined,
  login,
  register,
  getPhoneNumber,
  autoLogin,
  logout,
  getUserInfo,
  checkAndAuthorize
}

