const fetch = require('node-fetch');

const sqlite3 = require('../utils/adapter.js');
const SQLITE3_PATH = "./stock.db";
const Indicator = require('./../utils/Indicator');
const StockHistory = require("../models/StockHistory");

const URL_STOCK_LIST = "https://price-as01.vndirect.com.vn/priceservice/secinfo/snapshot/q=floorCode:10,02,03";
const URL_STOCK_HISTORY = "https://dchart-api.vndirect.com.vn/dchart/history?resolution=D&symbol="; // parameter resolution, symbol, from, to
var db = sqlite3.init(SQLITE3_PATH);
const stockHistory = new StockHistory(db);

function getStockHistory(stockCode, numberOfDate) {

    var dtToday = new Date();
    var dtFromDay = new Date();
    var strToDay = "";
    var strFromDay = "";

    numberOfDate = numberOfDate + parseInt(numberOfDate / 7) * 2 + 2;
    dtFromDay.setDate(dtFromDay.getDate() - numberOfDate);
    strToDay = dtToday.getTime().toString().substr(0, 10);
    strFromDay = dtFromDay.getTime().toString().substr(0, 10);

    var strUrl = "https://dchart-api.vndirect.com.vn/dchart/history?resolution=D&symbol=" + stockCode + "&from=" + strFromDay + "&to=" + strToDay;
    return fetch(strUrl, {
        "headers": {
            "accept": "application/json, text/plain, */*",
        }
    }).then(res => res.json());
}


function getSMA(StockCode, numberOfDate, period) {

    return getStockHistory(StockCode, numberOfDate).then(data => {
        let values = data.close;

        // create SMA data array
        data.SMA = new Array(period - 1).fill(0);
        data.SMA = data.SMA.concat(SMA.calculate({ period: period, values: values }));
        for (var i = 0; i < data.SMA.length; i++) {
            data.SMA[i] = data.SMA[i].toFixed(3);
        }
        return data;
    });
}

function getCodeList() {
    var codeList = [];

    return fetch(URL_STOCK_LIST, {
        "headers": {
            "accept": "application/json, text/plain, */*",
        }
    }).then(res => res.json()).then(data => {
        for (var key in data) {
            for (var i = 0; i < data[key].length; i++) {
                codeList.push(data[key][i].split("|")[3]);
            }
        }
        return codeList;
    });
}

function getLastStockData(stockCode) {
    var dtToday = new Date();
    var strToDay = dtToday.getTime().toString();

    strToDay = strToDay.substr(0, strToDay.length - 3);

    return stockHistory.getLimit(stockCode, 1, false).then(data => {

        // check if data is exist or not
        if (data.length === 0) {
            return { err: "cannot get data from db. code=" + stockCode };
        }

        return data[0].time;
    }).then(time => {

        // check if get time error
        if (time.err) {
            return time;
        }

        var strUrl = URL_STOCK_HISTORY + stockCode + "&from=" + time + "&to=" + strToDay;

        return fetch(strUrl, {
            "headers": {
                "accept": "application/json, text/plain, */*",
            }
        }).then(res => res.json()).then(data => {
            let dataSize = data.t.length;

            // check if data is not exists
            if (dataSize === 0) {
                return { err: "have no record to pull. code=" + stockCode };
            }

            // check timestamp if it's dupplicated
            if (data.t[dataSize - 1] <= time) {
                return { err: "have no new record. code=" + stockCode };
            }

            // create data
            let retObj = { code: stockCode, time: [], high: [], low: [], open: [], close: [], volume: [], length: 1 };

            retObj.time.push(data.t[dataSize - 1]);
            retObj.high.push(data.h[dataSize - 1]);
            retObj.low.push(data.l[dataSize - 1]);
            retObj.open.push(data.o[dataSize - 1]);
            retObj.close.push(data.c[dataSize - 1]);
            retObj.volume.push(data.v[dataSize - 1]);

            return retObj;
        });
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

    var strUrl = URL_STOCK_HISTORY + stockCode + "&from=" + strFromDay + "&to=" + strToDay;

    return fetch(strUrl, {
        "headers": {
            "accept": "application/json, text/plain, */*",
        }
    }).then(res => res.json()).then(data => {
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

function calcIndicatorWeight(data) {
    let macd = Indicator.calculateMACD(data.close);

    data.ma9 = Indicator.calculateMA(data.close, 9);
    data.ma20 = Indicator.calculateMA(data.close, 20);
    data.ma200 = Indicator.calculateMA(data.close, 200);

    data.macd_macd = macd.MACD;
    data.macd_histogram = macd.histogram
    data.macd_signal = macd.signal;

    data.rsi14 = Indicator.calculateRSI14(data.close);
    data.mfi14 = Indicator.calculateMFI14(data);

    return data;
}


// getStockHistoryAll("CAB").then(res => {
//     console.log(res);
//     var an = calcIndicatorWeight(res);
//     console.log(an);
// });
function initDataForTheFirstTime() {
    getCodeList().then(codeList => {
        for (var i = 0; i < codeList.length; i++) {
            getStockHistoryAll(codeList[i]).then(res => {
                stockHistory.insert(calcIndicatorWeight(res));
            });
        }
    });
}

// initDataForTheFirstTime();
// getCodeList().then(codeList => {
//     for (var i = 0; i < codeList.length; i++) {
//         getStockDayBefore(codeList[i], 1).then(res => {
//             console.log(JSON.stringify(res));
//         });
//     }
// });

// getLastStockData("FPT").then(res => {
//     console.log(JSON.stringify(res));
//     //{"code":"FPT","time":[1567728000],"high":[53.2],"low":[52.3],"open":[52.9],"close":[52.9],"volume":[1142710],"length":1}
// });


function updateNewStockData(stockCode) {
    var lastStockData = {};
    var insertData = {};

    return getLastStockData(stockCode).then(lastData => {
        // check error
        if (lastData.err) {
            console.log("Error message:", lastData.err);
            return;
        }

        return stockHistory.get(stockCode).then(historyData => {

            var data = stockHistory.convert2DataArray(historyData);

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

        });
    });
}
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));


function updateAll() {
    getCodeList().then(codeList => {
        for (var i = 0; i < codeList.length; i++) {
            updateNewStockData(codeList[i]);
        }
    });
}

updateAll();