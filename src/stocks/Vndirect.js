const Promise = require("bluebird");
const moment = require("moment");

const Indicator = require("../utils/Indicator");
const StockHistory = require("../models/StockHistory");
const Util = require("../utils/Util");
const fs = require("fs");

const URL_STOCK_CODE_LIST =
  "https://price-as01.vndirect.com.vn/priceservice/secinfo/snapshot/q=floorCode:10,02,03";
const URL_DAY_HISTORY =
  "https://dchart-api.vndirect.com.vn/dchart/history?resolution=D&symbol="; // parameter resolution, symbol, from, to
const URL_STOCK_LIST =
  "https://price-fpt-03.vndirect.com.vn/priceservice/secinfo/snapshot/q=codes:";
const URL_STOCK_SNAPSHOT =
  "https://price-as02.vndirect.com.vn/priceservice/secinfo/snapshot/q=codes:";
const URL_INTRA_HISTORY =
  "https://finfo-api.vndirect.com.vn/v3/stocks/intraday/history?symbols=FPT&sort=-time&limit=1000&fromDate=2019-09-23&toDate=2019-09-23&fields=symbol,last,lastVol,time";

const CONCURRENCY = 10;
// Init stockHistory
let stockHistory = new StockHistory(false);

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
  strTo = strTo.substr(0, strTo.length - 3) * 1000;

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

async function getStockData(stockCode, numberOfSession = 0) {
  var strToDay = moment()
    .unix()
    .toString();
  var strFromDay = moment("1-1-2000", "MM-DD-YYYY")
    .unix()
    .toString();

  if (numberOfSession !== 0) {
    strFromDay = moment()
      .subtract(numberOfSession, "days")
      .unix()
      .toString();
  }

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

// get stock data from init day
async function getAllStockData(stockCode) {
  return getStockData(stockCode);
}

function getWeekStockData(stockCode) {
  return getStockData(stockCode, 7);
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
  data.vol20 = Indicator.calculateVol20(data.volume);
  return data;
}

async function runCrawler1() {
  // remove banned item
  var codeList = await getListCode();
  var weekData = await getToDayStockData();

  // Check if data exists or not
  if (weekData.length == 0) {
    console.log("Cannot crawl any data.");
    return;
  }

  let lastTime = weekData[0].time;
  
  var isExistsData = await stockHistory.isExistDataByTime(lastTime);

  if (isExistsData) {
    const promiseUpdateLastItem = e =>
      stockHistory
        .updateLastestItem(e)
        .bind(stockHistory)
        .catch();
    await Promise.map(weekData, promiseUpdateLastItem, {
      concurrency: CONCURRENCY
    });
  } else {
    const promiseInsertLastItem = e =>
      stockHistory
        .insertLastestItem(e)
        .bind(stockHistory)
        .catch();
    await Promise.map(weekData, promiseInsertLastItem, {
      concurrency: CONCURRENCY
    });
  }

  await Promise.map(codeList, getDataAndUpdateIndicator, {
    concurrency: CONCURRENCY
  });
}

async function getDataAndUpdateIndicator(code) {
  var data = await stockHistory.get(code);
  data = stockHistory.toArray(data);
  data = calcIndicator(data);
  await stockHistory.updateLastestItem(data);
}

// run only once when init project
async function runCrawler() {
  var codeList = await getListCode();
  // Creatting promise
  var allValue = await Promise.map(codeList, getAllStockData, {
    concurrency: CONCURRENCY
  });

  // Run promise
  var allIndicator = allValue.map(calcIndicator);
  var childPromise = Promise.map(
    allIndicator,
    stockHistory.insert.bind(stockHistory),
    {
      concurrency: CONCURRENCY
    }
  );
  return childPromise.then();
}

// TODO: edit function name
async function updateAll() {
  // Get list stock code
  var codeList = await getListCode();

  // Define promise for skipping error
  var promiseGetWeekData = code => getWeekStockData(code).catch(e => e);

  // Get data from server
  var lastStockdata = await Promise.map(codeList, promiseGetWeekData, {
    concurrency: CONCURRENCY
  });

  // update data to db
  return Promise.map(
    lastStockdata,
    stockHistory.update.bind(stockHistory)
  ).then();
}

// TODO: editting
async function insertAll() {
  // Getting code list
  var codeList = await getListCode();

  var pGetLastDataNoReject = code => getLastStockData(code).catch(e => e);
  var pGetStockHistoryNoReject = code =>
    stockHistory
      .get(code)
      .bind(stockHistory)
      .catch(err => err);

  var returnData = await Promise.all([
    Promise.map(codeList, pGetLastDataNoReject, {
      concurrency: CONCURRENCY
    }),
    Promise.map(codeList, pGetStockHistoryNoReject, {
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
  var row = await stockHistory.getSummaryEveryday(30);
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

async function updateTopGrow() {
  const data = await stockHistory.getTopGrow();
  await Util.saveNote("topgrowdata", JSON.stringify(data));
}
async function runEveryday() {
  // await initDB();

  if (!stockHistory.isExistDbFile()) {
    console.log("Have no database file. Create new one!");
    await stockHistory.initDb(true);
    await runCrawler();
    return;
  }

  await stockHistory.initDb(false);
  try {
    await runCrawler1();
  } catch (e) {
    console.log(e);
  }
  await updateDashboard();
  await updateTopGrow();
  console.log("DONE RUN EVERY DAY");
}

function getSnapshotObj(strStock) {
  let obj = {};
  let arr = strStock.split("|");
  obj["floorCode"] = arr[0];
  obj["tradingDate"] = arr[1];

  // check data exists or not
  if (obj["tradingDate"] === "") {
    return undefined;
  }

  let strTime =
    moment(parseInt(arr[1])).format("YYYY-MM-DD") + "T09:00:00+09:00";
  strTime = moment(strTime)
    .unix()
    .toString();
  obj["tradingDate"] = strTime; // time

  obj["time"] = arr[2];
  obj["code"] = arr[3]; // code
  obj["stockType"] = arr[5];
  obj["totalRoom"] = arr[6];
  obj["currentRoom"] = arr[7];
  obj["basicPrice"] = arr[8];
  obj["openPrice"] = arr[9]; // open
  obj["matchPrice"] = arr[10];
  obj["currentQtty"] = arr[12];
  obj["highestPrice"] = arr[13]; // high
  obj["lowestPrice"] = arr[14]; // low
  obj["ceilingPrice"] = arr[15];
  obj["floorPrice"] = arr[16];
  obj["totalOfferQtty"] = arr[17];
  obj["totalBidQtty"] = arr[18];
  obj["closePrice"] = arr[19]; // close
  obj["matchQtty"] = arr[20];
  obj["matchValue"] = arr[21];
  obj["averagePrice"] = arr[22];
  obj["bidPrice01"] = arr[23];
  obj["bidQtty01"] = arr[24];
  obj["bidPrice02"] = arr[25];
  obj["bidQtty02"] = arr[26];
  obj["bidPrice03"] = arr[27];
  obj["bidQtty03"] = arr[28];
  obj["offerPrice01"] = arr[29];
  obj["offerQtty01"] = arr[30];
  obj["offerPrice02"] = arr[31];
  obj["offerQtty02"] = arr[32];
  obj["offerPrice03"] = arr[33];
  obj["offerQtty03"] = arr[34];
  obj["accumulatedVal"] = arr[35];
  obj["accumulatedVol"] = arr[36]; // volume
  obj["buyForeignQtty"] = arr[37];
  obj["sellForeignQtty"] = arr[38];
  return obj;
}

function isValidSnapshotData(a) {
  if (a.openPrice === "") return false;
  if (a.closePrice === "") return false;
  if (a.highestPrice === "") return false;
  if (a.lowestPrice === "") return false;
  if (a.accumulatedVol === "") return false;
  return true;
}
async function getToDayStockData() {
  let allCode = await getListCode();
  let url = URL_STOCK_SNAPSHOT + allCode.join(",");
  let arrData = await Util.fetchGet(url);
  let lastestTime = await getLastestTime();
  let snapshotArr = arrData.map(e => getSnapshotObj(e));
  console.log("snapshot item number: ", snapshotArr.length);

  // remove undefined item
  snapshotArr = snapshotArr.filter(e => {
    return e != null;
  });

  // snapshotArr = snapshotArr.filter( e => {
  //   return isValidSnapshotData(e);
  // });
  
  for( let i = 0; i < snapshotArr.length; i++) {
    if(!isValidSnapshotData(snapshotArr[i])) {
      var data = await getWeekStockData(snapshotArr[i].code);
      var bulk = stockHistory.getLastestBulk(data);
      snapshotArr[i] = {...snapshotArr[i], openPrice:bulk.open, closePrice: bulk.close, highestPrice: bulk.high, lowestPrice: bulk.low, accumulatedVol: bulk.volume};
    }
  }
  
  console.log("snapshot item number: ", snapshotArr.length);
  let returnArr = snapshotArr.map(e => {
    return {
      code: e.code,
      time: lastestTime,
      open: e.openPrice,
      close: e.closePrice,
      high: e.highestPrice,
      low: e.lowestPrice,
      volume: e.accumulatedVol
    };
  });
  return returnArr;
}

async function getLastestTime() {
  let data = await getWeekStockData("FPT");
  var bulk = stockHistory.getLastestBulk(data);
  return bulk.time;
}
var debugCode = async function() {
  var an = await getToDayStockData();
  an.map(e => {
    console.log(JSON.stringify(e));
  });
  // var codeList = await getListCode();
  // Promise.map(codeList, getWeekStockData, {
  //   concurrency: CONCURRENCY
  // });
};
module.exports = {
  runCrawler, // Run for the first time init project
  insertAll, // insert all stock
  updateAll, // update all stock
  calcIndicator, // calcIndicator
  getAllStockData, // get stock data from beginning
  getWeekStockData, // Fetch newest data
  getListCode, // Get all code list in whole maket
  runEveryday, // run Everyday job pull data from server and analysis
  debugCode
};
