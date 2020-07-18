const SMA = require('technicalindicators').SMA;
const MACD = require('technicalindicators').MACD;
const RSI = require('technicalindicators').RSI;
const MFI = require('technicalindicators').MFI;

// calculate indicator
function calc(data) {
  let macd = calculateMACD(data.close);

  data.ma9 = calculateMA(data.close, 9);
  data.ma20 = calculateMA(data.close, 20);
  data.ma200 = calculateMA(data.close, 200);

  data.macd_macd = macd.MACD;
  data.macd_histogram = macd.histogram;
  data.macd_signal = macd.signal;

  data.rsi14 = calculateRSI14(data.close);
  data.mfi14 = calculateMFI14(data);
  data.vol20 = calculateVol20(data.volume);
  return data;
}

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
    returnArr.data = new Array(arr.length).fill({ MACD: 0, signal: 0, histogram: 0 });
    returnArr.histogram = new Array(arr.length).fill(0);
    returnArr.signal = new Array(arr.length).fill(0);
    returnArr.MACD = new Array(arr.length).fill(0);
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
    returnArr.histogram.push(data[i].histogram || 0);
    returnArr.MACD.push(data[i].MACD || 0);
    returnArr.signal.push(data[i].signal || 0);
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



const calculateVol20 = arr => {
    const period = 20;
    return calculateMA(arr, period);
}



// function getSMA(StockCode, numberOfDate, period) {

//     return getStockHistory(StockCode, numberOfDate).then(data => {
//         let values = data.close;

//         // create SMA data array
//         data.SMA = new Array(period - 1).fill(0);
//         data.SMA = data.SMA.concat(SMA.calculate({ period: period, values: values }));
//         for (var i = 0; i < data.SMA.length; i++) {
//             data.SMA[i] = data.SMA[i].toFixed(3);
//         }
//         return data;
//     });
// }

// TODO: in bugging mode
function calculateMFI14(data) {
  return new Array(data.length).fill(0);
  // var returnArr = [];
  // var arrMFI = [];
  // var period = 14;

  // if (data.length < period) {
  //     return new Array(period).fill(0);
  // }

  // var inputMFI = {
  //     high: data.high,
  //     low: data.low,
  //     close: data.close,
  //     volume: data.volume,
  //     period: period
  // }

  // returnArr = new Array(period + 1).fill(0);
  // arrMFI = MFI.calculate(inputMFI);
  // returnArr = returnArr.concat(arrMFI);
  // return returnArr;
}

module.exports = {
  calc,
  calculateMACD,
  calculateMA,
  calculateRSI14,
  calculateMFI14,
  calculateVol20,
}