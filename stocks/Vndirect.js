const fetch = require("node-fetch");
const Promise = require("bluebird");
const fs = require("fs");

const sqlite3 = require("../utils/adapter.js");
const Indicator = require("./../utils/Indicator");
const StockHistory = require("../models/StockHistory");
const util = require("../utils/Util");

const SQLITE3_PATH = "./stock.db";
const URL_STOCK_CODE_LIST =
  "https://price-as01.vndirect.com.vn/priceservice/secinfo/snapshot/q=floorCode:10,02,03";
const URL_DAY_HISTORY =
  "https://dchart-api.vndirect.com.vn/dchart/history?resolution=D&symbol="; // parameter resolution, symbol, from, to
const URL_STOCK_LIST =
  "https://price-fpt-03.vndirect.com.vn/priceservice/secinfo/snapshot/q=codes:";
const URL_INTRA_HISTORY =
  "https://finfo-api.vndirect.com.vn/v3/stocks/intraday/history?symbols=FPT&sort=-time&limit=1000&fromDate=2019-09-23&toDate=2019-09-23&fields=symbol,last,lastVol,time";

// delete file named SQLITE3_PATH
fs.unlink(SQLITE3_PATH, function(err) {
  if (err) throw err;
  // if no error, file has been deleted successfully
  console.log("File deleted!");
});

const db = sqlite3.init(SQLITE3_PATH);
const stockHistory = new StockHistory(db);

// get all stock code list of the whole market
function getCodeList() {
  var codeList = [];

  return fetch(URL_STOCK_CODE_LIST, {
    headers: {
      accept: "application/json, text/plain, */*"
    }
  })
    .then(res => res.json())
    .then(data => {
      for (var key in data) {
        for (var i = 0; i < data[key].length; i++) {
          codeList.push(data[key][i].split("|")[3]);
        }
      }
      return codeList;
    });
}

// get the newest stock data
function getLastStockData(stockCode) {
  var dtToday = new Date();
  var strTo = dtToday.getTime().toString();
  var strFrom = "";
  var url = "";
  strTo = strTo.substr(0, strTo.length - 3);
  strFrom = strTo - 86400 * 7;
  url = URL_DAY_HISTORY + stockCode + "&from=" + strFrom + "&to=" + strTo;
  console.log("Fetching from url: ", url);
  return fetch(url, {
    headers: {
      accept: "application/json, text/plain, */*"
    }
  })
    .then(res => res.json())
    .then(data => {
      let dataSize = data.t.length;

      // check if data is not exists
      if (dataSize === 0) {
        return Promise.reject({
          err: "[getLastStockData] have no record to pull. code=" + stockCode
        });
      }

      // create data
      let retObj = {
        code: stockCode,
        time: [],
        high: [],
        low: [],
        open: [],
        close: [],
        volume: [],
        length: 1
      };

      retObj.time.push(data.t[dataSize - 1]);
      retObj.high.push(data.h[dataSize - 1]);
      retObj.low.push(data.l[dataSize - 1]);
      retObj.open.push(data.o[dataSize - 1]);
      retObj.close.push(data.c[dataSize - 1]);
      retObj.volume.push(data.v[dataSize - 1]);

      return retObj;
    });
}

function getLastStockData_WithoutReject(stockCode) {
  return getLastStockData(stockCode).catch(err => {
    return err;
  });
}

// get stock data from init day
function getStockHistoryAll(stockCode) {
  var dtToday = new Date();
  var dtFromDay = new Date("2000/1/1");
  var strToDay = dtToday.getTime().toString();
  var strFromDay = dtFromDay.getTime().toString();

  strToDay = strToDay.substr(0, strToDay.length - 3);
  strFromDay = strFromDay.substr(0, strFromDay.length - 3);

  var strUrl =
    URL_DAY_HISTORY + stockCode + "&from=" + strFromDay + "&to=" + strToDay;
  console.log("Fetching: ", strUrl);
  return fetch(strUrl, {
    headers: {
      accept: "application/json, text/plain, */*"
    }
  })
    .then(res => res.json())
    .then(data => {
      var retObj = {};

      retObj.code = stockCode;
      retObj.time = data.t;
      retObj.high = data.h;
      retObj.low = data.l;
      retObj.open = data.o;
      retObj.close = data.c;
      retObj.volume = data.v;
      retObj.length = retObj.time.length;

      return retObj;
    });
}

// calculate indicator
function calcIndicatorWeight(data) {
  let macd = Indicator.calculateMACD(data.close);

  data.ma9 = Indicator.calculateMA(data.close, 9);
  data.ma20 = Indicator.calculateMA(data.close, 20);
  data.ma200 = Indicator.calculateMA(data.close, 200);

  data.macd_macd = macd.MACD;
  data.macd_histogram = macd.histogram;
  data.macd_signal = macd.signal;

  data.rsi14 = Indicator.calculateRSI14(data.close);
  data.mfi14 = Indicator.calculateMFI14(data);

  return data;
}

// run only once when init project
function initDataForTheFirstTime() {
  return getCodeList().then(codeList => {
    var allPromise = Promise.map(codeList, getStockHistoryAll, {
      concurrency: 4
    });
    return allPromise.then(allValue => {
      var allIndicator = allValue.map(calcIndicatorWeight);
      var childPromise = Promise.map(
        allIndicator,
        stockHistory.insert.bind(stockHistory),
        {
          concurrency: 4
        }
      );
      return childPromise.then();
    });
  });
}

// Inconstruct
function updateAllNewStockData() {
  getCodeList().then(codeList => {
    Promise.map(codeList, getLastStockData, { concurrency: 4 }).then(data => {
      Promise.map(data, stockHistory.update.bind(stockHistory)).then();
    });
  });
}

function insertAllNewStockData() {
  getCodeList().then(codeList => {
    console.log("Get ", codeList.length, " codes");
    Promise.all([
      Promise.map(codeList, getLastStockData_WithoutReject, { concurrency: 4 }),
      Promise.map(codeList, stockHistory.get_WithoutReject.bind(stockHistory), {
        concurrency: 4
      })
    ])
      .then(res => {
        var lastData = res[0];
        var historyData = res[1];
        var insertList = [];

        // Checking data
        if (lastData.length !== historyData.length) {
          return Promise.reject({
            error: "lastData.length !== historyData.length"
          });
        }

        // Looping each stock item
        for (var i = 0; i < historyData.length; i++) {
          if (lastData[i].err || historyData[i].err) {
            console.error("error ", lastData[i].err, historyData[i].err);
            continue;
          }

          var data = stockHistory.convert2DataArray(historyData[i]);
          var insertData = {};

          // Adding last data to stockHistory before calculate indicator
          for (key in data) {
            if (Array.isArray(data[key])) {
              data[key].push(0);
            }
          }

          // Adding new item to the end of the list
          data.length += 1;
          data.time[data.length - 1] = lastData[i].time[0];
          data.high[data.length - 1] = lastData[i].high[0];
          data.low[data.length - 1] = lastData[i].low[0];
          data.open[data.length - 1] = lastData[i].open[0];
          data.close[data.length - 1] = lastData[i].close[0];
          data.volume[data.length - 1] = lastData[i].volume[0];

          // Calculating indicator
          data = calcIndicatorWeight(data);

          // Creating data to save to DB
          for (key in data) {
            if (Array.isArray(data[key])) {
              insertData[key] = [data[key][data[key].length - 1]];
            } else {
              insertData[key] = data[key];
            }
          }

          // Set length to 1
          insertData.length = 1;

          // Push new data to insert list
          insertList.push(insertData);
        }

        // Save data to db
        console.log("Update ", insertList.length, " codes");

        // Insert list data
        Promise.map(insertList, stockHistory.insert.bind(stockHistory), {
          concurrency: 4
        }).then();
      })
      .catch(err => {
        console.error(err);
      });
  });
}

function updateDashboard() {
  return stockHistory.getAnalysisMACD(30).then(row => {
    var tempData = {};
    var header = [];
    var dataContent = [];
    var maxLen = 0;

    for (var i = 0; i < row.length; i++) {
      if (!Array.isArray(tempData[row[i]["time"]])) {
        tempData[row[i]["time"]] = [];
      }
      tempData[row[i]["time"]].push(row[i]);
    }

    // create table header
    for (var key in tempData) {
      header.push(key);
      maxLen = tempData[key].length > maxLen ? tempData[key].length : maxLen;
    }

    // create data blank content;
    for (var i = 0; i < maxLen; i++) {
      var icontent = [];
      for (var j = 0; j < header.length; j++) {
        icontent.push("");
      }
      dataContent.push(icontent);
    }

    for (var i = 0; i < maxLen; i++) {
      for (var j = 0; j < header.length; j++) {
        if (tempData[header[j]][i] != undefined) {
          dataContent[i][j] = {code:tempData[header[j]][i].code,
            macd:tempData[header[j]][i].macd_histogram};
        }
      }
    }
    var downList = [];
    var upList = [];
    var toDayList = tempData[header[header.length - 1]];
    for(var i = 0; i < toDayList.length;i++) {
      if(toDayList[i].macd_histogram >=0) {
        upList.push(toDayList[i].code);
      }else {
        downList.push(toDayList[i].code);
      }
    }
    
    for (var i = 0; i < header.length; i++) {
      var tempDay = new Date(parseInt(header[i] + "000"));
      header[i] = tempDay.getDate();
    }

    
    var returnObj = {
      header,
      table: dataContent,
      upList: upList.join(","),
      downList: downList.join(",")
    };
    var str = JSON.stringify(returnObj)
    console.log(str);
    return util.saveNote("dashboarddata", str);
  });
}

function runEveryday() {
  return initDataForTheFirstTime().then(()=> {
    return updateDashboard();
  });
}
module.exports = {
  initDataForTheFirstTime,
  insertAllNewStockData,
  updateAllNewStockData,
  calcIndicatorWeight,
  getStockHistoryAll,
  getLastStockData,
  getCodeList,
  runEveryday
};
