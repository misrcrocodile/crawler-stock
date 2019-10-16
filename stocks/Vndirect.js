const Promise = require("bluebird");
const moment = require("moment");

const sqlite3 = require("../utils/adapter.js");
const Indicator = require("./../utils/Indicator");
const StockHistory = require("../models/StockHistory");
const Util = require("../utils/Util");

const URL_STOCK_CODE_LIST =
  "https://price-as01.vndirect.com.vn/priceservice/secinfo/snapshot/q=floorCode:10,02,03";
const URL_DAY_HISTORY =
  "https://dchart-api.vndirect.com.vn/dchart/history?resolution=D&symbol="; // parameter resolution, symbol, from, to
const URL_STOCK_LIST =
  "https://price-fpt-03.vndirect.com.vn/priceservice/secinfo/snapshot/q=codes:";
const URL_INTRA_HISTORY =
  "https://finfo-api.vndirect.com.vn/v3/stocks/intraday/history?symbols=FPT&sort=-time&limit=1000&fromDate=2019-09-23&toDate=2019-09-23&fields=symbol,last,lastVol,time";

const CONCURRENCY = 15;
const IS_DELETE_DB = true;
const SQLITE3_PATH = "./stock.db";

// delete file named SQLITE3_PATH
if (IS_DELETE_DB) {
  const fs = require("fs");

  fs.unlink(SQLITE3_PATH, function(err) {
    if (err) {
      console.log("Have no file to delete.");
    }
    // if no error, file has been deleted successfully
    console.log("File deleted!");
  });
}

// Init sqlite
const db = sqlite3.init(SQLITE3_PATH);

// Init stockHistory
const stockHistory = new StockHistory(db);

// Get all stock code list of the whole market
async function getListCode() {
  var codeList = [];

  // Getting data
  var data = await Util.fetchGet(URL_STOCK_CODE_LIST);

  // Executing data
  for (var key in data) {
    for (var i = 0; i < data[key].length; i++) {
      codeList.push(data[key][i].split("|")[3]);
    }
  }

  return codeList;
}

// get the newest stock data
async function getLastStockData(stockCode) {
  // Today string
  var strTo = moment()
    .unix()
    .toString();
  strTo = strTo.substr(0, strTo.length - 3);

  // Fromday string
  var strFrom = "";
  strFrom = strTo - 86400 * 7;

  // Creating url
  var url = URL_DAY_HISTORY + stockCode + "&from=" + strFrom + "&to=" + strTo;
  console.log("Fetching from url: ", url);

  // Getting data
  var data = await Util.fetchGet(url);
  var dataSize = data.t.length;

  // Checkking if data is not exists
  if (dataSize === 0) {
    return Promise.reject({
      err: "[getLastStockData] have no record to pull. code=" + stockCode
    });
  }

  // Creatting data
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
}

function getLastStockData_WithoutReject(stockCode) {
  return getLastStockData(stockCode).catch(err => {
    return err;
  });
}

// get stock data from init day
async function getAll(stockCode) {
  var strToDay = moment()
    .unix()
    .toString();
  var strFromDay = moment("1-1-2000", "MM-DD-YYYY")
    .unix()
    .toString();

  strToDay = strToDay.substr(0, strToDay.length - 3) + "000";
  strFromDay = strFromDay.substr(0, strFromDay.length - 3) + "000";

  var strUrl =
    URL_DAY_HISTORY + stockCode + "&from=" + strFromDay + "&to=" + strToDay;

  // Fetching data
  var data = await Util.fetchGet(strUrl);
  console.log(`Fetching history: code = ${stockCode} ~> Done!`);

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
}

// calculate indicator
function calcIndicator(data) {
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
async function initDatabase() {
  var codeList = await getListCode();

  // Creatting promise
  var allPromise = Promise.map(codeList, getAll, {
    concurrency: CONCURRENCY
  });

  // Run promise
  return allPromise.then(allValue => {
    var allIndicator = allValue.map(calcIndicator);
    var childPromise = Promise.map(
      allIndicator,
      stockHistory.insert.bind(stockHistory),
      {
        concurrency: CONCURRENCY
      }
    );
    return childPromise.then();
  });
}

// Inconstruct
async function updateAll() {
  var codeList = await getListCode();
  var lastStockdata = await Promise.map(codeList, getLastStockData, {
    concurrency: CONCURRENCY
  });

  return Promise.map(
    lastStockdata,
    stockHistory.update.bind(stockHistory)
  ).then();
}

async function insertAll() {
  // Getting code list
  var codeList = await getListCode();

  // Getting lastest history data
  var returnData = await Promise.all([
    Promise.map(codeList, getLastStockData_WithoutReject, {
      concurrency: CONCURRENCY
    }),
    Promise.map(codeList, stockHistory.get_WithoutReject.bind(stockHistory), {
      concurrency: CONCURRENCY
    })
  ]);

  var lastData = returnData[0];
  var historyData = returnData[1];
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
    data = calcIndicator(data);

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
  return Promise.map(insertList, stockHistory.insert.bind(stockHistory), {
    concurrency: CONCURRENCY
  });
}

async function updateDashboard() {
  var row = await stockHistory.getAnalysisMACD(30);
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
        dataContent[i][j] = {
          code: tempData[header[j]][i].code,
          macd: tempData[header[j]][i].macd_histogram
        };
      }
    }
  }
  var downList = [];
  var upList = [];
  var realtimeList = [];
  var toDayList = tempData[header[header.length - 1]];
  for (var i = 0; i < toDayList.length; i++) {
    realtimeList.push(toDayList[i].code);
    if (toDayList[i].macd_histogram >= 0) {
      upList.push(toDayList[i].code);
    } else {
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

  await Util.saveNote("dashboarddata", JSON.stringify(returnObj));
  return Util.saveNote("stockdata", realtimeList.join(","));
}

async function runEveryday() {
  await initDatabase();
  return updateDashboard();
}

module.exports = {
  initDatabase, // Run for the first time init project
  insertAll, // insert all stock
  updateAll, // update all stock
  calcIndicator, // calcIndicator
  getAll, // get stock data from beginning
  getLastStockData, // Fetch newest data
  getListCode, // Get all code list in whole maket
  runEveryday // run Everyday job pull data from server and analysis
};
