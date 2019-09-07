const SMA = require('technicalindicators').SMA;
const MACD = require('technicalindicators').MACD;
const RSI = require('technicalindicators').RSI;
const MFI = require('technicalindicators').MFI;
// count MA
function calculateMA(arr, period) {
    var returnArr = [];
    var arrSMA = [];

    if (!Array.isArray(arr) || arr.length < period) {
        return new Array(period).fill(0);
    }

    returnArr = new Array(period - 1).fill(0);
    arrSMA = SMA.calculate({ period: period, values: arr });
    returnArr = returnArr.concat(arrSMA);

    return returnArr;
}

function calculateMACD(arr) {
    var returnArr = {
        MACD: [],
        histogram: [],
        signal: [],
        data: []
    };
    var initData = []
    var data = [];
    var fastPeriod = 12;
    var slowPeriod = 26;
    var signalPeriod = 9;

    if (!Array.isArray(arr) || arr.length < slowPeriod) {
        returnArr.data = new Array(slowPeriod).fill({ MACD: 0, signal: 0, histogram: 0 });
        returnArr.histogram = new Array(slowPeriod).fill(0);
        returnArr.signal = new Array(slowPeriod).fill(0);
        returnArr.MACD = new Array(slowPeriod).fill(0);
        return returnArr;
    }

    // input parameter
    var macdInput = {
        values: arr,
        fastPeriod: fastPeriod,
        slowPeriod: slowPeriod,
        signalPeriod: signalPeriod,
        SimpleMAOscillator: false,
        SimpleMASignal: false
    }

    initData = new Array(slowPeriod - 1).fill({ MACD: 0, signal: 0, histogram: 0 });

    // calculate MACD 
    data = MACD.calculate(macdInput);
    data = initData.concat(data);

    for (var i = 0; i < data.length; i++) {
        returnArr.histogram.push(data[i].histogram);
        returnArr.MACD.push(data[i].MACD);
        returnArr.signal.push(data[i].signal);
    }
    returnArr.data = data;

    return returnArr;
}


function calculateRSI14(arr) {
    var returnArr = [];
    var arrRSI = [];
    var period = 14;
    if (!Array.isArray(arr) || arr.length < period) {
        return new Array(period).fill(0);
    }

    var inputRSI = {
        values: arr,
        period: period
    };

    returnArr = new Array(period).fill(0);
    arrRSI = RSI.calculate(inputRSI);
    returnArr = returnArr.concat(arrRSI);

    return returnArr;
}

function calculateMFI14(data) {
    var returnArr = [];
    var arrRSI = [];
    var period = 14;

    if (!Array.isArray(data) || arr.length < slowPeriod) {
        return new Array(period).fill(0);
    }

    var inputRSI = {
        high: data.high,
        low: data.low,
        close: data.close,
        volume: data.volume,
        period: period
    }

    returnArr = new Array(period - 1).fill(0);
    arrRSI = RSI.calculate(inputRSI);
    returnArr = returnArr.concat(arrRSI);
    return returnArr;
}


module.exports = {
    calculateMACD,
    calculateMA,
    calculateRSI14,
    calculateMFI14
}