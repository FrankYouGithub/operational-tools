/*
 * @Author       : frank
 * @Date         : 2022-10-05 22:11:48
 * @LastEditTime : 2023-03-13 10:16:31
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
let begin, end;


const getMatch = () => {
  const excel = nodeXlsx.parse(path.join(pwd, 'match.xlsx'))	//读取excel表格
  begin = excel[0].data[0][0]
  end = excel[0].data[1][0]
}

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
            oldPath: _src,
            basePath: src,
            type: 'mp4'
          })
        } else if (suffix === '.jpg') {
          titleList.push({
            title: path.basename(file, '.jpg'),
            oldPath: _src,
            basePath: src,
            type: 'jpg'
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

const startReName = () => {
  titleList.forEach(item => {
    if (item.type === 'mp4') {
      fs.renameSync(item.oldPath, path.join(item.basePath, `${begin}${item.title}${end}.mp4`))
    } else if (item.type === 'jpg') {
      fs.renameSync(item.oldPath, path.join(item.basePath, `${begin}${item.title}.jpg`))
    }
  })
}


const reTpFileName = async () => {
  getMatch()
  getTitle(pwd)
  startReName()
  console.log('修改名称成功')
}

module.exports = {
  reTpFileName
}