#!/usr/bin/env node
const fs = require("fs");              //操作文件，读写文件
const path = require('path');
const cheerio = require("cheerio");    //扩展模块
const axios = require('axios');
const nodeXlsx = require('node-xlsx')	 //引用node-xlsx模块
const { fsExistsSync, getSuffix, copyWithStream, printHelp, readDir, outputHtml, similar, formatDate } = require('./util');
const { getMPData } = require('./src/mp-data');
const { getTPData } = require('./src/tp-data');
const { getPAData } = require('./src/pa-data');
const { getFileName } = require('./src/get-title');
const { deleteVideos } = require('./src/mp-delete');
const { reTpFileName } = require('./src/rename');
const { moveFile } = require('./src/move');
const { reImageSuffix } = require('./src/resuffix');
const { getChild } = require('./src/get-child');
const { getQuality } = require('./src/quality');
const { getChildId } = require('./src/get-child-id');

axios.defaults.withCredentials = true
const pwd = process.cwd(); // 当前执行程序的路径 同 path.resolve('./')
const currentDir = pwd.substr(pwd.lastIndexOf('/') + 1);  // 当前执行程序所在的文件名
const pwd_ = path.resolve(pwd, '..');  // 当前执行程序的路径的上一级路径
const mode = process.argv[2]; // 命令 tit_check
const type = process.argv[3]; // 第三条命令
const targetPath = process.argv[3] || path.join(pwd_, `${currentDir}_`); // 目标存放目录(用户数据 或 默认当前执行程序的路径的上一级路径+当前文件夹名+_)

// const excel = nodeXlsx.parse(path.join(__dirname, 'account.xlsx'))	//读取excel表格
// const account = excel[0] //所有账号
if (!mode) {   // 没有输入命令 return
  printHelp()
  return
}


let cookie = ''
let token = ''
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
      console.log(res)
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
        console.log(`账号登陆失败.......正在重新登陆........`)
      }
    }).catch(error => {
      reject(error)
      console.log(`账号登陆失败.......正在重新登陆........`)
    })
  })
}
// 拉取小猪电视剧版权库
let page = 1;
const copyrightList = [];
const getCopyRight = () => {
  axios.post('https://mp.xiaozhuyouban.com/copyright/resource', {
    keyword: '',
    year: 0,
    region: 0,
    genre: '电视剧',
    level: 0,
    level1: 0,
    creator_type: 0,
    hot: 0,
    score: 0,
    onstatus: 0,
    page,
  }, {
    headers: {
      'accept': '*/*',
      'content-type': 'multipart/form-data',
      'host': 'mp.xiaozhuyouban.com',
      "origin": "https://mp.xiaozhuyouban.com",
      "referer": "https://mp.xiaozhuyouban.com/copyright/resource",
      'Cookie': cookie,
      'X-CSRF-TOKEN': token,
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.131 Safari/537.36",
      "x-requested-with": "XMLHttpRequest"
    }
  }).then(res => {
    if (res.status === 200 && res.data.code == 0) {
      const { resource = [] } = res.data.data
      copyrightList.push(...resource)
      console.log(`已加载 ${page} 页，总计：${copyrightList.length} 条`)
      if (resource.length === 15) {
        page++;
        getCopyRight();
      } else {
        console.log('===========================版权库加载完成===============================')
        console.log('总条数：', copyrightList.length)
        outputExcel('copyright-list.xlsx');
      }
    } else {
      getCopyRight();
    }
  }).catch(error => {
    console.log(error)
    getCopyRight();
  })
}
// 拉取小猪已下架版权库
const getRemovedCopyRight = () => {
  axios.post('https://mp.xiaozhuyouban.com/resourcelist', {
    page,
  }, {
    headers: {
      'accept': '*/*',
      'content-type': 'multipart/form-data',
      'host': 'mp.xiaozhuyouban.com',
      "origin": "https://mp.xiaozhuyouban.com",
      "referer": "https://mp.xiaozhuyouban.com/resourcelist",
      'Cookie': cookie,
      'X-CSRF-TOKEN': token,
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.131 Safari/537.36",
      "x-requested-with": "XMLHttpRequest"
    }
  }).then(res => {
    if (res.status === 200 && res.data.code == 0) {
      const { resource = [] } = res.data.data
      copyrightList.push(...resource)
      console.log(`已加载 ${page} 页，总计：${copyrightList.length} 条`)
      if (resource.length === 15) {
        page++;
        getRemovedCopyRight();
      } else {
        console.log('===========================已下架版权库加载完成===============================')
        console.log('总条数：', copyrightList.length)
        outputExcel(`removed-copyright-list.xlsx`);
      }
    } else {
      getRemovedCopyRight();
    }
  }).catch(error => {
    console.log(error)
    getRemovedCopyRight();
  })
}

function outputExcel(fileName) {
  const excelList = copyrightList.map(item => [item.title || item.subject, item.category || '', item.level || '', item.genre || '']);
  let buffer = nodeXlsx.build([
    {
      name: 'sheet1',
      data: excelList
    }
  ]);
  console.log('表格导出中。。。。。。。')
  fs.writeFileSync(path.join(__dirname, fileName), buffer, { 'flag': 'w' });
  console.log('表格导出完成')
}

const getXiaozhuCopyright = async () => {
  const tk = await getCsrfToken();
  token = tk;
  const ck = await loginXiaozhu();
  cookie = ck;
  getCopyRight();
}
const getXiaozhuRemovedCopyright = async () => {
  const tk = await getCsrfToken();
  token = tk
  const ck = await loginXiaozhu();
  cookie = ck;
  getRemovedCopyRight();
}

// 小猪接口拉取视频统计
const fetchVideoAnalysis = (start, end, page) => {
  return new Promise((resolve, reject) => {
    axios.post('https://mp.xiaozhuyouban.com/content/analysis', {
      keyword: '',
      start,
      end,
      page
    }, {
      headers: {
        'accept': '*/*',
        'content-type': 'multipart/form-data',
        'host': 'mp.xiaozhuyouban.com',
        "origin": "https://mp.xiaozhuyouban.com",
        "referer": "https://mp.xiaozhuyouban.com/content/analysis",
        'Cookie': cookie,
        'X-CSRF-TOKEN': token,
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
      if (res.status === 200 && res.data.code == 0) {
        const { videos = [] } = res.data.data
        resolve(videos)
      } else {
        reject('error')
      }
    }).catch(error => {
      reject(error)
    })
  })
}
const getVideoAnalysis = async () => {
  let curAccountVideos = [];
  const end = formatDate(new Date(), 'yyyy-MM-dd')
  const start = formatDate(new Date(new Date().getTime() - (14 * 24 * 60 * 60 * 1000)), 'yyyy-MM-dd')
  let page = 1
  const getList = async () => {
    const list = await fetchVideoAnalysis(start, end, page)
    curAccountVideos = curAccountVideos.concat(list)
    if (list.length === 10) {
      page = page + 1
      getList()
    } else {
      console.log(curAccountVideos)
      console.log(curAccountVideos.length)
    }
  }
  getList()
}

const getTokenAndLogin = async (cb) => {
  const tk = await getCsrfToken();
  token = tk;
  const ck = await loginXiaozhu();
  cookie = ck;
  cb()
}

const getIncomeAnalysis = () => {
  console.log('获取收益统计......')
  return new Promise((resolve, reject) => {
    axios.get('https://mp.xiaozhuyouban.com/settlement/analysis', {
      headers: {
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
        "origin": "https://mp.xiaozhuyouban.com",
        "referer": "https://mp.xiaozhuyouban.com/settlement/analysis",
        'host': 'mp.xiaozhuyouban.com',
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.131 Safari/537.36",
        "x-requested-with": "XMLHttpRequest",
        'Cookie': cookie,
        'X-CSRF-TOKEN': token,
      }
    }).then(res => {
      if (res.status === 200) {
        const $ = cheerio.load(res.data);
        const list = $('.totals-list li');
        const incomeData = [];
        list.each((index, element) => {
          console.log(index, element)
        })
        // for (const key in list) {
        //   const element = list[key];
        //   console.log($(element).text())
        // }
        // console.log(incomeData)
      } else {
        console.log('获取收益统计失败，正在重试......')
        reject(null)
      }
    }).catch(err => {
      console.log('获取收益统计失败，正在重试......')
      reject(err)
    })
  })
}

switch (mode) {
  case 'tp':
    console.log('开始获取体育包运营数据......')
    getTPData();
    break;
  case 'mp':
    console.log('开始获取影视包运营数据......')
    getMPData();
    break;
  case 'pa': // 拉取母账号数据
    console.log('开始获取母账号数据..........')
    getPAData()
    break;
  case 'title':
    console.log('开始获取标题..........')
    getFileName()
    break;
  case 'delete':
    console.log('开始删除子账号视频......')
    deleteVideos();
    break;
  case 'rename':
    console.log('开始修改文件名称')
    reTpFileName();
    break;
  case 'move':
    moveFile()
    break;
  case 'resuffix':
    reImageSuffix();
    break;
  case 'getchild':
    getChild();
    break;
  case 'quality':
    getQuality();
    break;
  case 'getChildId':
    getChildId();
    break;
  default:
    printHelp()
    break;
}