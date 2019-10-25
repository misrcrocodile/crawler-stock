
const fs = require("fs");
const Promise = require("bluebird");
const sqlite3 = require("./../utils/adapter");
const Util = require('./../utils/Util');
const SQLITE3_PATH = "./stock.db";
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

// CONSTRUCTOR
var StockHistory = function(isDeleteDb = false) {
  initDb();
};

StockHistory.prototype.isExistDbFile = function() {
  return Util.fileIsExists(SQLITE3_PATH);
}
StockHistory.prototype.initDb = function(e) {
  return initDb(e);
}

StockHistory.prototype.reInitDb = function() {
  return reInitDb();
}

/**
 * Delete all record of table
 */
StockHistory.prototype.deleteAll = function() {
  // query string
  var strQuery = `DELETE FROM STOCK_HISTORY;`;
  
  // Execute sql
  return executeSqlPush(strQuery, 'Delete all from stock_history');
};

// ok
StockHistory.prototype.get = function(code) {
  var strQuery = `SELECT * FROM STOCK_HISTORY WHERE code = "${code}" order by time;`;
  return executeSqlPull(strQuery, "Can't any record. code=" + code);
};

StockHistory.prototype.updateLastestItem = function(data) {
  let queryStr;
  let logMsg;

  // convert crawl data to db data
  data = toBulkObject(data);
  data = getLastBulkItem(data);
  
  // create query string
  queryStr = getUpdateString(data);
  
  // write log
  logMsg = "Update lastest Data: " + data.code + " into Stock_HISTORY: size = 1";
  
  return executeSqlPush(queryStr, logMsg);
};

StockHistory.prototype.insertLastestItem = function(data) {
  let queryStr;
  let logMsg;

  // convert crawl data to db data
  data = toBulkObject(data);
  data = getLastBulkItem(data);
  
  // create query string
  queryStr = getInsertDistinceString(data);

  // write log
  logMsg = "Insert lastest Data: " + data.code + " into Stock_HISTORY: size = 1";
  
  return executeSqlPush(queryStr, logMsg);
};


StockHistory.prototype.insert = function(data) {
  let queryStr;
  let logMsg;
  // convert crawl data to db data
  data = toBulkObject(data);

  // create query string
  queryStr = getInsertString(data);

  // write log
  logMsg = "Insert " + data.code + " into Stock_HISTORY: size=" + data.length;
  
  return executeSqlPush(queryStr, logMsg, data.length);
};

StockHistory.prototype.getSummaryEveryday = function(limitTime) {
  
  var strQuery = `SELECT code, time, open, macd_histogram, volume,(close - open) AS grow 
     FROM STOCK_HISTORY 
     WHERE open > 15 
      AND macd_histogram > -2 
      AND volume > 500000 
      AND time >= (SELECT MIN(mintime) FROM (SELECT DISTINCT time AS mintime FROM STOCK_HISTORY ORDER BY time DESC LIMIT ${limitTime}))
     ORDER BY time, macd_histogram DESC;`;

  return executeSqlPull(strQuery, 'error in getting summary everyday');
};


StockHistory.prototype.isExistDataByTime = function(time) {
  var strQuery = `SELECT * FROM STOCK_HISTORY WHERE time = ${time} LIMIT 1;`
  return executeSqlPull(strQuery,"").then(() => {
    return true;
  }).catch(()=> {
    return false;
  });
}

StockHistory.prototype.toBulkObject = function(data) {
  return toBulkObject(data);
};

StockHistory.prototype.toArray = function(data) {
  return toArray(data);
};

function deleteDbFile() {
  new Promise((resolve, reject) => {
    // delete file named SQLITE3_PATH
    fs.unlink(SQLITE3_PATH, function(err) {

      if (err) {
        console.log("Have no file to delete.");
        reject({ err: "Have no file to delete." });
      }

      // if no error, file has been deleted successfully
      console.log({ msg: "File deleted!" });
      resolve("File deleted!");
    });
  });
}

async function initDb(isDeleteDbFile = false) {
  // delete db file
  if (isDeleteDbFile) {
    await deleteDbFile();
  }

  // Init sqlite
  this.db = sqlite3.init(SQLITE3_PATH);

  // If db file is deleted, create new one
  if(isDeleteDbFile) {
    createStockHistoryTable(db);
  }
}

async function reInitDb() {
  return await initDb(false);
}

/**
 * Convert Array[object] to bulk object
 *
 * @param {Array[Object]} objArr Object:{code, time, high, low, ...}
 * @return {BulkObject} retObj that have many array inside
 *                      Object:{code: 'FPT', length, time[], high[], low[], ...}
 * function convert2DataArray(data) {
 */
function toArray(objArr) {
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
 * @param {BulkObject} Bulk Object: {code, length, time[], high[], low[], ...}
 * @return {BulkObject} Bulk Object: {code, length, time[], high[], low[], ...}
 */
function toBulkObject(bulkObj) {
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
 * @param {BulkObject} data
 */
function getLastBulkItem(bulkObj) {
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
 * Get create table "STOCK_HISTORY" string
 * @return queryStr "CREATE TABLE .... "
 */
function getCreateTableString() {
  let queryStr =
    "CREATE TABLE `STOCK_HISTORY` (" +
    "`code` TEXT NOT NULL," +
    "`time` NUMERIC NOT NULL,";

  // Add more property to table
  for (var i = 0; i < PROPERTY_LIST.length; i++) {
    queryStr += "`" + PROPERTY_LIST[i] + "` REAL,";
  }
  // Add primary key
  queryStr += "PRIMARY KEY(`code`,`time`)" + ") WITHOUT ROWID;";

  return queryStr;
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
  let valueArr = [];
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
 * Init STOCK_HISTORY table
 * @param {pDb} pDb
 */
function createStockHistoryTable(pDb) {
  let queryStr = getCreateTableString();

  // Logging
  console.log("Create STOCK_HISTORY table if not exists.");
  console.log("SQL query: ", queryStr);

  // Execute sql
  pDb.run(queryStr, function(err, _res) {
    if (err) {
      console.log("Error on create table STOCK_HISTORY", err);
    } else {
      console.log("Table STOCK_HISTORY is created if not exists!");
    }
  });
}

/**
 * Execute SQL query
 * @param {String} strQuery execute query string 
 * @param {String} errMsg error message
 */
const executeSql = function(strQuery, errMsg) {
  const thisDb = this.db;
  return new Promise(function(resolve, reject) {
    thisDb.all(strQuery, function(err, row) {
      if (err) {
        reject({ err: err });
      } else {
        if (row.length == 0) {
          reject({ err: errMsg });
        } else {
          resolve(row);
        }
      }
    });
  });
};

/**
 * Execute SQL query
 * @param {String} strQuery execute query string 
 * @param {String} errMsg error message
 */
const executeSqlPull = function(strQuery, errMsg) {
  const thisDb = this.db;
  return new Promise(function(resolve, reject) {
    thisDb.all(strQuery, function(err, row) {
      if (err) {
        reject({ err: err });
      } else {
        if (row.length == 0) {
          reject({ err: errMsg });
        } else {
          resolve(row);
        }
      }
    });
  });
};


const executeSqlPush = function(strQuery, logMsg, dataLen = 0) {
  const thisDb = this.db;
  return new Promise(function(resolve, reject) {
    thisDb.run(strQuery, function(err, row) {
      if (err) {
        var errMessage = logMsg + " ~> Error!!";
        console.log(errMessage);
        console.log("SQL query: ", strQuery.substring(0, 400), "...");
        reject({ err: err });
      } else {
        console.log(logMsg + " ~> Done!!");
        resolve({ row_num: dataLen });
      }
    });
  });
};


module.exports = StockHistory;
