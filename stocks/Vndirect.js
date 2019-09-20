const fetch = require("node-fetch");
const Promise = require("bluebird");

const sqlite3 = require("../utils/adapter.js");
const Indicator = require("./../utils/Indicator");
const StockHistory = require("../models/StockHistory");

const SQLITE3_PATH = "./stock.db";
const URL_STOCK_CODE_LIST =
  "https://price-as01.vndirect.com.vn/priceservice/secinfo/snapshot/q=floorCode:10,02,03";
const URL_STOCK_HISTORY =
  "https://dchart-api.vndirect.com.vn/dchart/history?resolution=D&symbol="; // parameter resolution, symbol, from, to
const URL_STOCK_LIST =
  "https://price-fpt-03.vndirect.com.vn/priceservice/secinfo/snapshot/q=codes:";

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
  strTo = strTo.substr(0, strTo.length - 3);
  strFrom = strTo - 86400 * 7;

  return fetch(
    URL_STOCK_HISTORY + stockCode + "&from=" + strFrom + "&to=" + strTo,
    {
      headers: {
        accept: "application/json, text/plain, */*"
      }
    }
  )
    .then(res => res.json())
    .then(data => {
      let dataSize = data.t.length;

      // check if data is not exists
      if (dataSize === 0) {
        return Promise.reject({
          errMsg: "[getLastStockData] have no record to pull. code=" + stockCode
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

// get stock data from init day
function getStockHistoryAll(stockCode) {
  var dtToday = new Date();
  var dtFromDay = new Date("2000/1/1");
  var strToDay = dtToday.getTime().toString();
  var strFromDay = dtFromDay.getTime().toString();

  strToDay = strToDay.substr(0, strToDay.length - 3);
  strFromDay = strFromDay.substr(0, strFromDay.length - 3);

  var strUrl =
    URL_STOCK_HISTORY + stockCode + "&from=" + strFromDay + "&to=" + strToDay;
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
function initDataForTheFirstTime1() {
  getCodeList().then(codeList => {
    for (var i = 0; i < codeList.length; i++) {
      getStockHistoryAll(codeList[i]).then(res => {
        stockHistory.insert(calcIndicatorWeight(res));
      });
    }
  });
}
// run only once when init project
function initDataForTheFirstTime() {
  getCodeList().then(codeList => {
    var allPromise = Promise.map(codeList, getStockHistoryAll, {
      concurrency: 4
    });
    allPromise.then(allValue => {
      for (var i = 0; i < allValue.length; i++) {
        stockHistory.insert(calcIndicatorWeight(allValue[i]));
      }
    });
  });
}

function updateAllNewStockData() {
  getCodeList().then(codeList => {
    for (var i = 0; i < codeList.length; i++) {
      var stockCode = codeList[i];
      Promise.all([getLastStockData(stockCode), stockHistory.get(stockCode)])
        .then(res => {
          var lastData = res[0];
          var historyData = res[1];
          var data = stockHistory.convert2DataArray(historyData);
          var insertData = {};

          // add last data to stockHistory before calculate indicator
          for (key in data) {
            if (Array.isArray(data[key])) {
              data[key].push(0);
            }
          }

          data.length += 1;
          data.time[data.length - 1] = lastData.time[0];
          data.high[data.length - 1] = lastData.high[0];
          data.low[data.length - 1] = lastData.low[0];
          data.open[data.length - 1] = lastData.open[0];
          data.close[data.length - 1] = lastData.close[0];
          data.volume[data.length - 1] = lastData.volume[0];

          // calculate indicator
          data = calcIndicatorWeight(data);

          // create data to save to DB
          for (key in data) {
            if (Array.isArray(data[key])) {
              insertData[key] = [data[key][data[key].length - 1]];
            } else {
              insertData[key] = data[key];
            }
          }

          // set length to 1
          insertData.length = 1;

          // save data to db
          stockHistory.insert(insertData);
        })
        .catch(err => {
          console.log(err);
        });
    }
  });
}

function testByCode(code) {
  getStockHistoryAll(code).then(res => {
    stockHistory.insert(calcIndicatorWeight(res));
  });
}
//initDataForTheFirstTime();
//updateAllNewStockData();

// getStockList(["BMP", "FPT", "VCB", "HPG", "FRT", "VGI"]).then(res => {
//     console.log(JSON.stringify(res));
// });

// getStockList

module.exports = {
  updateAllNewStockData,
  initDataForTheFirstTime,
  calcIndicatorWeight,
  getStockHistoryAll,
  getLastStockData,
  getCodeList,
  testByCode
};
