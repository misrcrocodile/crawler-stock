const Promise = require("bluebird");
const moment = require("moment");
const curl = require('../utils/curl');
const decode = require('../utils/decoder').decodeData;
const Indicator = require("../utils/Indicator");
const Util = require("../utils/Util");
const fetch = require("../utils/crawler").fetchJSON;
const URL_STOCK_CODE_LIST = [
  "https://price-api.vndirect.com.vn/stocks/snapshot?floorCode=10",
  "https://price-api.vndirect.com.vn/stocks/snapshot?floorCode=02",
  "https://price-api.vndirect.com.vn/stocks/snapshot?floorCode=03"
]
const URL_DAY_HISTORY =
  "https://dchart-api.vndirect.com.vn/dchart/history?resolution=D&symbol="; // parameter resolution, symbol, from, to
const URL_STOCK_SNAPSHOT =
  "https://price-api.vndirect.com.vn/stocks/snapshot?code=";


const HIGH_CONCURRENCY = 20;
const LOW_CONCURRENCY = 20;

// Init stockHistory
const stockHistory = require("../models/StockHistory");

async function exec() {
  let isBlankDb = await stockHistory.isBlankDatabase();
  
  console.log("Time: ", moment().format());
  console.time("Execute time");
  
  // Renew Database by crawling data
  if(isBlankDb) {
    await createFirstData();
  } else {
    await crawlLastestData();
  }

  // Update Data
  await updateMACDDashboard();
  await updateTodayTopGrow();
  await updateTopGrowStock(3);
  await updateTopGrowStock(20);
  await updateTopGrowStock(60);
  await updateTopGrowStock(120);

  console.timeEnd("Execute time");
  console.log("DONE RUN EVERY DAY!");
}

/**
 * Run only once when database is blank.
 * Get data from stock exchange, calculate it by indicator 
 * and save it back to database
 */
async function createFirstData() {
  console.log("Running createFirstData if database is blank...");

  // 1. get Code list
  var codeList = await getListCode();
  console.log("codeList's length: ", codeList.length);


  // 2. Mapping StockCode with getStockDataFunc
  var getStockDataFunc = e => getStockData(e);
  var mappedData = await Promise.map(codeList, getStockDataFunc, {
    concurrency: LOW_CONCURRENCY
  });

  // 3. Calculating data by using Stock's Indicator
  var calculatedData = mappedData.map(Indicator.calc).filter(e => e.length > 0);

  // 4. Insert Calculated data to database and Return
  return await Promise.map(
    calculatedData,
    stockHistory.insert.bind(stockHistory),{
      concurrency: HIGH_CONCURRENCY
  });
}

/**
 * Get stock data of the lastest day in stock exchange.
 * Calculating it and update it to database
 */
async function crawlLastestData() {
  console.log("Running createFirstData if database is blank...");

  // 1. Getting Code list
  var codeList = await getListCode();
  console.log("codeList's length: ", codeList.length);

  // 2. Mapping StockCode with getStockDataFunc
  var getStockDataFunc = e => getStockData(e,7);
  var weekData = await Promise.map(codeList, getStockDataFunc, {
    concurrency: LOW_CONCURRENCY
  });

  // 3. Checkking crawled data exists or not
  if (weekData.length == 0) {
    console.log("Cannot crawl any data.");
    return;
  }

  // 4. Converting crawled data from Crawl's Object -> Database's Object
  weekData = weekData.map(e => stockHistory.toNewestDbObject(e));
  let lastTime = weekData[0].time;

  var isExistsData = await stockHistory.isExistDataByTime(lastTime);

  // 5. Update new data to DB
  if (isExistsData) {
    console.log("Today data is exist. Take update action.");
    // Create update promise action
    const promiseUpdateLastItem = e =>
      stockHistory
        .updateLastestItem(e)
        .bind(stockHistory)
        .catch();
    await Promise.map(weekData, promiseUpdateLastItem, {
      concurrency: HIGH_CONCURRENCY
    });
  } else {
    console.log("Data is exist. Take insert action.");
    // Create insert promise action
    const promiseInsertLastItem = e =>
      stockHistory
        .insertLastestItem(e)
        .bind(stockHistory)
        .catch();
    await Promise.map(weekData, promiseInsertLastItem, {
      concurrency: HIGH_CONCURRENCY
    });
  }

  // Getting data from Database and re-calculate indicator
  let updateDatabaseIndicator = async function(code) {
    var data = await stockHistory.get(code);
    data = stockHistory.toArray(data);
    data = Indicator.calc(data);
    await stockHistory.updateLastestItem(data);
  }
  await Promise.map(codeList, updateDatabaseIndicator, {
    concurrency: HIGH_CONCURRENCY
  });
}

/**
 * Get stock code list of the whole stock market
 * @return List<String> list stock code
 */
async function getListCode() {
  let returnData = [];
  
  // 1. Get data from URL
  let data = await Promise.map(URL_STOCK_CODE_LIST, curl, {
      concurrency: HIGH_CONCURRENCY
  });

  // 2. Parse Data to JSON
  data = data.map(e => returnData = returnData.concat(JSON.parse(e)));

  // 3. Decode Data, take 3-character stock code only and Return
  return returnData
    .map(e => decode(e))
    .map(e =>e[1])
    .filter(e => e.length === 3);
}

/**
 * Get Stock data via stock's Code
 * 
 * @param {String} StockCode Code of stock
 * @param {Integer} NumberOfSession number of stock session
 * @return {Object} Stockdata
 */
async function getStockData(stockCode, numberOfSession = 0) {
  
  // 1. Setting up time
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

  // 2. Putting time to Url and fetching data
  var strUrl =
    URL_DAY_HISTORY + stockCode + "&from=" + strFromDay + "&to=" + strToDay;
  var data = await fetch(strUrl);
  console.log(`Fetching history: code = ${stockCode} ~> Done!`);

  // 3. Converting to crawler's object
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

async function updateMACDDashboard() {
  console.log("Run updateMACDDashboard ...");
  var row = await stockHistory.getMACDDashboard(20);
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
  await Util.saveNote("stockdata", realtimeList.join(","));
}

async function updateTodayTopGrow() {
  console.log("Running updateTopGrow ...");
  const data = await stockHistory.getTodayTopGrow();
  await Util.saveNote("topgrowdata", JSON.stringify(data));
}

/**
 * Getting a list of most growing stock in period of time
 * @param {Integer} day period of evaluation
 * @return {Object} database's object contain top growing stock
 */
async function updateTopGrowStock(day) {
  console.log("Running updateTopGrowStock ..." + day);
  const data = await stockHistory.getTopStockList(day);
  await Util.saveNote("topgrow" + day, JSON.stringify(data));
}

async function debug() {
  //console.log(await stockHistory.isBlankDatabase());
  var codeList = await exec();
}

module.exports = {
  exec, // run Everyday job pull data from server and analysis
  debug  // for debug only
};
