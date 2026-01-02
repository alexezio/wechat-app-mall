const WXAPI = require('../../utils/wxapi-adapter')
const AUTH = require('../../utils/auth')
const API = require('../../utils/api')
var address_parse = require("../../utils/address_parse")
Page({
  data: {
    // 多级选择器数据
    regionColumns: [[], [], [], []], // 省、市、区、街道四列
    regionIndexes: [0, 0, 0, 0], // 当前选中的索引
    regionText: '', // 显示的文本
    
    // 保存当前选中的编码（用于提交）
    selectedProvinceCode: '',
    selectedCityCode: '',
    selectedAreaCode: '',
    selectedStreetCode: '',
    
    // 兼容旧字段
    provinces: undefined,
    pIndex: 0,
    cities: undefined,
    cIndex: 0,
    areas: undefined,
    aIndex: 0,
  },
  /**
   * 初始化多级选择器
   */
  async initRegionSelector(provinceCode, cityCode, areaCode, streetCode) {
    wx.showLoading({ title: '加载中...' })
    
    // 1. 加载省份列表
    const provinceRes = await WXAPI.provinceV2()
    if (provinceRes.code !== 0) {
      wx.hideLoading()
      wx.showToast({ title: '加载省份失败', icon: 'none' })
      return
    }
    
    const provinces = provinceRes.data || []
    if (provinces.length === 0) {
      wx.hideLoading()
      wx.showToast({ title: '省份数据为空', icon: 'none' })
      return
    }
    
    const regionColumns = [provinces, [], [], []]
    const regionIndexes = [0, 0, 0, 0]
    
    // 2. 如果有省份编码，加载对应的市区街道（编辑模式）
    if (provinceCode && provinces.length > 0) {
      const pIndex = provinces.findIndex(p => p.code === provinceCode)
      if (pIndex !== -1) {
        regionIndexes[0] = pIndex
        
        // 加载城市
        const cityRes = await API.RegionAPI.getCities(provinceCode)
        if (cityRes.code === 0 && cityRes.data) {
          regionColumns[1] = cityRes.data
          
          if (cityCode) {
            const cIndex = cityRes.data.findIndex(c => c.code === cityCode)
            if (cIndex !== -1) {
              regionIndexes[1] = cIndex
              
              // 加载区县
              const areaRes = await API.RegionAPI.getAreas(cityCode)
              if (areaRes.code === 0 && areaRes.data) {
                regionColumns[2] = areaRes.data
                
                if (areaCode) {
                  const aIndex = areaRes.data.findIndex(a => a.code === areaCode)
                  if (aIndex !== -1) {
                    regionIndexes[2] = aIndex
                    
                    // 加载街道
                    const streetRes = await API.RegionAPI.getStreets(areaCode)
                    if (streetRes.code === 0 && streetRes.data && streetRes.data.length > 0) {
                      regionColumns[3] = streetRes.data
                      
                      if (streetCode) {
                        const sIndex = streetRes.data.findIndex(s => s.code === streetCode)
                        if (sIndex !== -1) {
                          regionIndexes[3] = sIndex
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
      // 如果是编辑模式，显示文本已经更新了
    } else {
      // 3. 新增模式：默认加载第一个省份的城市列表，方便用户直接选择
      if (provinces.length > 0 && provinces[0].code) {
        const firstProvinceCode = provinces[0].code
        const cityRes = await API.RegionAPI.getCities(firstProvinceCode)
        if (cityRes.code === 0 && cityRes.data && cityRes.data.length > 0) {
          regionColumns[1] = cityRes.data
          
          // 继续加载第一个城市的区县列表
          if (cityRes.data[0].code) {
            const firstCityCode = cityRes.data[0].code
            const areaRes = await API.RegionAPI.getAreas(firstCityCode)
            if (areaRes.code === 0 && areaRes.data && areaRes.data.length > 0) {
              regionColumns[2] = areaRes.data
              
              // 继续加载第一个区县的街道列表（如果需要）
              const shipping_address_region_level = wx.getStorageSync('shipping_address_region_level')
              if (shipping_address_region_level != 3 && areaRes.data[0].code) {
                const firstAreaCode = areaRes.data[0].code
                const streetRes = await API.RegionAPI.getStreets(firstAreaCode)
                if (streetRes.code === 0 && streetRes.data && streetRes.data.length > 0) {
                  regionColumns[3] = streetRes.data
                }
              }
            }
          }
        }
      }
    }
    
    // 4. 更新显示文本和选中的编码
    this.updateRegionText(regionColumns, regionIndexes)
    
    // 5. 更新数据
    this.setData({
      regionColumns,
      regionIndexes
    })
    
    wx.hideLoading()
  },
  
  /**
   * 多级选择器列变化（联动加载下一级）
   */
  async onRegionColumnChange(e) {
    const { column, value } = e.detail
    const { regionColumns, regionIndexes } = this.data
    
    console.log(`[地址选择器] 列${column}变化为索引${value}`)
    
    // 更新当前列的索引
    regionIndexes[column] = value
    
    // 清空后续列的数据和索引
    for (let i = column + 1; i < 4; i++) {
      regionColumns[i] = []
      regionIndexes[i] = 0
    }
    
    // 立即更新视图，清空后续列
    this.setData({
      regionColumns: [...regionColumns],
      regionIndexes: [...regionIndexes]
    })
    
    // 加载下一级数据
    if (column === 0 && regionColumns[0][value]) {
      // 省份变化，加载城市
      const provinceCode = regionColumns[0][value].code
      const provinceName = regionColumns[0][value].name
      console.log(`[地址选择器] 选择省份: ${provinceName} (${provinceCode})`)
      
      if (provinceCode) {
        wx.showLoading({ title: '加载城市...' })
        // 直接调用城市查询接口，不依赖编码格式判断
        const res = await API.RegionAPI.getCities(provinceCode)
        wx.hideLoading()
        
        if (res.code === 0 && res.data && res.data.length > 0) {
          regionColumns[1] = res.data
          console.log(`[地址选择器] 加载到 ${res.data.length} 个城市`)
          
          // 继续加载第一个城市的区县
          if (res.data[0].code) {
            const firstCityCode = res.data[0].code
            const areaRes = await API.RegionAPI.getAreas(firstCityCode)
            if (areaRes.code === 0 && areaRes.data && areaRes.data.length > 0) {
              regionColumns[2] = areaRes.data
              console.log(`[地址选择器] 加载到 ${areaRes.data.length} 个区县`)
              
              // 继续加载第一个区县的街道
              const shipping_address_region_level = wx.getStorageSync('shipping_address_region_level')
              if (shipping_address_region_level != 3 && areaRes.data[0].code) {
                const firstAreaCode = areaRes.data[0].code
                const streetRes = await API.RegionAPI.getStreets(firstAreaCode)
                if (streetRes.code === 0 && streetRes.data && streetRes.data.length > 0) {
                  regionColumns[3] = streetRes.data
                  console.log(`[地址选择器] 加载到 ${streetRes.data.length} 个街道`)
                }
              }
            }
          }
        } else {
          console.warn('[地址选择器] 加载城市失败或数据为空')
        }
      }
    } else if (column === 1 && regionColumns[1][value]) {
      // 城市变化，加载区县
      const cityCode = regionColumns[1][value].code
      const cityName = regionColumns[1][value].name
      console.log(`[地址选择器] 选择城市: ${cityName} (${cityCode})`)
      
      if (cityCode) {
        wx.showLoading({ title: '加载区县...' })
        // 直接调用区县查询接口
        const res = await API.RegionAPI.getAreas(cityCode)
        wx.hideLoading()
        
        if (res.code === 0 && res.data && res.data.length > 0) {
          regionColumns[2] = res.data
          console.log(`[地址选择器] 加载到 ${res.data.length} 个区县`)
          
          // 继续加载第一个区县的街道
          const shipping_address_region_level = wx.getStorageSync('shipping_address_region_level')
          if (shipping_address_region_level != 3 && res.data[0].code) {
            const firstAreaCode = res.data[0].code
            const streetRes = await API.RegionAPI.getStreets(firstAreaCode)
            if (streetRes.code === 0 && streetRes.data && streetRes.data.length > 0) {
              regionColumns[3] = streetRes.data
              console.log(`[地址选择器] 加载到 ${streetRes.data.length} 个街道`)
            }
          }
        }
      }
    } else if (column === 2 && regionColumns[2][value]) {
      // 区县变化，加载街道
      const areaCode = regionColumns[2][value].code
      const areaName = regionColumns[2][value].name
      console.log(`[地址选择器] 选择区县: ${areaName} (${areaCode})`)
      
      if (areaCode) {
        const shipping_address_region_level = wx.getStorageSync('shipping_address_region_level')
        if (shipping_address_region_level != 3) {
          wx.showLoading({ title: '加载街道...' })
          // 直接调用街道查询接口
          const res = await API.RegionAPI.getStreets(areaCode)
          wx.hideLoading()
          
          if (res.code === 0 && res.data && res.data.length > 0) {
            regionColumns[3] = res.data
            console.log(`[地址选择器] 加载到 ${res.data.length} 个街道`)
          }
        }
      }
    }
    
    // 更新视图
    this.setData({
      regionColumns: [...regionColumns],
      regionIndexes: [...regionIndexes]
    })
  },
  
  /**
   * 多级选择器确认选择
   */
  onRegionChange(e) {
    const { value } = e.detail
    const { regionColumns } = this.data
    
    // 更新选中的编码
    const selectedProvinceCode = regionColumns[0][value[0]]?.code || ''
    const selectedCityCode = regionColumns[1][value[1]]?.code || ''
    const selectedAreaCode = regionColumns[2][value[2]]?.code || ''
    const selectedStreetCode = regionColumns[3][value[3]]?.code || ''
    
    // 更新显示文本
    this.updateRegionText(regionColumns, value)
    
    // 更新数据
    this.setData({
      regionIndexes: value,
      selectedProvinceCode,
      selectedCityCode,
      selectedAreaCode,
      selectedStreetCode
    })
    
    console.log('选中的地区:', {
      province: regionColumns[0][value[0]]?.name,
      city: regionColumns[1][value[1]]?.name,
      area: regionColumns[2][value[2]]?.name,
      street: regionColumns[3][value[3]]?.name,
      codes: { selectedProvinceCode, selectedCityCode, selectedAreaCode, selectedStreetCode }
    })
  },
  
  /**
   * 更新地区显示文本
   */
  updateRegionText(regionColumns, regionIndexes) {
    const texts = []
    
    if (regionColumns[0] && regionColumns[0][regionIndexes[0]]) {
      texts.push(regionColumns[0][regionIndexes[0]].name)
    }
    if (regionColumns[1] && regionColumns[1][regionIndexes[1]]) {
      texts.push(regionColumns[1][regionIndexes[1]].name)
    }
    if (regionColumns[2] && regionColumns[2][regionIndexes[2]]) {
      texts.push(regionColumns[2][regionIndexes[2]].name)
    }
    if (regionColumns[3] && regionColumns[3][regionIndexes[3]]) {
      texts.push(regionColumns[3][regionIndexes[3]].name)
    }
    
    const regionText = texts.join(' / ')
    
    this.setData({
      regionText
    })
    
    // 同时保存选中的编码
    this.setData({
      selectedProvinceCode: regionColumns[0][regionIndexes[0]]?.code || '',
      selectedCityCode: regionColumns[1][regionIndexes[1]]?.code || '',
      selectedAreaCode: regionColumns[2][regionIndexes[2]]?.code || '',
      selectedStreetCode: regionColumns[3][regionIndexes[3]]?.code || ''
    })
  },
  async bindSave() {
    // 验证地区选择
    if (!this.data.selectedProvinceCode) {
      wx.showToast({
        title: '请选择省份',
        icon: 'none'
      })
      return
    }
    if (!this.data.selectedCityCode) {
      wx.showToast({
        title: '请选择城市',
        icon: 'none'
      })
      return
    }
    if (!this.data.selectedAreaCode) {
      wx.showToast({
        title: '请选择区县',
        icon: 'none'
      })
      return
    }
    const shipping_address_region_level = wx.getStorageSync('shipping_address_region_level')
    if (shipping_address_region_level == 4) {
      if (!this.data.selectedStreetCode) {
        wx.showToast({
          title: '请选择街道',
          icon: 'none'
        })
        return
      }
    }
    
    const linkMan = this.data.linkMan;
    const address = this.data.address;
    const mobile = this.data.mobile;
    if (this.data.shipping_address_gps == '1' && !this.data.addressData) {
      wx.showToast({
        title: '请选择定位',
        icon: 'none',       
      })
      return
    }
    const latitude = this.data.addressData ? this.data.addressData.latitude : null
    const longitude = this.data.addressData ? this.data.addressData.longitude : null
    if (!linkMan){
      wx.showToast({
        title: '请填写联系人姓名',
        icon: 'none'
      })
      return
    }
    if (!mobile){
      wx.showToast({
        title: '请填写手机号码',
        icon: 'none'
      })
      return
    }
    const postData = {
      linkMan: linkMan,
      address: address,
      mobile: mobile,
      isDefault: true
    }
    if (this.data.shipping_address_gps == '1' && !latitude){
      wx.showToast({
        title: '请选择定位',
        icon: 'none',       
      })
      return
    }
    if (latitude) {
      postData.latitude = latitude
    }
    if (longitude) {
      postData.longitude = longitude
    }
    if (!address){
      wx.showToast({
        title: '请填写详细地址',
        icon: 'none'
      })
      return
    }    
    
    // 使用选中的编码
    if (this.data.selectedProvinceCode) {
      postData.provinceCode = this.data.selectedProvinceCode
    }
    if (this.data.selectedCityCode) {
      postData.cityCode = this.data.selectedCityCode
    }
    if (this.data.selectedAreaCode) {
      postData.areaCode = this.data.selectedAreaCode
    }    
    if (this.data.selectedStreetCode) {
      postData.streetCode = this.data.selectedStreetCode
    }    
    let apiResult
    if (this.data.id) {
      postData.id = this.data.id
      apiResult = await WXAPI.updateAddress(postData)
    } else {
      apiResult = await WXAPI.addAddress(postData)
    }
    if (apiResult.code != 0) {
      // 登录错误 
      wx.hideLoading();
      wx.showToast({
        title: apiResult.msg,
        icon: 'none'
      })
      return;
    } else {
      wx.hideLoading();
      wx.showToast({
        title: this.data.id ? '修改成功' : '添加成功',
        icon: 'success'
      })
      // 设置标志，通知前一页刷新地址列表
      const pages = getCurrentPages();
      const prevPage = pages[pages.length - 2]; // 获取上一页实例
      if (prevPage) {
        // 标记需要刷新地址
        prevPage.setData({ needRefreshAddress: true });
      }
      setTimeout(() => {
        wx.navigateBack()
      }, 500)
    }
  },
  async onLoad(e) {
    // this.initFromClipboard('广州市天河区天河东路6号粤电广场北塔2302，徐小姐，18588998859')
    const _this = this
    if (e.id) { // 修改初始化数据库数据
      const res = await WXAPI.addressDetail(e.id)
      if (res.code == 0) {
        // 转换字段格式
        const addressInfo = res.data.info || res.data
        const convertedInfo = {
          id: addressInfo.id,
          linkMan: addressInfo.link_man || addressInfo.linkMan,
          mobile: addressInfo.mobile,
          address: addressInfo.address,
          code: addressInfo.code,
          provinceCode: addressInfo.province_code || addressInfo.provinceCode,
          cityCode: addressInfo.city_code || addressInfo.cityCode,
          areaCode: addressInfo.area_code || addressInfo.areaCode || addressInfo.district_code,
          streetCode: addressInfo.street_code || addressInfo.streetCode,
          latitude: addressInfo.latitude,
          longitude: addressInfo.longitude
        }
        this.setData({
          id: e.id,
          ...convertedInfo
        })
        this.initRegionSelector(convertedInfo.provinceCode, convertedInfo.cityCode, convertedInfo.areaCode, convertedInfo.streetCode)
      } else {
        wx.showModal({
          title: '错误',
          content: '无法获取快递地址数据',
          showCancel: false
        })
      }
    } else {
      this.initRegionSelector()
      wx.getClipboardData({
        success (res){
          if (res.data) {
            _this.initFromClipboard(res.data)
          }
        }
      })
    }
    this.setData({
      shipping_address_gps: wx.getStorageSync('shipping_address_gps')
    })
  },
  async initFromClipboard (str) {
    address_parse.smart(str).then(res => {
      console.log('ggggggg', res);
      if (res.name && res.phone && res.address) {
        
        // 检测到收货地址
        this.setData({
          addressData: {
            provinceCode: res.provinceCode,
            cityCode: res.cityCode,
            areaCode: res.countyCode,
            linkMan: res.name,
            mobile: res.phone,
            address: res.address,
          }
        })
        this.initRegionSelector(res.provinceCode, res.cityCode, res.countyCode)
      }
    })
  },
  deleteAddress: function (e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '提示',
      content: '确定要删除该收货地址吗？',
      success: async function (res) {
        if (res.confirm) {
          const result = await WXAPI.deleteAddress(id)
          if (result.code === 0) {
            wx.showToast({
              title: '删除成功',
              icon: 'success'
            })
            setTimeout(() => {
              wx.navigateBack({})
            }, 1500)
          } else {
            wx.showToast({
              title: result.msg || '删除失败',
              icon: 'none'
            })
          }
        } else {
          console.log('用户点击取消')
        }
      }
    })
  },
  async readFromWx() {
    const that = this;
    wx.chooseAddress({
      success: async function (res) {
        // res = {
        //   cityName: '上海市',
        //   countyName: '嘉定区',
        //   detailInfo: '惠民路123号',
        //   errMsg: 'chooseAddress.ok',
        //   nationalCode: '310114',
        //   postalCode: '201800',
        //   provinceName: '上海市',
        //   telNumber: '13500000000',
        //   userName: '测试',
        // }
        
        wx.showLoading({ title: '加载中...' })
        
        try {
          const provinceName = res.provinceName;
          const cityName = res.cityName;
          const districtName = res.countyName;
          const { regionColumns } = that.data
          
          // 1. 查找省份
          const pIndex = regionColumns[0].findIndex(ele => ele.name === provinceName)
          if (pIndex === -1) {
            wx.hideLoading()
            wx.showToast({ title: '未找到对应省份', icon: 'none' })
            return
          }
          
          const provinceCode = regionColumns[0][pIndex].code
          
          // 2. 加载并查找城市
          const cityRes = await API.RegionAPI.getCities(provinceCode)
          if (cityRes.code !== 0 || !cityRes.data) {
            wx.hideLoading()
            wx.showToast({ title: '加载城市失败', icon: 'none' })
            return
          }
          
          let cIndex = cityRes.data.findIndex(ele => ele.name === cityName)
          if (cIndex === -1) {
            cIndex = 0 // 兼容直辖市
          }
          
          const cityCode = cityRes.data[cIndex].code
          
          // 3. 加载并查找区县
          const areaRes = await API.RegionAPI.getAreas(cityCode)
          if (areaRes.code !== 0 || !areaRes.data) {
            wx.hideLoading()
            wx.showToast({ title: '加载区县失败', icon: 'none' })
            return
          }
          
          const aIndex = areaRes.data.findIndex(ele => ele.name === districtName)
          if (aIndex === -1) {
            wx.hideLoading()
            wx.showToast({ title: '未找到对应区县', icon: 'none' })
            return
          }
          
          const areaCode = areaRes.data[aIndex].code
          
          // 4. 尝试加载街道（可选）
          let streetRes = null
          const shipping_address_region_level = wx.getStorageSync('shipping_address_region_level')
          if (shipping_address_region_level != 3) {
            streetRes = await API.RegionAPI.getStreets(areaCode)
          }
          
          // 5. 更新选择器数据
          const newRegionColumns = [
            regionColumns[0],
            cityRes.data,
            areaRes.data,
            (streetRes && streetRes.code === 0 && streetRes.data) ? streetRes.data : []
          ]
          
          const newRegionIndexes = [pIndex, cIndex, aIndex, 0]
          
          // 6. 更新显示
          that.updateRegionText(newRegionColumns, newRegionIndexes)
          
          that.setData({
            regionColumns: newRegionColumns,
            regionIndexes: newRegionIndexes,
            linkMan: res.userName,
            mobile: res.telNumber,
            address: res.detailInfo,
            code: res.postalCode || ''
          })
          
          wx.hideLoading()
          wx.showToast({ title: '导入成功', icon: 'success' })
          
        } catch (error) {
          console.error('导入微信地址失败:', error)
          wx.hideLoading()
          wx.showToast({ title: '导入失败', icon: 'none' })
        }
      }
    })
  },
  chooseLocation() {
    wx.chooseLocation({
      success: (res) => {
        const addressData = this.data.addressData ? this.data.addressData : {}
        addressData.address = res.address + res.name
        addressData.latitude = res.latitude
        addressData.longitude = res.longitude
        this.setData({
          addressData
        })
      },
      fail: (e) => {
        console.error(e)
      },
    })
  }
})
