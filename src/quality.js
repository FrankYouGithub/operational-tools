/*
 * @Author       : frank
 * @Date         : 2022-10-05 22:11:48
 * @LastEditTime : 2023-04-09 15:17:15
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
        resolve(allVideos)
      } else {
        fetch();
      }
    }
    fetch();
  })
}

const getExcelData = () => {
  const data = [];
  PAccount.forEach(item => {
    data.push(['账号：', item.account])
    data.push(['标题', '视频链接', '版权', '发布时间', '质量码', '质量', '热度值'])
    item.videos.forEach(video => {
      data.push([video.title, `https://mp.xiaozhuyouban.com/watch/${video.vid}`, video.source, video.time, video.quality, video.qualitystr, video.views])
    })
    data.push([])
    data.push([])
  })
  return data;
}

function outputExcel() {
  const result = getExcelData();
  let buffer = nodeXlsx.build([
    {
      name: '子账号视频质量表',
      data: result,
    }
  ]);
  console.log('表格导出中。。。。。。。')
  const fileName = `子账号视频质量表-${new Date().getTime()}.xlsx`
  fs.writeFileSync(fileName, buffer, { 'flag': 'w' });
  console.log('表格导出完成')
  open.exec(`start ${currentDir}/${fileName}`)
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
  PAccount[acIndex]['videos'] = videos
  if (acIndex === PAccount.length - 1) {
    outputExcel()
    // outputJSON(PAccount);
  } else {
    acIndex++;
    setTimeout(() => {
      getPAccountData();
    }, 10000);
  }
}


const getQuality = async () => {
  getDatas();
  getPAccountData();
}

module.exports = {
  getQuality
}