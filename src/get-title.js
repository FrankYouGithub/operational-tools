/*
 * @Author       : frank
 * @Date         : 2022-10-05 22:11:48
 * @LastEditTime : 2022-12-09 17:29:08
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

let titleList = [];
// 获取当前文件夹下的所有 .mp4 文件的标题
const getTitle = (src) => {
  const files = readDir(src);  //读取源目录下的所有文件及文件夹
  files.forEach((file) => {
    const _src = path.join(src, file);
    if (fsExistsSync(_src)) {
      const stats = fs.statSync(_src);
      if (stats.isFile()) {
        const suffix = getSuffix(file);
        if (suffix === '.mp4') {
          titleList.push({
            title: path.basename(file, '.mp4'),
            path: _src
          })
        }
      } else if (stats.isDirectory()) { //是目录则 递归
        getTitle(_src);
      }
    } else {
      console.log(`处理 ${_src} 失败，请确认文件是否存在`);
    }
  });
}

const getOnlyTitle = () => {
  const titles = []
  titleList.map(item => {
    titles.push([item.title])
  })
  return titles
}

function outputExcel() {
  let buffer = nodeXlsx.build([
    {
      name: '每日数据统计',
      data: getOnlyTitle(),
    }
  ]);
  console.log('表格导出中。。。。。。。')
  const fileName = `标题${new Date().getTime()}.xlsx`
  fs.writeFileSync(fileName, buffer, { 'flag': 'w' });
  console.log('表格导出完成')
  open.exec(`start ${currentDir}/${fileName}`)
}

const getFileName = async () => {
  getTitle(pwd)
  outputExcel()
}

module.exports = {
  getFileName
}