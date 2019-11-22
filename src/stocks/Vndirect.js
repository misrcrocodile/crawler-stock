const Promise = require("bluebird");
const moment = require("moment");

const Indicator = require("../utils/Indicator");
const StockHistory = require("../models/StockHistory");
const Util = require("../utils/Util");
const fetch = require('../utils/crawler').fetchJSON;
const URL_STOCK_CODE_LIST =
  "https://price-cmc-03.vndirect.com.vn/priceservice/secinfo/snapshot/q=floorCode:10,02,03";
const URL_DAY_HISTORY =
  "https://dchart-api.vndirect.com.vn/dchart/history?resolution=D&symbol="; // parameter resolution, symbol, from, to
const URL_STOCK_LIST =
  "https://price-fpt-03.vndirect.com.vn/priceservice/secinfo/snapshot/q=codes:";
const URL_STOCK_SNAPSHOT =
  "https://price-as02.vndirect.com.vn/priceservice/secinfo/snapshot/q=codes:";
const URL_INTRA_HISTORY =
  "https://finfo-api.vndirect.com.vn/v3/stocks/intraday/history?symbols=FPT&sort=-time&limit=1000&fromDate=2019-09-23&toDate=2019-09-23&fields=symbol,last,lastVol,time";

const HIGH_CONCURRENCY = 20;
const LOW_CONCURRENCY = 20;

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

  var data = await fetch(strUrl);
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

function getWeekStockData(stockCode) {
  return getStockData(stockCode, 100);
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
      concurrency: HIGH_CONCURRENCY
    });
  } else {
    const promiseInsertLastItem = e =>
      stockHistory
        .insertLastestItem(e)
        .bind(stockHistory)
        .catch();
    await Promise.map(weekData, promiseInsertLastItem, {
      concurrency: HIGH_CONCURRENCY
    });
  }

  await Promise.map(codeList, getDataAndUpdateIndicator, {
    concurrency: HIGH_CONCURRENCY
  });
}

async function getDataAndUpdateIndicator(code) {
  var data = await stockHistory.get(code);
  data = stockHistory.toArray(data);
  data = Indicator.calc(data);
  await stockHistory.updateLastestItem(data);
}

// run only once when init project
async function runCrawler() {
  console.log('Run crawler ...')
  var codeList = await getListCode();
  var getStockDataMod = e => getStockData(e,0);
  // Creatting promise
  var allValue = await Promise.map(codeList, getStockDataMod, {
    concurrency: LOW_CONCURRENCY
  });

  // Run promise
  var allIndicator = allValue.map(Indicator.calc).filter(e => e.length > 0);
  
  var childPromise = Promise.map(
    allIndicator,
    stockHistory.insert.bind(stockHistory),
    {
      concurrency: HIGH_CONCURRENCY
    }
  );
  return childPromise.then();
}

async function updateDashboard() {
  console.log('Run updateDashboard ...');
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

  // Create table header
  for (var key in tempData) {
    header.push(key);
    maxLen = tempData[key].length > maxLen ? tempData[key].length : maxLen;
  }

  // Create data blank content;
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
  console.log('Running updateTopGrow ...')
  const data = await stockHistory.getTopGrow();
  await Util.saveNote("topgrowdata", JSON.stringify(data));
}

// TODO: rename function
async function updateTopGrowByDay(day) {
  console.log('Running updateTopGrowByDay ...' + day);
  const data = await stockHistory.getTopStockList(day);
  await Util.saveNote("topgrow" + day, JSON.stringify(data));
}

async function runEveryday() {

  if (!stockHistory.isExistDbFile()) {

    console.log("Have no database file. Create new one!");
    await stockHistory.initDb(true);
    await runCrawler();

  }else{

    await stockHistory.initDb(false);

    try {
      await runCrawler1();
    } catch (e) {
      console.log(e);
    }
  }

  await updateDashboard();
  await updateTopGrow();
  await updateTopGrowByDay(3);
  await updateTopGrowByDay(20);
  await updateTopGrowByDay(60);
  await updateTopGrowByDay(120);
  
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

  let snapshotErr = {};
  for (let i = 0; i < snapshotArr.length; i++) {
    snapshotArr[i].accumulatedVol *= 10;
    if (!isValidSnapshotData(snapshotArr[i])) {
      snapshotErr[snapshotArr[i].code] = i;
    }
  }

  let errCodeList = Object.keys(snapshotErr);
  let bulkArr = await Promise.map(errCodeList, getWeekStockData, {concurrency: LOW_CONCURRENCY});
  
  buklArr = bulkArr.map(e => {
    let bulk = stockHistory.getLastestBulk(e)
    let i = snapshotErr[bulk.code];

    snapshotArr[i] = {
      ...snapshotArr[i],
      openPrice: bulk.open,
      closePrice: bulk.close,
      highestPrice: bulk.high,
      lowestPrice: bulk.low,
      accumulatedVol: bulk.volume
    };
  });

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

async function debugCode() {
  await stockHistory.initDb(false);
  await updateDashboard();
  await updateTopGrow();
  await updateTopGrowByDay(3);
  await updateTopGrowByDay(20);
  await updateTopGrowByDay(60);
  await updateTopGrowByDay(120);
};

module.exports = {
  runCrawler, // Run for the first time init project
  getStockData, // get stock data from beginning
  getWeekStockData, // Fetch newest data
  getListCode, // Get all code list in whole maket
  runEveryday, // run Everyday job pull data from server and analysis
  getLastStockData,
  debugCode
};
