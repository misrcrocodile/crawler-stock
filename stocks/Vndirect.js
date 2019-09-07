const fetch = require('node-fetch');
const axios = require('axios');

const sqlite3 = require('../utils/adapter.js');
const SQLITE3_PATH = "./stock.db";
const Indicator = require('./../utils/Indicator');

const StockHistory = require("../models/StockHistory");

var db = sqlite3.init(SQLITE3_PATH);

function scan2(stockArr) {
    return axios("https://price-as01.vndirect.com.vn/priceservice/secinfo/snapshot/q=codes:FPTT,VCB,HPG,VSC,CMG,NDN,DTD,VGI", { "credentials": "omit", "headers": { "accept": "application/json, text/plain, */*", "sec-fetch-mode": "cors" }, "referrer": "https://trade-as.vndirect.com.vn/chung-khoan/danh-muc", "referrerPolicy": "no-referrer-when-downgrade", "body": null, "method": "GET", "mode": "cors" }).then(res => {
        return res.data;
    });
}

function scan(stockArr) {
    var queryStr = stockArr.join(",");
    return fetch(
        "https://price-fpt-04.vndirect.com.vn/priceservice/secinfo/snapshot/q=codes:" + queryStr, {
            "headers": {
                "accept": "application/json, text/plain, */*",
                "sec-fetch-mode": "cors"
            },
            "method": "GET",
        }).then(res => res.json());
}


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


function getEMA(StockCode, numberOfDate, period) {
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

    var strUrl = "https://price-as01.vndirect.com.vn/priceservice/secinfo/snapshot/q=floorCode:10,02,03";
    return fetch(strUrl, {
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

function getStockDayBefore(stockCode, daynum) {

    var dtToday = new Date();
    dtToday.setDate(dtToday.getDate() - daynum);
    var strToDay = dtToday.getTime().toString();
    strToDay = strToDay.substr(0, strToDay.length - 3);
    strToDay += "000"
    var strUrl = "https://dchart-api.vndirect.com.vn/dchart/history?resolution=D&symbol=" + stockCode + "&from=" + strToDay + "&to=" + strToDay;
    console.log(strUrl);
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

// get stock data from init day
function getStockHistoryAll(stockCode) {

    var dtToday = new Date();
    var dtFromDay = new Date("2000/1/1");
    var strToDay = dtToday.getTime().toString();
    var strFromDay = dtFromDay.getTime().toString();

    strToDay = strToDay.substr(0, strToDay.length - 3);
    strFromDay = strFromDay.substr(0, strFromDay.length - 3);

    var strUrl = "https://dchart-api.vndirect.com.vn/dchart/history?resolution=D&symbol=" + stockCode + "&from=" + strFromDay + "&to=" + strToDay;

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
        var stockHistory = new StockHistory(db);
        for (var i = 0; i < codeList.length; i++) {
            getStockHistoryAll(codeList[i]).then(res => {
                stockHistory.insert(calcIndicatorWeight(res));
            });
        }
    });
}

// getCodeList().then(codeList => {
//     for (var i = 0; i < codeList.length; i++) {
//         getStockDayBefore(codeList[i], 1).then(res => {
//             console.log(JSON.stringify(res));
//         });
//     }
// });

getStockDayBefore("FPT", 1).then(res => {
    console.log(JSON.stringify(res));
});