const path = require('path');
const fs = require('fs');
const originRequest = require('request');
const cheerio = require('cheerio');
const iconv = require('iconv-lite');
// async的目的就是让多个异步的程序,按照开发者想要的顺序来执行,代码书写符合同步风格,其实运行还是异步的,也解决了回调金字塔的问题.
const async = require('async');

// 文件存储位置
const file = path.join(__dirname + '/data/data.json');
// 日志
const fileLog = path.join(__dirname + '/log/log.txt');
// 国家统计局城市 2018年
const city_url = 'http://www.stats.gov.cn/tjsj/tjbz/tjyqhdmhcxhfdm/2018/';

// 请求函数
function request (url, callback) {
    var options = {
        url: url,
        encoding: null,
    }
    originRequest(options, callback)
}
// 存储区  存储所有的城市
let arrAll = [];
let i = 0;
/**
 * 
 * @param {string} url 请求的html
 * @param {array} arr 存储的位置
 * @param {number} level 级数
 * @param {string} text 请求的那个父级下的城市
 * @param {function} callback 回调函数
 */
function getCitys (url, arr, level, text, callback) {
    /**
     *  level 请求的级数
     *  1 省级
     *  2 市级
     *  3 县/区级
     *  4 需自己去看
     */
    let l = 3;
    if (level > l) {
        write(arrAll);
        return;
    }
    i++;
    // 存储本轮中产生的子请求
    let task = [];
    request(url, function (err, res, body) {
        /**
         * 判断是否请求成功，失败的话，重新提交本次请求
         */
        if (!body) {
            console.log('重试');
            setTimeout(() => {
                getCitys(url, arr, level, text, callback);
            }, 500);
            writeLog({
                tag: text,
                level: level,
                url: url
            });
            return;
        }
        console.log('----' + text + '开始');
        // 设置编码格式
        let html = iconv.decode(body, 'gb2312');
        let $ = cheerio.load(html, { decodeEntities: false });

        /**
         *  获取地点 正常都在 td的a标签下
         *          有些地方的市辖区不在a标签下，没有获取，如需要自行获取（修改itemProps即可）
         */
        const itemProps = $("td > a");
        // 暂存区本次 请求到的地区
        let newArr = [];
        // 循环对应的节点
        itemProps.each((index, item) => {
            const $item = $(item);
            const href = $item.prop('href'); // 子地区的路径
            const text = $item.text(); // 地区
            // 去除城市中为编号的部分
            if (isNaN(text)) {
                newArr.push({
                    value: href.replace(/\d{2}\/|(.html)/g, '').padEnd(6, 0), // 在href中截取对应的地区编码，并补齐到六位
                    text,
                    href
                })
            }
        });

        // 使用新数组进行循环  规避作去除判断是下标不连续问题
        newArr.forEach((v, k) => {
            let info = {
                // 按需修改 value text
                value: v.value, // 对应的城市编码
                text: v.text, // 对应的城市
                children: [],
            }
            if (level === l) {
                delete info.children;
            }
            arr.push(info);
            task.push(function (callback) {
                getCitys(city_url + v.href, arr[k].children, level + 1, arr[k].text, callback);
            })
        })
        // 延迟开启下一个请求的时间，避免请求过于频繁
        setTimeout(function () {
            callback && callback(null);
        }, 5000);
        /**
         *  等待本轮请求全部完毕，不影响其他请求
         *  类似于加载队列，只有前一个请求完毕才开始下一个
         */
        async.waterfall(task, function (err, result) {
            if (err) return console.log(err);
        })
    });
}
// 初次调用 获取->省
console.time('程序结束共耗时：');
getCitys(city_url + 'index.html', arrAll, 1, '中国');

process.on("exit", function (code) {
    console.timeEnd('程序结束共耗时：');
});
// 写入文件
function write (contents) {
    fs.writeFile(file, JSON.stringify(contents, null, 4), function (err) {
        if (err) {
            console.error(err);
            process.exit(1);
        } else {
            // console.log('数据写入成功！')
        }
    });
}

writeLog('-------------------------------------------------------');
// 写入日志
function writeLog (contents) {
    fs.appendFile(fileLog, JSON.stringify(contents, null, 4) + '\r', function (err) {
        if (err) {
            console.error(err);
            process.exit(1);
        } else {
            console.log('create log + ！')
        }
    });
}

// http://www.stats.gov.cn/tjsj/tjbz/tjyqhdmhcxhfdm/2018/index.html     省
// http://www.stats.gov.cn/tjsj/tjbz/tjyqhdmhcxhfdm/2018/14.html        市
// http://www.stats.gov.cn/tjsj/tjbz/tjyqhdmhcxhfdm/2018/14/1401.html   区

/**

let b = a.map(val => {
	return {
		value: val.value,
		text: val.text,
		children: val.children.map(v => {
            return {
                value: v.value,
                text: v.text,
                children: v.children.map(v1 => {
					return {
                        value: v1.value,
                        text: v1.text
                    }
            	})
			}
		})
	}
})

 */