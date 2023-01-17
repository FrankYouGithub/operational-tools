/*
 * @Author       : frank
 * @Date         : 2022-10-05 22:11:48
 * @LastEditTime : 2023-01-17 13:22:44
 * @LastEditors  : frank
 * @Description  : In User Settings Edit
 */
const { fsExistsSync, getSuffix, readDir, outputJSON, formatDate, sortDateData } = require('../util');
const pwd = process.cwd(); // 当前执行程序的路径 同 path.resolve('./')
const fs = require("fs");              //操作文件，读写文件
const path = require('path');
const nodeXlsx = require('node-xlsx')	 //引用node-xlsx模块
const currentDir = pwd.substr(pwd.lastIndexOf('/') + 1);
const open = require('child_process');


const xlsxFiles = []; // 当前执行目录下所有的表格 {title,path}
const xlsxDatas = []; // 当前执行目录下所有的表格数据 {title,path,data}
let accountList = [];
const publishTimeMap = new Set();
let publishTimes = [];

const getFiles = (src) => {
  const files = readDir(src);  //读取源目录下的所有文件及文件夹
  files.forEach((file) => {
    const _src = path.join(src, file);
    if (fsExistsSync(_src)) {
      const stats = fs.statSync(_src);
      if (stats.isFile()) { //如果是个文件
        const suffix = getSuffix(file);
        if (suffix === '.csv') {
          const fileName = path.basename(file, '.csv');
          if (isNaN(fileName) && !isNaN(Date.parse(fileName))) {
            xlsxFiles.push({
              fileName,
              path: _src
            })
          }
        }
      } else if (stats.isDirectory()) { //是目录则 递归
        getFiles(_src);
      }
    } else {
      console.log(`处理 ${_src} 失败，请确认文件是否存在`);
    }
  });
}
const getDatas = () => {
  xlsxFiles.forEach(item => {
    let data = {}
    const excel = nodeXlsx.parse(item.path)[0].data;
    excel.shift();
    let account = null;
    let videos = [];
    for (let i = 0; i < excel.length; i++) {
      const val = excel[i];
      if (val[0]) {
        if (account) {
          data[account.accountName] = {
            ...account,
            videos,
          }
        }
        account = {
          accountName: val[0],
          accountTotalProfit: val[1],
          accountCurrentProfit: val[2],
          accountCurrentViews: val[3],
        }
        videos = []
      } else {
        const publishTime = formatDate(new Date(val[11]), 'yyyy-MM-dd');
        videos.push({
          name: val[6],
          currentProfit: val[7],
          views: val[8],
          link: val[9],
          quality: val[10] || '',
          publishTime,
          copyright: val[12],
          category: val[6].split('：')[0]
        })
        publishTimeMap.add(publishTime)
        if (i === excel.length - 1) {
          if (account) {
            data[account.name] = {
              ...account,
              videos,
            }
          }
        }
      }
    }
    xlsxDatas.push({
      ...item,
      excelData: data
    })
  })
  publishTimes = [...publishTimeMap].sort(sortDateData(true))
  console.log(publishTimes)
}

const getAccountData = () => {
  console.log('数据处理中........')
  const data = new Map();
  xlsxDatas.map(item => {
    for (const key in item.excelData) {
      const element = item.excelData[key];
      if (data.has(key)) {
        const arr = data.get(key);
        data.set(key, [...arr, element]);
      } else {
        data.set(key, [element]);
      }
    }
  })
  const arrData = [...data.values()]
  const accountData = [
    [
      '账号',
      '总热度',
      '总收益',
      '视频发布数量',
      '差评视频数量',
      '差评视频链接'
    ]
  ];
  // outputJSON(arrData)
  accountList = arrData;
  arrData.map((item) => {
    const { accountName } = item[0];
    let accountTotalViews = 0, accountTotalProfit = 0;
    const badRel = new Map()
    const videoMap = new Map();
    item.map((val) => {
      accountTotalViews = accountTotalViews + parseFloat(val.accountCurrentViews)
      accountTotalProfit = accountTotalProfit + parseFloat(val.accountCurrentProfit)
      val.videos.map(video => {
        if (video.quality === '差') {
          if (!badRel.has(video.name)) {
            badRel.set(video.name, video.link)
          }
        }
        if (videoMap.has(video.name)) { // 处理跨周期视频
          const arr = videoMap.get(video.name);
          videoMap.set(video.name, [...arr, video]);
        } else {
          videoMap.set(video.name, [video])
        }
      })
    })
    accountData.push([
      accountName,
      accountTotalViews,
      accountTotalProfit,
      videoMap.size,
      badRel.size,
      [...badRel.values()].toString()
    ])
  })
  return accountData
}

const getOneDayDramaData = (videoList, date) => {
  const newVideos = videoList.filter(video => video.publishTime === date)
  const dramaMap = new Map();
  newVideos.map(video => {
    if (dramaMap.has(video.category)) {
      const arr = dramaMap.get(video.category)
      dramaMap.set(video.category, [...arr, video])
    } else {
      dramaMap.set(video.category, [video])
    }
  })
  const dramaList = [...dramaMap.values()];
  const result = [[], [], [], [`${date}单日上传的视频数据汇总计算`], [
    '版权', '总收益', '总热度', '视频数量', '单条视频平均收益', '单条视频平均热度'
  ]]
  dramaList.map(item => {
    let amount = 0, allViews = 0;
    item.map(video => {
      amount = amount + parseFloat(video.currentProfit)
      allViews = allViews + parseInt(video.views)
    })
    result.push([
      item[0].category,
      amount,
      allViews,
      item.length,
      Number(amount / item.length).toFixed(2),
      Number(allViews / item.length).toFixed(2),
    ])
  })
  result.sort((a, b) => b[4] - a[4])

  return result
}

const getDramaDataWithDuration = (latelyDuration) => {
  const videoMap = new Map();
  const dates = publishTimes.slice(-latelyDuration);
  accountList.map(account => {
    account.map(item => {
      item.videos.map(video => {
        if (dates.indexOf(video.publishTime) > -1) {
          if (videoMap.has(video.name)) {
            const data = videoMap.get(video.name);
            videoMap.set(video.name, {
              ...data,
              "views": parseInt(video.views) + parseInt(data.views),
              "currentProfit": parseFloat(video.currentProfit) + parseFloat(data.currentProfit)
            })
          } else {
            videoMap.set(video.name, video)
          }
        }
      })
    })
  })
  const videoList = [...videoMap.values()].filter(video => video.quality !== '好' && video.quality !== '差');
  const dramaMap = new Map();
  videoList.map(video => {
    if (dramaMap.has(video.category)) {
      const arr = dramaMap.get(video.category)
      dramaMap.set(video.category, [...arr, video])
    } else {
      dramaMap.set(video.category, [video])
    }
  })
  const dramaList = [...dramaMap.values()];

  const data = [[`以下数据为日期：${dates.toString()} 上传的视频数据`], [
    '版权', '总收益', '总热度', '视频数量', '单条视频平均收益', '单条视频平均热度'
  ]]
  dramaList.map(item => {
    let amount = 0, allViews = 0;
    item.map(video => {
      amount = amount + parseFloat(video.currentProfit)
      allViews = allViews + parseInt(video.views)
    })
    data.push([
      item[0].category,
      amount,
      allViews,
      item.length,
      Number(amount / item.length).toFixed(2),
      Number(allViews / item.length).toFixed(2),
    ])
  })
  data.sort((a, b) => b[4] - a[4])
  let dayData = [];
  if (dates.length > 1) {
    dates.map(date => {
      dayData = dayData.concat(getOneDayDramaData(videoList, date))
    })
  }
  return data.concat(dayData)
}

function outputExcel() {
  let buffer = nodeXlsx.build([
    {
      name: `${publishTimes[0]}~${publishTimes[publishTimes.length - 1]}账号数据`, // sheet name
      data: getAccountData(),  // current sheet data
    },
    {
      name: '每日数据统计',
      data: getDramaDataWithDuration(publishTimes.length),
    },
    {
      name: `最近14天上传视频单剧数据`, // sheet name
      data: getDramaDataWithDuration(14),  // current sheet data
    },
    {
      name: `最近7天上传视频单剧数据`, // sheet name
      data: getDramaDataWithDuration(7),  // current sheet data
    },
    {
      name: `最近3天上传视频单剧数据`, // sheet name
      data: getDramaDataWithDuration(3),  // current sheet data
    },
  ]);
  console.log('表格导出中。。。。。。。')
  const fileName = `${publishTimes[0]}~${publishTimes[publishTimes.length - 1]}运营数据.xlsx`
  fs.writeFileSync(fileName, buffer, { 'flag': 'w' });
  console.log('表格导出完成')
  open.exec(`start ${currentDir}/${fileName}`)
}

const getTPData = async () => {
  getFiles(pwd);
  getDatas();
  outputExcel()
}

module.exports = {
  getTPData
}