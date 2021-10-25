CREATE TABLE "financeinfo" (
	"StockCode"	TEXT NOT NULL,
	"ReportTermType"	TEXT NOT NULL,
	"YearPeriod"	INTEGER NOT NULL,
	"TermCode"	TEXT NOT NULL,
	"ReportComponentNameEn"	TEXT NOT NULL,
	"NameEn"	TEXT NOT NULL,
	"UnitEn"	TEXT,
	"Value"	INTEGER,
	"PeriodBegin"	TEXT,
	"PeriodEnd"	TEXT,
	"ReportComponentName"	TEXT,
	"Name"	TEXT,
	"Unit"	TEXT,
	PRIMARY KEY("StockCode","ReportTermType","TermCode","ReportComponentNameEn","NameEn","YearPeriod")
);


CREATE TABLE "stockindustry" (
	"id"	INTEGER NOT NULL UNIQUE,
	"IndustryName"	INTEGER NOT NULL UNIQUE,
	"url"	TEXT,
	PRIMARY KEY("id" AUTOINCREMENT)
);

CREATE TABLE "tradinginfo" (
	"StockCode"	TEXT NOT NULL UNIQUE,
	"url"	TEXT,
	"LastPrice"	INTEGER,
	"KLCPLH"	INTEGER,
	"KLCPNY"	INTEGER,
	"TotalVol"	INTEGER,
	"MarketCapital"	INTEGER,
	"OwnedRatio"	INTEGER,
	"Dividend"	INTEGER,
	"Max52W"	INTEGER,
	"Min52W"	INTEGER,
	"Vol52W"	INTEGER,
	"OutstandingBuy"	INTEGER,
	"OutstandingSell"	INTEGER,
	"EPS"	INTEGER,
	"PE"	INTEGER,
	"FEPS"	INTEGER,
	"BVPS"	INTEGER,
	"PB"	INTEGER,
	"IndustryName"	TEXT,
	"updatedAt"	INTEGER,
	PRIMARY KEY("StockCode")
);