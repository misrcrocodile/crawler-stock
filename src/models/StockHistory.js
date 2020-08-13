const Promise = require("bluebird");
const mysql   = require('mysql');
require('dotenv').config();
const dbInfo = {
  user: process.env.MYSQL_USER,
  host: process.env.MYSQL_HOST,
  database: process.env.MYSQL_DATABASE,
  password: process.env.MYSQL_PASSWORD,
  port: process.env.MYSQL_PORT
};
const connection = mysql.createConnection(dbInfo);
 
connection.connect((err) => {
  if(!err)
      console.log('Database is connected!');
  else
      console.log('Database not connected! : '+ JSON.stringify(err, undefined,2));
      console.log('Database Info:', dbInfo);
  });

const PROPERTY_LIST = [
  "high",
  "low",
  "open",
  "close",
  "volume",
  "macd_macd",
  "macd_histogram",
  "macd_signal",
  "rsi14",
  "ma9",
  "ma20",
  "ma200",
  "mfi14",
  "vol20"
];

const get = function(code) {
  var strQuery = `SELECT * FROM STOCK_HISTORY WHERE code = "${code}" order by time;`;
  return runQuery(strQuery, "Can't any record. code=" + code);
};

const updateLastestItem = function(data) {
  let queryStr;
  let logMsg;

  if(data.length === 0) return;
  
  // convert crawl data to db data
  data = toCrawlerObject(data);
  data = toNewestDbObject(data);
  
  // create query string
  queryStr = getUpdateString(data);
  
  // write log
  logMsg = "Update lastest Data: " + data.code + " into Stock_HISTORY: size = 1";
  
  return upsert(queryStr, logMsg);
};

/**
 * Inserting newest item to database
 * @param {Object} data Crawler's data {code:..., high:[], low:[], ...}
 */
const insertLastestItem = function(data) {
  let queryStr;
  let logMsg;

  // convert crawl data to db data
  data = toCrawlerObject(data);
  data = toNewestDbObject(data);
  
  // create query string
  queryStr = getInsertDistinceString(data);

  // write log
  logMsg = "Insert lastest Data: " + data.code + " into Stock_HISTORY: size = 1";
  
  return upsert(queryStr, logMsg);
};

/**
 * Inserting database's Object to database
 * @param {Object} data database's object want to insert 
 */
const insert = function(data) {
  let queryStr;
  let logMsg;

  if(data.length === 0) return;
  
  // convert crawl data to db data
  data = toCrawlerObject(data);

  // create query string
  queryStr = getInsertString(data);

  // write log
  logMsg = "Insert " + data.code + " into Stock_HISTORY: size=" + data.length;
  
  return upsert(queryStr, logMsg, data.length);
};

/**
 * Get statistic of whole stock market by using MACD Indicator
 * @param {Integer} limitTime number of day will be output to report
 */
const getMACDDashboard = function(limitTime) {
  
  var strQuery = `SELECT SH.code, SH.time, SH.open, SH.macd_histogram, SH.volume, (SH.close - SH.open) AS grow 
     FROM STOCK_HISTORY AS SH,
     (SELECT MIN(time) as mintime FROM (SELECT DISTINCT time FROM STOCK_HISTORY ORDER BY time DESC LIMIT ${limitTime}) as tempTime) as kako
     WHERE SH.open > 15 
      AND SH.macd_histogram > -2 
      AND SH.volume > 500000 
      AND SH.time >= kako.mintime
     ORDER BY SH.time, SH.macd_histogram DESC;`;

  return runQuery(strQuery, 'error in getting summary everyday');
};

/**
 * Check data in database whether it exists or not
 * @param {Integer} time Check time point
 */
const isExistDataByTime = function(time) {
  var strQuery = `SELECT * FROM STOCK_HISTORY WHERE time = ${time} LIMIT 1;`
  return runQuery(strQuery,"").then(() => {
    return true;
  }).catch(()=> {
    return false;
  });
}

/**
 * Getting top grow stock intraday
 */
const getTodayTopGrow = function() {
  var strQuery = `SELECT SH.code, SH.close, round(SH.close - SH.open, 2) as grow, CONCAT(round(((SH.close - SH.open) *100)/ SH.open ,2), "%") as percent, SH.volume 
  FROM STOCK_HISTORY as SH,
    (SELECT MAX(time) AS time FROM STOCK_HISTORY) AS IMA
  WHERE SH.time = IMA.time
  AND SH.volume > 200000
  AND SH.close > 10
  ORDER BY percent DESC
  LIMIT 50`;
  return runQuery(strQuery, 'error in getting topGrow everyday');
}
/**
 * Getting top stock today by using past data via vol20, low_price
 * @param {Integer} day number of day before today. Using for compare stock up or down. 
 * @param {Integer} vol20 averange volumn in 20 days
 * @param {integer} imalow low_price today
 */
const getTopStockList = async function(day = 20, vol20 = 100000, imalow = 10) {
  let strQuery = `WITH
  IMA AS (
    SELECT SH.* 
    FROM STOCK_HISTORY AS SH,
      (SELECT MAX(time) AS time FROM STOCK_HISTORY) AS IMA_TIME
      WHERE SH.time = IMA_TIME.time),
  KAKO AS (
    SELECT SH.code, SH.low 
    FROM STOCK_HISTORY AS SH,
      ( SELECT MIN(mintime) AS time 
      FROM ( SELECT DISTINCT time AS mintime 
        FROM STOCK_HISTORY 
        ORDER BY time DESC 
        LIMIT ${day}) AS TEMP_TIME
      ) AS KAKO_TIME
    WHERE SH.time = KAKO_TIME.time
  ),
  RESULT AS(
    SELECT IMA.code, IMA.close, IMA.low AS imalow, KAKO.low AS kakolow, ROUND(IMA.low - KAKO.low, 2) AS grow, IMA.vol20, (ROUND(100 * (IMA.low - KAKO.low) / KAKO.low, 2)) AS diff
    FROM IMA
    LEFT JOIN KAKO 
    ON IMA.code = KAKO.code
  )
  SELECT * FROM RESULT
  WHERE vol20 > ${vol20} AND imalow > ${imalow} AND diff > 0
  ORDER BY diff DESC
  LIMIT 40;`;

  var data =  await runQuery(strQuery, "error in getTopStockList");
  return data.map(e => {return {code:e.code, close: e.close, grow:e.grow, percent: e.diff, volume: e.vol20}});
}

/**
 * Check STOCK_HISTORY database is blank or not.
 * Using to make decision whether data update or insert
 */
const isBlankDatabase = async function() {
  let strQuery = `SELECT COUNT(*) AS countsize FROM STOCK_HISTORY;`;
  let data = await runQuery(strQuery,"");
  if(data.length > 0 && data[0].countsize > 0){
    return false;
  }
  return true;
}

/**
 * Convert Array[object] to bulk object
 *
 * @param {Array[Object]} objArr Object:{code, time, high, low, ...}
 * @return {CrawlerObject} retObj that have many array inside
 *                      Object:{code: 'FPT', length, time[], high[], low[], ...}
 * function convert2DataArray(data) {
 */
const toArray = function(objArr) {
  // Create object
  let bulkObj = { code: objArr[0].code, time: [] };
  PROPERTY_LIST.map(e => (bulkObj[e] = []));

  // Loop each item in data array and push into array of object
  for (var i = 0; i < objArr.length; i++) {
    bulkObj.time.push(objArr[i].time);
    PROPERTY_LIST.map(e => {
      bulkObj[e].push(objArr[i][e]);
    });
  }

  // Set size of item
  bulkObj.length = objArr.length;
  return bulkObj;
}

/**
 * Add missing property in Bulk Object
 *
 * @param {CrawlerObject} Bulk Object: {code, length, time[], high[], low[], ...}
 * @return {CrawlerObject} Bulk Object: {code, length, time[], high[], low[], ...}
 */
const toCrawlerObject = function(bulkObj) {
  let retObj = {};

  // Create blank Bulk Obj
  PROPERTY_LIST.map(e => (retObj[e] = new Array(bulkObj.length).fill(0)));

  // Copy all prop to new Bulk Obj
  for (var key in bulkObj) {
    retObj[key] = bulkObj[key];
  }

  return retObj;
}

/**
 * Convert bulk object to object by getting the lastest item of bulk object
 * @param {CrawlerObject} data
 */
const toNewestDbObject = function(bulkObj) {
  let retObj = {};

  // Looping each prop of bulkObj
  // and get all the lastest item of each prop
  for (const prop in bulkObj) {
    let val = bulkObj[prop];
    retObj[prop] = Array.isArray(val) ? val[val.length - 1] : val;
  }

  return retObj;
}

/**
 * Create each VALUES () block in INSERT query
 *
 * @param {String} code ex: ABC, DEF
 * @param {Array[Object]} arrObj Object:{code, time[], high[], low[], ...}
 * @param {Integer} index index of item
 * @return {String} itemStr content:("FPT", "100", ...)
 */
function getInsertString_Value(code, arrObj, index) {
  let itemStr = '("' + code + '",' + arrObj.time[index] + ",";
  let propArr = [];

  // push prop to propArr
  PROPERTY_LIST.map(obj =>
    propArr.push(arrObj[obj][index] === undefined ? 0 : arrObj[obj][index])
  );

  // join a propArr with comma
  itemStr += propArr.join(",") + ")";

  return itemStr;
}

/**
 * Create SQL insert string for bulk object
 *
 * @param {Array[Object]} arrObj Object:{code, time[], high[], low[], ...}
 * @return {String} queryStr INSERT CLAUSE VALUES (),(), ...
 */
function getInsertString(arrObj) {
  let queryStr = "INSERT INTO STOCK_HISTORY ( code, time, ";
  let valueArr = [];
  let propArr = [];

  queryStr += PROPERTY_LIST.join(",") + ") VALUES ";

  // loop each record and add each item to valueArr
  for (var i = 0; i < arrObj.length; i++) {
    valueArr.push(getInsertString_Value(arrObj.code, arrObj, i));
  }

  // trim the last comma
  queryStr += valueArr.join(",") + ";";

  return queryStr;
}

function getInsertDistinceString(arrObj) {
  let queryStr = "INSERT INTO STOCK_HISTORY ( code, time, ";
  let propArr = [];
  
  PROPERTY_LIST.map(e => propArr.push(arrObj[e]));
  
  queryStr += PROPERTY_LIST.join(',');
  queryStr += `) VALUES ("${arrObj.code}",${arrObj.time},`;
  queryStr += propArr.join(',') + ');'
  
  return queryStr;
}
/**
 * Create SQL update only 1 object
 *
 * @param {object} data object:{code, time, high, low, open, close , ...}
 * @return {string} queryString UPDATE STOCK SET ...
 */
function getUpdateString(data) {
  let queryStr = "UPDATE STOCK_HISTORY SET ";
  let arr = [];

  // build a set  
  PROPERTY_LIST.map(prop => arr.push(`${prop} = ${data[prop]}`));
  queryStr += arr.join(",");

  // add condition
  queryStr += ` WHERE time = ${data.time} AND code = "${data.code}";`;

  return queryStr;
}

/**
 * Execute SQL query
 * @param {String} strQuery execute query string 
 * @param {String} errMsg error message
 */
const runQuery = function(strQuery, errMsg) {
  return new Promise(function(resolve, reject) {
    connection.query(strQuery, function (error, results, _fields) {
      if (error) {
        reject({ err: error });
      }else {
        if (results.length == 0) {
          reject({ err: errMsg });
        } else {
          resolve(results);
        }
      }
    });
  });
};

const upsert = function(strQuery, logMsg, dataLen = 0) {
  return new Promise(function(resolve, reject) {
    connection.query(strQuery, function (error, results, _fields) {
      if (error) {
        var errMessage = logMsg + " ~> Error!!";
        console.log(errMessage);
        console.log("SQL query: ", strQuery.substring(0, 400), "...");
        reject({ err: error });
      }else {
        console.log(logMsg + " ~> Done!!");
        resolve({ row_num: dataLen });
      }
    });
  });
};

module.exports = {
  toArray,
  get,
  updateLastestItem,
  insertLastestItem,
  insert,
  getMACDDashboard,
  isExistDataByTime,
  toCrawlerObject,
  getTodayTopGrow,
  getTopStockList,
  toNewestDbObject,
  isBlankDatabase
};