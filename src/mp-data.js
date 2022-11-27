/*
 * @Author       : frank
 * @Date         : 2022-10-05 22:11:48
 * @LastEditTime : 2022-11-27 20:44:55
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


const xlsxFiles = []; // 当前执行目录下所有的表格 {fileName,path}
const xlsxDatas = []; // 当前执行目录下所有的表格数据 {fileName,path,data}
let v5 = [], v2 = [], v1 = [], v5_hj = [], v5_js = [], v0 = [];
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
          data[account.name] = {
            ...account,
            videos,
          }
        }
        account = {
          name: val[0],
          level: val[1],
          type: val[2],
          totalProfit: val[3],
          currentProfit: val[4],
          views: val[5],
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
  const accountMap = new Map();

  xlsxDatas.map(item => {
    for (const key in item.excelData) {
      const element = item.excelData[key];
      if (accountMap.has(key)) {
        const arr = accountMap.get(key);
        accountMap.set(key, [...arr, element]);
      } else {
        accountMap.set(key, [element]);
      }
    }
  })
  const accountData = [...accountMap.values()]
  accountData.sort((a, b) => b[0].level - a[0].level)

  v5 = accountData.filter(item => item[0].level === '5')
  v5_hj = v5.filter(item => item[0].type === '混剪')
  v5_js = v5.filter(item => item[0].type === '解说')
  v2 = accountData.filter(item => item[0].level === '2')
  v1 = accountData.filter(item => item[0].level === '1')
  v0 = accountData.filter(item => item[0].level === '0')
  const data = [
    [
      '账号',
      '等级',
      '垂类',
      '总收益',
      '总热度',
      '视频数量',
      '单条视频平均收益',
      '好评数',
      '好评视频链接',
      '差评数',
      '差评视频链接',
    ]
  ];
  accountData.map((item) => {
    const { name, level, type } = item[0];
    const videoSet = new Set();
    const wellVideo = new Map();
    const badVideo = new Map();
    let amount = 0, views = 0
    item.map((account) => {
      amount = amount + parseFloat(account.currentProfit)
      views = views + parseInt(account.views)
      account.videos.map(video => {
        videoSet.add(video.name)
        if (video.quality === '好' && !wellVideo.has(video.name)) {
          wellVideo.set(video.name, video.link)
        }
        if (video.quality === '差' && !badVideo.has(video.name)) {
          badVideo.set(video.name, video.link)
        }
      })
    })
    data.push([
      name,
      level,
      type,
      amount,
      views,
      videoSet.size,
      Number(amount / videoSet.size).toFixed(2),
      wellVideo.size,
      [...wellVideo.values()].toString(),
      badVideo.size,
      [...badVideo.values()].toString()
    ])
  })
  return data
}

const getOneDayDramaData = (videoList, date) => {
  const newVideos = videoList.filter(video => video.publishTime === date)
  if (date == '2022-10-24') {
    // outputJSON(newVideos)
  }
  const dramaMap = new Map();
  newVideos.map(video => {
    if (dramaMap.has(video.copyright)) {
      const arr = dramaMap.get(video.copyright)
      dramaMap.set(video.copyright, [...arr, video])
    } else {
      dramaMap.set(video.copyright, [video])
    }
  })
  const dramaList = [...dramaMap.values()];
  const result = [[], [], [], [`${date}单日上传的视频数据汇总计算`], [
    '剧名', '总收益', '总热度', '视频数量', '单条视频平均收益', '单条视频平均热度'
  ]]
  dramaList.map(item => {
    let amount = 0, allViews = 0;
    item.map(video => {
      amount = amount + parseFloat(video.currentProfit)
      allViews = allViews + parseInt(video.views)
    })
    result.push([
      item[0].copyright,
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

const getDramaDataWithDuration = (data, latelyDuration, title) => {
  const dates = publishTimes.slice(-latelyDuration);
  const videoMap = new Map();
  data.map(item => {
    item.map(account => {
      account.videos.map(video => {
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
  // outputJSON(videoList)
  const dramaMap = new Map();
  videoList.map(video => {
    if (dramaMap.has(video.copyright)) {
      const arr = dramaMap.get(video.copyright)
      dramaMap.set(video.copyright, [...arr, video])
    } else {
      dramaMap.set(video.copyright, [video])
    }
  })
  const dramaList = [...dramaMap.values()];
  const result = [[title], [`以下数据为日期：${dates.toString()} 上传的视频数据汇总计算`], [
    '剧名', '总收益', '总热度', '视频数量', '单条视频平均收益', '单条视频平均热度'
  ]]
  dramaList.map(item => {
    let amount = 0, allViews = 0;
    item.map(video => {
      amount = amount + parseFloat(video.currentProfit)
      allViews = allViews + parseInt(video.views)
    })
    result.push([
      item[0].copyright,
      amount,
      allViews,
      item.length,
      Number(amount / item.length).toFixed(2),
      Number(allViews / item.length).toFixed(2),
    ])
  })
  result.sort((a, b) => b[4] - a[4])
  let dayData = [];
  if (dates.length > 1) {
    dates.map(date => {
      dayData = dayData.concat(getOneDayDramaData(videoList, date))
    })
  }

  return result.concat(dayData)
}

const getDramaFinishDataWithDuration = (data, latelyDuration, title) => {
  const dates = publishTimes.slice(0, latelyDuration);
  const videoMap = new Map();
  data.map(item => {
    item.map(account => {
      account.videos.map(video => {
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
  // outputJSON(videoList)
  const dramaMap = new Map();
  videoList.map(video => {
    if (dramaMap.has(video.copyright)) {
      const arr = dramaMap.get(video.copyright)
      dramaMap.set(video.copyright, [...arr, video])
    } else {
      dramaMap.set(video.copyright, [video])
    }
  })
  const dramaList = [...dramaMap.values()];
  const result = [[title], [`以下数据为日期：${dates.toString()} 上传的视频数据汇总计算`], [
    '剧名', '总收益', '总热度', '视频数量', '单条视频平均收益', '单条视频平均热度'
  ]]
  dramaList.map(item => {
    let amount = 0, allViews = 0;
    item.map(video => {
      amount = amount + parseFloat(video.currentProfit)
      allViews = allViews + parseInt(video.views)
    })
    result.push([
      item[0].copyright,
      amount,
      allViews,
      item.length,
      Number(amount / item.length).toFixed(2),
      Number(allViews / item.length).toFixed(2),
    ])
  })
  result.sort((a, b) => b[4] - a[4])
  let dayData = [];
  if (dates.length > 1) {
    dates.map(date => {
      dayData = dayData.concat(getOneDayDramaData(videoList, date))
    })
  }

  return result.concat(dayData)
}

function outputExcel() {
  let sheets = [
    {
      name: `${publishTimes[0]}~${publishTimes[publishTimes.length - 1]}账号数据`, // sheet name
      data: getAccountData(),  // current sheet data
    }
  ];
  if (v5_hj.length) {
    sheets = sheets.concat([
      {
        name: 'V5混剪账号-已跑完数据统计',
        data: getDramaFinishDataWithDuration(v5_hj, publishTimes.length - 10, 'V5混剪账号-已跑完数据统计'),
      },
      {
        name: 'V5混剪账号-最近14天上传视频单剧数据', // sheet name
        data: getDramaDataWithDuration(v5_hj, 14, 'V5混剪账号最近14天上传视频单剧数据'),  // current sheet data
      },
      {
        name: 'V5混剪账号-最近7天上传视频单剧数据', // sheet name
        data: getDramaDataWithDuration(v5_hj, 7, 'V5混剪账号最近7天上传视频单剧数据'),  // current sheet data
      },
      {
        name: 'V5混剪账号-最近3天上传视频单剧数据', // sheet name
        data: getDramaDataWithDuration(v5_hj, 3, 'V5混剪账号最近3天上传视频单剧数据'),  // current sheet data
      },
    ])
  }
  if (v5_js.length) {
    sheets = sheets.concat([
      {
        name: 'V5解说账号-已跑完数据统计',
        data: getDramaFinishDataWithDuration(v5_js, publishTimes.length - 10, 'V5解说账号-已跑完数据统计'),
      },
      {
        name: 'V5解说账号-最近14天上传视频单剧数据', // sheet name
        data: getDramaDataWithDuration(v5_js, 14, 'V5解说账号最近14天上传视频单剧数据'),  // current sheet data
      },
      {
        name: 'V5解说账号-最近7天上传视频单剧数据', // sheet name
        data: getDramaDataWithDuration(v5_js, 7, 'V5解说账号最近7天上传视频单剧数据'),  // current sheet data
      },
      {
        name: 'V5解说账号-最近3天上传视频单剧数据', // sheet name
        data: getDramaDataWithDuration(v5_js, 3, 'V5解说账号最近3天上传视频单剧数据'),  // current sheet data
      },
    ])
  }
  if (v2.length) {
    sheets = sheets.concat([
      {
        name: 'V2账号-已跑完数据统计',
        data: getDramaFinishDataWithDuration(v2, publishTimes.length - 10, 'V2账号-已跑完数据统计'),
      },
      {
        name: 'V2账号-最近14天上传视频单剧数据', // sheet name
        data: getDramaDataWithDuration(v2, 14, 'V2账号最近14天上传视频单剧数据'),  // current sheet data
      },
      {
        name: 'V2账号-最近7天上传视频单剧数据', // sheet name
        data: getDramaDataWithDuration(v2, 7, 'V2账号最近7天上传视频单剧数据'),  // current sheet data
      },
      {
        name: 'V2账号-最近3天上传视频单剧数据', // sheet name
        data: getDramaDataWithDuration(v2, 3, 'V2账号最近3天上传视频单剧数据'),  // current sheet data
      },
    ])
  }
  if (v1.length) {
    sheets = sheets.concat([
      {
        name: 'V1账号-已跑完数据统计',
        data: getDramaFinishDataWithDuration(v1, publishTimes.length - 10, 'V1账号-已跑完数据统计'),
      },
      {
        name: 'V1账号-最近14天上传视频单剧数据', // sheet name
        data: getDramaDataWithDuration(v1, 14, 'V1账号最近14天上传视频单剧数据'),  // current sheet data
      },
      {
        name: 'V1账号-最近7天上传视频单剧数据', // sheet name
        data: getDramaDataWithDuration(v1, 7, 'V1账号最近7天上传视频单剧数据'),  // current sheet data
      },
      {
        name: 'V1账号-最近3天上传视频单剧数据', // sheet name
        data: getDramaDataWithDuration(v1, 3, 'V1账号最近3天上传视频单剧数据'),  // current sheet data
      },
    ])
  }
  if (v0.length) {
    sheets = sheets.concat([
      {
        name: 'V0账号-已跑完数据统计',
        data: getDramaFinishDataWithDuration(v0, publishTimes.length - 10, 'V1账号-已跑完数据统计'),
      },
      {
        name: 'V0账号-最近14天上传视频单剧数据', // sheet name
        data: getDramaDataWithDuration(v0, 14, 'V0账号最近14天上传视频单剧数据'),  // current sheet data
      },
      {
        name: 'V0账号-最近7天上传视频单剧数据', // sheet name
        data: getDramaDataWithDuration(v0, 7, 'V0账号最近7天上传视频单剧数据'),  // current sheet data
      },
      {
        name: 'V0账号-最近3天上传视频单剧数据', // sheet name
        data: getDramaDataWithDuration(v0, 3, 'V0账号最近3天上传视频单剧数据'),  // current sheet data
      },
    ])
  }
  let buffer = nodeXlsx.build(sheets);
  console.log('表格导出中。。。。。。。')
  const fileName = `${publishTimes[0]}~${publishTimes[publishTimes.length - 1]}运营数据.xlsx`
  fs.writeFileSync(fileName, buffer, { 'flag': 'w' });
  console.log('表格导出完成')
  open.exec(`start ${currentDir}/${fileName}`)
}

const getMPData = async () => {
  getFiles(pwd);
  getDatas();
  outputExcel();
  console.log(publishTimes.length)
}

module.exports = {
  getMPData
}