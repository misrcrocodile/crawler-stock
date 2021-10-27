"use strict";
const Promise = require("bluebird");
const curl = require("../utils/curl");
const fs = require("fs");
const cheerio = require("cheerio");
const sqlite3 = require("sqlite3").verbose();
const VND = require("./Vndirect");

const LOW_CONCURRENCY = 10;

const db = new sqlite3.Database("./vietstock.db", (err) => {
  if (err) {
    return console.error(err.message);
  }

  console.log("Connected to the in-memory SQlite database.");
});

function selectCommand(query) {
  return new Promise((resolve, reject) => {
    db.all(query, [], (err, rows) => {
      if (err) {
        reject(err);
      }
      resolve(rows);
    });
  });
}
function writeToFile(listObj, filename) {
  let financeinfoProperty = [
    "StockCode",
    "ReportTermType",
    "YearPeriod",
    "TermCode",
    "ReportComponentNameEn",
    "NameEn",
    "UnitEn",
    "Value",
    "PeriodBegin",
    "PeriodEnd",
    "ReportComponentName",
    "Name",
    "Unit",
    "page",
  ];
  let data = [
    `"StockCode","ReportTermType","YearPeriod","TermCode","ReportComponentNameEn","NameEn","UnitEn","Value","PeriodBegin","PeriodEnd","ReportComponentName","Name","Unit","page"`,
  ];
  for (let i = 0; i < listObj.length; i++) {
    let strList = [];
    for (let j = 0; j < financeinfoProperty.length; j++) {
      strList.push(`"${listObj[i][financeinfoProperty[j]]}"`);
    }
    data.push(strList.join(","));
  }
  fs.writeFile(filename, data.join("\n"), "utf8", (err) => {
    if (err) {
      console.error(err);
      return;
    }
    //file written successfully
  });
}

function clone(a) {
  return JSON.parse(JSON.stringify(a));
}

async function getListCode() {
  const getListStockCode = function () {
    return new Promise((resolve, reject) => {
      db.all(`SELECT DISTINCT StockCode FROM tradinginfo`, [], (err, rows) => {
        if (err) {
          reject(err);
        }
        resolve(rows);
      });
    });
  };

  let data = await getListStockCode();
  return data.map((a) => a.StockCode);
}

async function getCodeInfo(code) {
  const getCodeDetail = function (stockCode) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT DISTINCT * FROM tradinginfo WHERE StockCode = "${stockCode}"`,
        [],
        (err, rows) => {
          if (err) {
            reject(err);
          }
          resolve(rows);
        }
      );
    });
  };

  let data = await getCodeDetail(code);
  return data[0];
}
/**
 * Get Vietstock url by stock's code and  return object with StockCode and Url
 * @param {string} code
 * @returns {}
 */
async function getUrlByCode(code) {
  console.log("Getting url by code: ", code);
  const url = `"https://finance.vietstock.vn/search/${code}/3"`;
  let res = await curl(url);
  let data = JSON.parse(res).data;
  return { StockCode: code, url: data.split("\n")[0].split("|")[2] };
}

async function insertUrlToDb() {
  const codeList = await VND.getListCode();
  let data = await Promise.map(codeList, getUrlByCode, {
    concurrency: LOW_CONCURRENCY,
  });
  let dataQuery = "INSERT INTO tradinginfo (StockCode, url) VALUES ";
  let values = [];

  for (var i = 0; i < data.length; i++) {
    values.push(`('${data[i].StockCode}','${data[i].url}')`);
  }
  dataQuery += values.join(",");
  db.run(dataQuery);
}

async function updateBasicInfo() {
  let codeList = await getListCode();
  const getBasicInfo = async function (code) {
    console.log("Get basic info code: ", code);
    const dataToken =
      "x3WwXBb4SXPmBzGYDMVSLDzKJEqMD9yvsMiN2IL4d2E6H29tzcCHrvOOaFsSDvGH9k1VnfrVpkpwWaCuRi4KgJJQDC5Y1FCOIfcGnd4kmNA1";
    const cookieToken =
      "5y3G3Fvcb9o2vXWDYPlrS9t17G0t44uML6m6X2y5aa58JugI2Vn6LIdZODm43J_prjtCaFLb1G7IfnASVJhlNDufZbmQpyzSXiRzqBrLQzs1";
    const req = `"https://finance.vietstock.vn/company/tradinginfo" -H "Cookie:__RequestVerificationToken=${cookieToken}" --data-raw "code=${code}&s=0&t=&__RequestVerificationToken=${dataToken}" --compressed`;
    const res = await curl(req);
    let data = JSON.parse(res);
    data.updatedAt = Date.now();
    return data;
  };

  // get data
  let data = await Promise.map(codeList, getBasicInfo, {
    concurrency: LOW_CONCURRENCY,
  });

  const getSql = function (item) {
    let queryStr = `UPDATE tradinginfo SET `;
    let arr = [];
    let props = [
      "LastPrice",
      "KLCPLH",
      "KLCPNY",
      "TotalVol",
      "MarketCapital",
      "OwnedRatio",
      "Dividend",
      "Max52W",
      "Min52W",
      "Vol52W",
      "OutstandingBuy",
      "OutstandingSell",
      "EPS",
      "PE",
      "FEPS",
      "BVPS",
      "PB",
      "updatedAt",
    ];
    props.map((prop) => arr.push(`${prop} = ${item[prop]}`));
    queryStr += arr.join(",");
    queryStr += ` WHERE StockCode = "${item.StockCode}";`;
    return queryStr;
  };

  // update data
  db.run("PRAGMA synchronous=OFF");
  db.run("BEGIN TRANSACTION");
  for (let i = 0; i < data.length; i++) {
    db.run(getSql(data[i]));
  }
  db.run("COMMIT");
}

async function updateAllIndustryName() {
  const getIndustryName = async function (code) {
    const stockInfo = await getCodeInfo(code);
    const data = await curl(`"${stockInfo.url}"`);
    const $ = cheerio.load(data);
    let an = $(".title-x > a");
    let ret = [];

    for (let i = 0; i < an.length; i++) {
      ret.push({
        link: "https://finance.vietstock.vn" + an[i].attribs.href,
        industryName: an[i].children[0].data,
      });
    }
    return ret;
  };

  const updateIndustryName = async function (code) {
    console.log("Update Industry name code: ", code);
    let data = await getIndustryName(code);
    data = JSON.stringify(data);
    const queryStr = `UPDATE tradinginfo SET industryName = '${data}' WHERE StockCode = "${code}";`;
    db.run(queryStr);
  };

  db.run("BEGIN TRANSACTION");
  const codeList = VND.getListCode();
  await Promise.map(codeList, updateIndustryName, {
    concurrency: LOW_CONCURRENCY,
  });
  db.run("COMMIT");
}

async function updateFinanceinfo(flag) {
  let listCode = await VND.getListCode();
  if (flag) {
    let existCode = await getExistsListCode();
    let listCodeArray = [];
    let minLength = 30;

    listCode = listCode.filter((el) => !existCode.includes(el));
    while (listCode.length > minLength) {
      let temp = listCode.splice(0, minLength);
      listCodeArray.push(temp);
    }
    listCodeArray.push(listCode);
    for (let i = 0; i < listCodeArray.length; i++) {
      await updateFinanceinfoByPage(listCodeArray[i]);
    }
  } else {
    await updateFinanceinfoByPage(listCode);
  }
}
/**
 * Get all finance info of every stock and update to database.
 * This field below will be updated to database.
 * StockCode,ReportTermType,YearPeriod,TermCode,ReportComponentNameEn,
 * NameEn,UnitEn,Value,PeriodBegin,PeriodEnd,ReportComponentName,Name,Unit.
 */
async function updateFinanceinfoByPage(listCode) {
  // get finance infomation by page, termtype(year, quarter)

  const getFinanceInfo = async function (code, termType) {
    let arr = [];
    for (let i = 1; i < 100; i++) {
      console.log(
        `getFinanceInfo: code = ${code}, page i = ${i}, termType = ${
          termType === 1 ? "year" : "quarter"
        }`
      );
      const cookieToken =
        "5y3G3Fvcb9o2vXWDYPlrS9t17G0t44uML6m6X2y5aa58JugI2Vn6LIdZODm43J_prjtCaFLb1G7IfnASVJhlNDufZbmQpyzSXiRzqBrLQzs1";
      const dataToken =
        "ILPAP3DRzSmGJrtNK4nfINNJ6hyd9bp4TfNeku5HHMGD5oto-rTv7Oa5s9I2x9UIcHUNG5wdXXz0_PyYVUOPeQLziLNfNgQhm48QglU9qJY1";
      const url = `curl "https://finance.vietstock.vn/data/financeinfo" -H "Cookie:__RequestVerificationToken=${cookieToken}" --data-raw "Code=${code}&Page=${i}&PageSize=4&ReportTermType=${termType}&ReportType=BCTQ&Unit=1000000&__RequestVerificationToken=${dataToken}"  --compressed`;
      let data = await curl(url);
      data = JSON.parse(data);

      // if data is null, break
      if (data[0].length == 0) {
        break;
      }
      // level 1: Bao cao tai chinh
      for (const property in data[1]) {
        // level 2: Ket qua kinh doanh, can doi ke toan, chi so tai chinh
        for (let k = 0; k < data[1][property].length; k++) {
          let block = data[1][property];
          let item = block[k];
          let ret = {};
          ret.StockCode = code;
          ret.ReportTermType = termType === 1 ? "year" : "quarter";
          ret.ReportComponentNameEn = item.ReportComponentNameEn;
          ret.NameEn = item.NameEn;
          ret.UnitEn = item.UnitEn ? item.UnitEn : "VND";
          ret.Unit = item.Unit ? item.Unit : "VNĐ";
          ret.Name = item.Name;
          ret.ReportComponentName = item.ReportComponentName;
          for (let j = 0; j < data[0].length; j++) {
            let temp = clone(ret);
            temp.Value = item["Value" + (j + 1)];
            temp.YearPeriod = data[0][j].YearPeriod;
            temp.TermCode = data[0][j].TermCode;
            temp.PeriodBegin = data[0][j].PeriodBegin;
            temp.PeriodEnd = data[0][j].PeriodEnd;
            temp.page = i;
            arr.push(temp);
          }
        }
      }
    }
    return arr;
  };

  const upsertToDB = (sqlData) => {
    let sql = `INSERT INTO financeinfo(StockCode, ReportTermType, YearPeriod, TermCode, ReportComponentNameEn, NameEn, UnitEn, Value, PeriodBegin, PeriodEnd, ReportComponentName, Name, Unit) 
    VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING;`;
    return new Promise((resolve, reject) => {
      db.run(sql, sqlData, function (err, rows) {
        if (err) {
          reject(err);
        }
        resolve(rows);
      });
    });
  };

  db.run("BEGIN TRANSACTION");
  for (let i = 0; i < listCode.length; i++) {
    let dataYear = await getFinanceInfo(listCode[i], 1);
    let dataQuarter = await getFinanceInfo(listCode[i], 2);
    let data = dataYear.concat(dataQuarter);
    console.log(
      `Update finance's info code: ${listCode[i]}, data.length: ${data.length}`
    );
    for (let j = 0; j < data.length; j++) {
      let a = data[j];
      let sqlData = [
        a.StockCode,
        a.ReportTermType,
        a.YearPeriod,
        a.TermCode,
        a.ReportComponentNameEn,
        a.NameEn,
        a.UnitEn,
        a.Value,
        a.PeriodBegin,
        a.PeriodEnd,
        a.ReportComponentName,
        a.Name,
        a.Unit,
      ];
      await upsertToDB(sqlData);
    }
  }
  console.log("commit update financeinfo");
  db.run("COMMIT");
}

const debug = function () {
  // updateFinanceinfo();
  // updateAllIndustryName();
  updateIndustryName();
};

async function getExistsListCode() {
  const today = new Date();
  const thisYear = today.getFullYear();
  const sql = `select DISTINCT stockcode from financeinfo where YearPeriod = ${thisYear} and TermCode = "N"`;
  const data = await selectCommand(sql);
  return data.map((el) => el.StockCode);
}
async function runCode() {
  console.log("[INSERT URL TO DB]");
  await insertUrlToDb();
  console.log("[UPDATE BASIC INFO]");
  await updateBasicInfo();
  console.log("[UPDATE FINANCE INFO]");
  await updateFinanceinfo(true);
  console.log("[UPDATE ALL INDUSTRY NAME]");
  await updateAllIndustryName();
}
module.exports = {
  debug,
  runCode,
  getListCode,
  getUrlByCode,
  insertUrlToDb,
  updateBasicInfo,
};
