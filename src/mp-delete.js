/*
 * @Author       : frank
 * @Date         : 2022-10-05 22:11:48
 * @LastEditTime : 2023-02-14 16:06:26
 * @LastEditors  : frank
 * @Description  : In User Settings Edit
 */
const { formatDate, saveLocalJSON, getLocalJSON, fsExistsSync, outputJSON } = require('../util');
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

// 获取本地子账号列表
const getDatas = () => {
  const account = nodeXlsx.parse(path.join(pwd, 'account.xlsx'))[0].data	//读取excel表格
  account.forEach(item => {
    if (item[0] && item[1]) {
      PAccount.push({
        account: item[0],
        password: item[1]
      })
    }
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
      agree: 'on',
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

// 接口请求今日发布视频
const fetchContent = (page) => {
  console.log(`正在获取账号所有发布视频........ ${page}`)
  const date = formatDate(new Date(new Date().getTime() - 24 * 60 * 60 * 1000), 'yyyy-MM-dd')
  return new Promise((resolve, reject) => {
    axios.post('https://mp.xiaozhuyouban.com/content/manage', {
      page,
      type: 'content',
      state: '',
      quality: '',
      status: '',
      start: '2022-08-01',
      end: formatDate(new Date(), 'yyyy-MM-dd'),
    }, {
      headers: {
        'accept': '*/*',
        'content-type': 'multipart/form-data',
        'host': 'mp.xiaozhuyouban.com',
        "origin": "https://mp.xiaozhuyouban.com",
        "referer": "https://mp.xiaozhuyouban.com/content/manage",
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
        if (videos.length && videos.length == 10) {
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

const fetchDeleteVideo = (vid) => {
  console.log('正在删除视频。。。。。。', vid)
  return new Promise((resolve, reject) => {
    axios.post('https://mp.xiaozhuyouban.com/content/manage', {
      action: 'delete',
      vid: vid,
    }, {
      headers: {
        'accept': '*/*',
        'content-type': 'multipart/form-data',
        'host': 'mp.xiaozhuyouban.com',
        "origin": "https://mp.xiaozhuyouban.com",
        "referer": "https://mp.xiaozhuyouban.com/content/manage",
        'Cookie': cookie,
        'X-CSRF-TOKEN': token,
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.131 Safari/537.36",
        "x-requested-with": "XMLHttpRequest"
      }
    }).then(res => {
      console.log(res.data)
      setTimeout(() => {
        resolve({ suc: true })
      }, 10000);
    }).catch(() => {
      resolve({ suc: false })
      console.log('接口调用失败，请稍后重试。。。。。。。。。。。。')
    })
  })
}

const delVideos = async (videos) => {
  let index = 0;
  const fetch = async () => {
    if (videos[index].time < '2023-01-30') {
      const res = await fetchDeleteVideo(videos[index].vid);
      if (res.suc) {
        if (index == videos.length - 1) {
          if (acIndex == PAccount.length - 1) {
            return
          } else {
            acIndex++
            getPAccountData()
          }
        } else {
          index++
          fetch();
        }
      } else {
        fetch();
      }
    } else {
      if (index == videos.length - 1) {
        if (acIndex == PAccount.length - 1) {
          return
        } else {
          acIndex++
          getPAccountData()
        }
      } else {
        index++
        fetch();
      }
    }
  }
  fetch();
}


// 开始获取数据
const getPAccountData = async () => {
  const curAccount = PAccount[acIndex];
  const tk = await getCsrfToken();
  token = tk
  const ck = await loginXiaozhu(curAccount.account, curAccount.password);
  cookie = ck;
  const videos = await getContent();
  console.log(videos.length)
  delVideos(videos)
}


const deleteVideos = async () => {
  getDatas();
  getPAccountData();
}

module.exports = {
  deleteVideos
}