var StockHistory = function(pDb) {
  this.db = pDb;
  createStockHistoryTable(pDb);
};
// var StockHistory = function(pDb, isCreateDb) {
//     this.db = pDb;
//     if (isCreateDb) {
//         createStockHistoryTable(pDb);
//     }
// }

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
  "mfi14"
];

function convert2DataArray(data) {
  let retObj = { code: data[0].code, time: [] };

  for (var i = 0; i < PROPERTY_LIST.length; i++) {
    retObj[PROPERTY_LIST[i]] = [];
  }

  for (var i = 0; i < data.length; i++) {
    retObj.time.push(data[i].time);
    for (var j = 0; j < PROPERTY_LIST.length; j++) {
      retObj[PROPERTY_LIST[j]].push(data[i][PROPERTY_LIST[j]]);
    }
  }
  retObj.length = data.length;
  return retObj;
}

function convert2DataObj(data) {
  let retObj = {};

  // create blank data
  for (i = 0; i < PROPERTY_LIST.length; i++) {
    retObj[PROPERTY_LIST[i]] = new Array(data.length).fill(0);
  }

  // fill data into object
  for (var key in data) {
    retObj[key] = data[key];
  }

  return retObj;
}

// create query string to init STOCK_HISTORY table
function createQueryString_CreateTable() {
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

function getInsertObjectStr(code, data, index) {
  let queryStr = '("' + code + '",' + data.time[index] + ",";

  for (var i = 0; i < PROPERTY_LIST.length; i++) {
    var propName = PROPERTY_LIST[i];
    var item = data[propName][index];
    item = item === undefined ? 0 : item;
    queryStr += item + ",";
  }

  // trim the last comma
  queryStr = queryStr.substring(0, queryStr.length - 1);
  queryStr += ")";
  return queryStr;
}

function createQueryString_InsertData(data) {
  let queryStr = "INSERT INTO STOCK_HISTORY ( code, time, ";

  for (var i = 0; i < PROPERTY_LIST.length; i++) {
    queryStr += PROPERTY_LIST[i] + ",";
  }

  // trim the last comma
  queryStr = queryStr.substring(0, queryStr.length - 1);
  queryStr += ") VALUES ";

  // loop each record
  for (var i = 0; i < data.length; i++) {
    queryStr += getInsertObjectStr(data.code, data, i) + ",";
  }

  // trim the last comma
  queryStr = queryStr.substring(0, queryStr.length - 1);

  return queryStr;
}

// Create table if it not exists
function createStockHistoryTable(pDb) {
  let queryStr = createQueryString_CreateTable();

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

StockHistory.prototype.get = function(code) {
  let thisDb = this.db;
  return new Promise(function(resolve, reject) {
    var strQuery = 'SELECT * FROM STOCK_HISTORY WHERE code = "' + code + '"';

    // Execute sql
    thisDb.all(strQuery, function(err, row) {
      if (err) {
        reject({ err: err });
      } else {
        if (row.length == 0) {
          reject({ err: "Can't any record. code=" + code });
        } else {
          resolve(row);
        }
      }
    });
  });
};

StockHistory.prototype.getLimit = function(code, limit, isAscByTime) {
  let thisDb = this.db;
  let strOrder = isAscByTime === true ? "ASC" : "DESC";
  return new Promise(function(resolve, reject) {
    var strQuery =
      'SELECT * FROM STOCK_HISTORY WHERE code = "' +
      code +
      '" ORDER BY time ' +
      strOrder +
      " LIMIT " +
      limit;

    // Logging
    // console.log("Get data from STOCK_HISTORY table.");
    // console.log("SQL query: ", strQuery);

    // Execute sql
    thisDb.all(strQuery, function(err, row) {
      if (err) {
        reject({ err: err });
      } else {
        resolve(row);
      }
    });
  });
};

StockHistory.prototype.insert = function(data) {
  let thisDb = this.db;
  let queryStr;

  // convert crawl data to db data
  data = convert2DataObj(data);
  queryStr = createQueryString_InsertData(data);

  // Execute sql
  return new Promise(function(resolve, reject) {
    thisDb.run(queryStr, function(err, _res) {
      var logMsg =
        "Insert " + data.code + " into Stock_HISTORY: size=" + data.length;
      if (err) {
        var errMessage = logMsg + " ~> Error!!";
        console.log(errMessage);
        console.log("SQL query: ", queryStr.substring(0, 400), "...");
        reject({ err: err });
      } else {
        console.log(logMsg + " ~> Done!!");
        resolve({ row_num: data.length });
      }
    });
  });
};

StockHistory.prototype.convert2DataObj = function(data) {
  return convert2DataObj(data);
};

StockHistory.prototype.convert2DataArray = function(data) {
  return convert2DataArray(data);
};
module.exports = StockHistory;
