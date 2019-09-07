const fetch = require('node-fetch');
const util = require('./Util');
const axios = require('axios');


function printStock(stockcode) {
    return getStockDealDetail(stockcode).then(json => {
        var data = json[0];
        var name = data.Stockcode;
        var price = data.Price / 1000;
        var change = Math.abs(data.Change / 1000);
        var perchange = Math.abs(data.PerChange);
        var sign = data.Change > 0 ? "⬆" : "⬇";
        var retStr = util.space(name, 8) + " " + sign + util.space(price, 7) + "(" + sign + util.space(change, 5) + " " + util.space(sign + perchange + "%", 5) + ")\r\n";

        return retStr;
    });
}

function printAll(arr) {
    var promiseArr = [];
    for (var i = 0; i < arr.length; i++) {
        promiseArr.push(printStock(arr[i]));
    }
    return Promise.all(promiseArr).then(resArr => {
        var str = "";
        for (var i = 0; i < resArr.length; i++) {
            str += resArr[i];
        }
        return str;
    })
}
/*
"body": "Code=" + strStockcode + "&OrderBy=&OrderDirection=desc&PageIndex=1&PageSize=10&FromDate=2019-07-29&ToDate=2019-08-05&ExportType=default&Cols=Room%2CRoomCL%2CRoomCLPT%2CKL_M_GDKL%2CKL_MPT_GDKL%2CGT_M_GDKL%2CGT_MPT_GDKL%2CKL_B_GDKL%2CKL_BPT_GDKL%2CGT_B_GDKL%2CGT_BPT_GDKL%2CCL_GT_MB%2CCL_KL_MB&ExchangeID=7",
*/
function getTradingResult(strStockcode) {
    return fetch("https://finance.vietstock.vn/data/gettradingresult", {
        "headers": {
            "accept": "*/*",
            "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
            "x-requested-with": "XMLHttpRequest"
        },
        "body": "Code=" + strStockcode + "&FromDate=2019-07-29&ToDate=2019-08-05",
        "method": "POST",
    }).then(res => {
        return res.json();
    });
}

function getVnindex() {
    return fetch("https://finance.vietstock.vn/data/getmarketprice?type=2").then(res => res.json());
}

function printVnIndex() {
    return getVnindex().then(json => {
        var data = json[0];
        var name = data.Name;
        var price = data.Price;
        var change = Math.abs(data.Change);
        var perchange = Math.abs(data.PerChange);
        var sign = data.change > 0 ? "⬆" : "⬇";
        var retStr = util.space(name, 8) + " " + sign + util.space(price, 7) + "(" + sign + util.space(change, 5) + " " + util.space(sign + perchange + "%", 5) + ")\r\n";
        return retStr;
    })
}

function getRealtime(arr) {
    return Promise.all([printVnIndex(), printAll(arr)]).then(resArr => {
        var str = "";
        for (var i = 0; i < resArr.length; i++) {
            str += resArr[i];
        }
        return str;
    }).catch(function() {
        console.log("error");
    });
}


/**
 * getStockDealDetail
 * 
 * @param {String} strStockCode 
 * @return {Array[Object]} {Change, IsBuy, Package, PerChange, Price, Stockcode, TotalVal, TotalVol, TradingDate, Vol}  
 */
function getStockDealDetail(strStockCode) {
    return fetch("https://finance.vietstock.vn/data/getstockdealdetail", {
        "headers": {
            "accept": "*/*",
            "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
            "x-requested-with": "XMLHttpRequest"
        },
        "body": "code=" + strStockCode + "&seq=0",
        "method": "POST",
        "mode": "cors"
    }).then(res => res.json());
}


module.exports = {
    getStockDealDetail,
    getTradingResult,
    getVnindex,
    printStock,
    printAll,
    printVnIndex,
    getRealtime
}