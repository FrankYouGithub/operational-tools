/*
 * @Author       : frank
 * @Date         : 2022-10-05 22:11:48
 * @LastEditTime : 2022-11-30 20:12:30
 * @LastEditors  : frank
 * @Description  : In User Settings Edit
 */
const { formatDate, saveLocalJSON, getLocalJSON, fsExistsSync } = require('../util');
const pwd = process.cwd(); // 当前执行程序的路径 同 path.resolve('./')
const fs = require("fs");              //操作文件，读写文件
const path = require('path');
const nodeXlsx = require('node-xlsx')	 //引用node-xlsx模块
const currentDir = pwd.substr(pwd.lastIndexOf('/') + 1);
const open = require('child_process');
const cheerio = require("cheerio");    //扩展模块
const axios = require('axios');

let PAccount = [] // 本地母账号列表
let acIndex = 0   // 当前登陆账号指针
let cookie = ''   // 当前登陆账号cookie
let token = ''    // 当前登陆账号token
let membersLength = 0 // 成员数量

const JSON_PATH = path.join(__dirname, 'data')

// 获取本地母账号列表
const getDatas = () => {
  const account = nodeXlsx.parse(path.join(pwd, 'account.xlsx'))[0].data	//读取excel表格
  account.forEach(item => {
    PAccount.push({
      account: item[0],
      password: item[1]
    })
  })
}
// 获取token
const getCsrfToken = () => {
  console.log('获取token中......')
  return new Promise((resolve, reject) => {
    axios.get('https://mp.xiaozhuyouban.com', {
      headers: {
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
        "origin": "https://mp.xiaozhuyouban.com",
        "referer": "https://mp.xiaozhuyouban.com/",
        'host': 'mp.xiaozhuyouban.com',
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.131 Safari/537.36",
        "x-requested-with": "XMLHttpRequest",
        "sec-ch-ua": `"Chromium";v="104", " Not A;Brand";v="99", "Google Chrome";v="104"`,
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": "Windows",
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
      }
    }).then(res => {
      if (res.status === 200) {
        const $ = cheerio.load(res.data);
        const token = $('meta[name="csrf-token"]').attr('content')
        resolve(token)
        console.log('csrf-token：', token)
      } else {
        console.log('获取token失败，正在重试......')
        reject(null)
      }
    }).catch(err => {
      console.log('获取token失败，正在重试......')
      reject(err)
    })
  })
}
// 登陆小猪优版
const loginXiaozhu = (mobile = '', password = '') => {
  console.log(`正在登陆 ========== ${mobile} ===========`)
  return new Promise((resolve, reject) => {
    axios.post('https://mp.xiaozhuyouban.com/signin', {
      xsrfToken: token,
      mobile,
      password,
      'check[captcha_id]': '',
      'check[lot_number]': '',
      'check[pass_token]': '',
      'check[gen_time]': '',
      'check[captcha_output]': '',
    }, {
      headers: {
        'accept': '*/*',
        'content-type': 'multipart/form-data',
        'Cookie': `XSRF-TOKEN=${token}`,
        'host': 'mp.xiaozhuyouban.com',
        "origin": "https://mp.xiaozhuyouban.com",
        "referer": "https://mp.xiaozhuyouban.com/",
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.131 Safari/537.36",
        "x-requested-with": "XMLHttpRequest",
        "sec-ch-ua": `"Chromium";v="104", " Not A;Brand";v="99", "Google Chrome";v="104"`,
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": "Windows",
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
      }
    }).then(res => {
      if (res.status === 200 && res.data.code === 0) {
        const cks = [];
        res.headers['set-cookie'].map(item => {
          cks.push(item.split(';')[0])
        })
        const cookie = cks.join('; ')
        resolve(cookie)
        console.log(`账号登陆成功.......`)
      } else {
        reject('登陆失败')
        console.log(`账号登陆失败.......请稍后重试........`)
      }
    }).catch(error => {
      reject(error)
      console.log(`账号登陆失败.......请稍后重试........`)
    })
  })
}
// 接口请求成员数据
const fetchMembers = (page) => {
  console.log(`正在获取成员数据........ ${page}`)
  return new Promise((resolve, reject) => {
    axios.post('https://mp.xiaozhuyouban.com/mcn/member', {
      page,
    }, {
      headers: {
        'accept': '*/*',
        'content-type': 'multipart/form-data',
        'host': 'mp.xiaozhuyouban.com',
        "origin": "https://mp.xiaozhuyouban.com",
        "referer": "https://mp.xiaozhuyouban.com/mcn/member",
        'Cookie': cookie,
        'X-CSRF-TOKEN': token,
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.131 Safari/537.36",
        "x-requested-with": "XMLHttpRequest"
      }
    }).then(res => {
      if (res.status === 200 && res.data.code == 0) {
        const { members = [], total } = res.data.data
        resolve({ suc: true, members, total })
      } else {
        resolve({ suc: false })
        console.log('接口调用失败，请稍后重试。。。。。。。。。。。。')
      }
    }).catch(() => {
      resolve({ suc: false })
      console.log('接口调用失败，请稍后重试。。。。。。。。。。。。')
    })
  })
}
// 获取成员数据
const getMembers = async () => {
  return new Promise((resolve, reject) => {
    let allMems = [];
    let maxPage = 3;
    let page = 1;
    const curAccount = PAccount[acIndex];
    const file = path.join(JSON_PATH, `${curAccount.account}.json`)
    const fetch = async () => {
      const mems = await fetchMembers(page);
      if (mems.suc) {
        const { members = [], total } = mems;
        maxPage = total / 10;
        membersLength = total
        allMems = allMems.concat(members);
        page++;
        if (page <= maxPage) {
          fetch();
        } else {
          resolve(allMems)
          saveLocalJSON(file, allMems)
        }
      } else {
        fetch();
      }
    }
    if (fsExistsSync(file)) {
      const data = getLocalJSON(file)
      membersLength = data.length
      resolve(data)
    } else {
      fetch();
    }
  })
}
// 接口请求收益数据
const fetchIncome = (page) => {
  console.log(`正在获取收益数据........ ${page}`)
  const date = formatDate(new Date(new Date().getTime() - 24 * 60 * 60 * 1000), 'yyyy-MM-dd')
  return new Promise((resolve, reject) => {
    axios.post('https://mp.xiaozhuyouban.com/mcn/income', {
      page,
      query: 'sub',
      start: date,
      end: date,
      keyword: '',
    }, {
      headers: {
        'accept': '*/*',
        'content-type': 'multipart/form-data',
        'host': 'mp.xiaozhuyouban.com',
        "origin": "https://mp.xiaozhuyouban.com",
        "referer": "https://mp.xiaozhuyouban.com/mcn/income",
        'Cookie': cookie,
        'X-CSRF-TOKEN': token,
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.131 Safari/537.36",
        "x-requested-with": "XMLHttpRequest"
      }
    }).then(res => {
      if (res.status === 200 && res.data.code == 0) {
        const { creators = [] } = res.data.data
        resolve({ suc: true, creators })
      } else {
        resolve({ suc: false })
        console.log('接口调用失败，请稍后重试。。。。。。。。。。。。')
      }
    }).catch(() => {
      resolve({ suc: false })
      console.log('接口调用失败，请稍后重试。。。。。。。。。。。。')
    })
  })
}
// 获取收益数据
const getIncome = async () => {
  return new Promise((resolve, reject) => {
    let allIncomes = [];
    let page = 1;
    const fetch = async () => {
      const incomes = await fetchIncome(page);
      if (incomes.suc) {
        const { creators = [] } = incomes;
        allIncomes = allIncomes.concat(creators);
        page++;
        if (creators.length && allIncomes.length < membersLength) {
          fetch();
        } else {
          resolve(allIncomes)
        }
      } else {
        fetch();
      }
    }
    fetch();
  })
}
// 请求账号设置
const getAccountSetting = () => {
  console.log('获取账号设置中......')
  return new Promise((resolve, reject) => {
    axios.get('https://mp.xiaozhuyouban.com/account/setting', {
      headers: {
        'accept': '*/*',
        'content-type': 'multipart/form-data',
        'host': 'mp.xiaozhuyouban.com',
        "origin": "https://mp.xiaozhuyouban.com",
        "referer": "https://mp.xiaozhuyouban.com/account/setting",
        'Cookie': cookie,
        'X-CSRF-TOKEN': token,
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.131 Safari/537.36",
        "x-requested-with": "XMLHttpRequest"
      }
    }).then(res => {
      if (res.status === 200) {
        const $ = cheerio.load(res.data);
        const Organization = $('.omui-tooltip span').text()
        resolve(Organization)
        console.log('Organization：', Organization.trim())
      } else {
        console.log('获取账号设置失败，正在重试......')
        reject(null)
      }
    }).catch(err => {
      console.log('获取账号设置失败，正在重试......')
      reject(err)
    })
  })
}
// 请求结算中心
const getSettleCenter = () => {
  console.log('获取结算中心中......')
  return new Promise((resolve, reject) => {
    axios.get('https://mp.xiaozhuyouban.com/settlement/center', {
      headers: {
        'accept': '*/*',
        'content-type': 'multipart/form-data',
        'host': 'mp.xiaozhuyouban.com',
        "origin": "https://mp.xiaozhuyouban.com",
        "referer": "https://mp.xiaozhuyouban.com/settlement/center",
        'Cookie': cookie,
        'X-CSRF-TOKEN': token,
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.131 Safari/537.36",
        "x-requested-with": "XMLHttpRequest"
      }
    }).then(res => {
      if (res.status === 200) {
        const $ = cheerio.load(res.data);
        const amount = $('.total-deposite').text()
        resolve(amount)
        console.log('amount', amount)
      } else {
        console.log('获取结算中心失败，正在重试......')
        reject(null)
      }
    }).catch(err => {
      console.log('获取结算中心失败，正在重试......')
      reject(err)
    })
  })
}

// 接口请求最近收益数据
const fetchMCNIncome = () => {
  console.log(`正在获取成员数据........`)
  return new Promise((resolve, reject) => {
    axios.post('https://mp.xiaozhuyouban.com/mcn/income', {
      query: 'total',
      start: formatDate(new Date(new Date().getTime() - 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
      end: formatDate(new Date(new Date().getTime() - 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
      type: 'all',
    }, {
      headers: {
        'accept': '*/*',
        'content-type': 'multipart/form-data',
        'host': 'mp.xiaozhuyouban.com',
        "origin": "https://mp.xiaozhuyouban.com",
        "referer": "https://mp.xiaozhuyouban.com/mcn/income",
        'Cookie': cookie,
        'X-CSRF-TOKEN': token,
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.131 Safari/537.36",
        "x-requested-with": "XMLHttpRequest"
      }
    }).then(res => {
      if (res.status === 200 && res.data.code == 0) {
        const { dates } = res.data.data
        resolve({ suc: true, dates })
      } else {
        resolve({ suc: false })
        console.log('接口调用失败，请稍后重试。。。。。。。。。。。。')
      }
    }).catch(() => {
      resolve({ suc: false })
      console.log('接口调用失败，请稍后重试。。。。。。。。。。。。')
    })
  })
}

// 接口请求今日发布视频
const fetchContent = (page) => {
  console.log(`正在获取今日发布视频........ ${page}`)
  const date = formatDate(new Date(new Date().getTime() - 24 * 60 * 60 * 1000), 'yyyy-MM-dd')
  return new Promise((resolve, reject) => {
    axios.post('https://mp.xiaozhuyouban.com/mcn/content', {
      page,
      keywrod: '',
      start: formatDate(new Date(), 'yyyy-MM-dd'),
      end: formatDate(new Date(), 'yyyy-MM-dd'),
      state: 0
    }, {
      headers: {
        'accept': '*/*',
        'content-type': 'multipart/form-data',
        'host': 'mp.xiaozhuyouban.com',
        "origin": "https://mp.xiaozhuyouban.com",
        "referer": "https://mp.xiaozhuyouban.com/mcn/content",
        'Cookie': cookie,
        'X-CSRF-TOKEN': token,
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.131 Safari/537.36",
        "x-requested-with": "XMLHttpRequest"
      }
    }).then(res => {
      if (res.status === 200 && res.data.code == 0) {
        const { videos = [] } = res.data.data
        resolve({ suc: true, videos })
      } else {
        resolve({ suc: false })
        console.log('接口调用失败，请稍后重试。。。。。。。。。。。。')
      }
    }).catch(() => {
      resolve({ suc: false })
      console.log('接口调用失败，请稍后重试。。。。。。。。。。。。')
    })
  })
}
// 获取今日发布视频
const getContent = async () => {
  return new Promise((resolve, reject) => {
    let allVideos = [];
    let page = 1;
    const fetch = async () => {
      const incomes = await fetchContent(page);
      if (incomes.suc) {
        const { videos = [] } = incomes;
        allVideos = allVideos.concat(videos);
        page++;
        if (videos.length && allVideos.length < membersLength) {
          fetch();
        } else {
          resolve(allVideos)
        }
      } else {
        fetch();
      }
    }
    fetch();
  })
}

// 开始获取数据
const getPAccountData = async () => {
  const curAccount = PAccount[acIndex];
  const tk = await getCsrfToken();
  token = tk
  const ck = await loginXiaozhu(curAccount.account, curAccount.password);
  cookie = ck;
  const OrganizationName = await getAccountSetting();
  const amount = await getSettleCenter();
  const { dates } = await fetchMCNIncome();
  const members = await getMembers();
  const creators = await getIncome();
  const videos = await getContent();
  let memsMap = new Map();
  members.forEach(item => {
    if (memsMap.has(item.name)) {
      const mem = memsMap.get(item.name);
      memsMap.set(item.name, { ...mem, ...item });
    } else {
      memsMap.set(item.name, { ...item });
    }
  })
  creators.forEach(item => {
    if (memsMap.has(item.name)) {
      const mem = memsMap.get(item.name);
      memsMap.set(item.name, { ...mem, ...item });
    } else {
      memsMap.set(item.name, { ...item });
    }
  })
  const data = [...memsMap.values()].map(item => {
    return {
      ...item,
      level: item.w == 'Lv.2' ? 2 : item.w == 'Lv.1' ? 1 : 5
    }
  })
  PAccount[acIndex] = {
    OrganizationName,
    amount,
    dates,
    videos,
    ...PAccount[acIndex],
    members: data.sort((a, b) => a.level - b.level)
  }

  acIndex++
  if (acIndex <= PAccount.length - 1) {
    getPAccountData();
  } else {
    outputExcel()
  }
}

const getExcalData = (data) => {
  const result = [['账号', '子账号名称', '等级', '昨收', '昨天热度']]
  data.members.forEach(item => {
    result.push([
      item.mobile,
      item.name,
      item.w,
      item.money,
      item.views
    ])
  })
  return result
}

const getPAccountExcelData = (data) => {
  const first = ['母账号', '账号名称', '账号总收益',
    `${formatDate(new Date(new Date().getTime() - 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd')}收益`,
    `${formatDate(new Date(new Date().getTime() - 6 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd')}收益`,
    `${formatDate(new Date(new Date().getTime() - 5 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd')}收益`,
    `${formatDate(new Date(new Date().getTime() - 4 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd')}收益`,
    `${formatDate(new Date(new Date().getTime() - 3 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd')}收益`,
    `${formatDate(new Date(new Date().getTime() - 2 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd')}收益`,
    `${formatDate(new Date(new Date().getTime() - 24 * 60 * 60 * 1000), 'yyyy-MM-dd')}收益`,
    '子账号总数', '今日发布数量',]
  const result = [first]
  data.forEach(item => {
    result.push([
      item.account,
      item.OrganizationName,
      item.amount,
      item.dates[0].money,
      item.dates[1].money,
      item.dates[2].money,
      item.dates[3].money,
      item.dates[4].money,
      item.dates[5].money,
      item.dates[6].money,
      item.members.length,
      item.videos.length
    ])
  })
  return result
}


function outputExcel() {
  let data = [{
    name: '母账号总览',
    data: getPAccountExcelData(PAccount)
  }]
  PAccount.forEach(item => {
    data.push({
      name: item.OrganizationName,
      data: getExcalData(item)
    })
  })
  let buffer = nodeXlsx.build(data);
  console.log('表格导出中。。。。。。。')
  const fileName = `${formatDate(new Date(new Date().getTime() - 24 * 60 * 60 * 1000), 'yyyy-MM-dd')}账号数据.xlsx`
  fs.writeFileSync(fileName, buffer, { 'flag': 'w' });
  console.log('表格导出完成')
  open.exec(`start ${currentDir}/${fileName}`)
}

const getPAData = async () => {
  getDatas();
  getPAccountData();
}

module.exports = {
  getPAData
}