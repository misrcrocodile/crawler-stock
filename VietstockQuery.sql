WITH RECURSIVE
  NetRevenue(StockCode, Value, Name) AS (SELECT StockCode, Value, Name FROM financeinfo WHERE YearPeriod = 2020 and TermCode = "N" and NameEn = "Net revenue"),
  GrossProfit(StockCode, Value, Name) AS (SELECT StockCode, Value, Name FROM financeinfo WHERE YearPeriod = 2020 and TermCode = "N" and NameEn = "Gross profit"),
  OperatingProfit(StockCode, Value, Name) AS (SELECT StockCode, Value, Name FROM financeinfo WHERE YearPeriod = 2020 and TermCode = "N" and NameEn = "Operating profit"),
  ProfitAfterTax(StockCode, Value, Name) AS (SELECT StockCode, Value, Name FROM financeinfo WHERE YearPeriod = 2020 and TermCode = "N" and NameEn = "Profit after tax"),
  NetProfit(StockCode, Value, Name) AS (SELECT StockCode, Value, Name FROM financeinfo WHERE YearPeriod = 2020 and TermCode = "N" and NameEn = "Net profit"),
  CurrentAssets(StockCode, Value, Name) AS (SELECT StockCode, Value, Name FROM financeinfo WHERE YearPeriod = 2020 and TermCode = "N" and NameEn = "Current assets"),
  TotalAssets(StockCode, Value, Name) AS (SELECT StockCode, Value, Name FROM financeinfo WHERE YearPeriod = 2020 and TermCode = "N" and NameEn = "Total assets"),
  Liabilities(StockCode, Value, Name) AS (SELECT StockCode, Value, Name FROM financeinfo WHERE YearPeriod = 2020 and TermCode = "N" and NameEn = "Liabilities"),
  ShortTermLiabilities(StockCode, Value, Name) AS (SELECT StockCode, Value, Name FROM financeinfo WHERE YearPeriod = 2020 and TermCode = "N" and NameEn = "Short -term liabilities"),
  OwnerEnquity(StockCode, Value, Name) AS (SELECT StockCode, Value, Name FROM financeinfo WHERE YearPeriod = 2020 and TermCode = "N" and NameEn = "Owner's equity"),
  MinorityInterest(StockCode, Value, Name) AS (SELECT StockCode, Value, Name FROM financeinfo WHERE YearPeriod = 2020 and TermCode = "N" and NameEn = "Minority interest"),
  TrailingEPS(StockCode, Value, Name) AS (SELECT StockCode, Value, Name FROM financeinfo WHERE YearPeriod = 2020 and TermCode = "N" and NameEn = "Trailing EPS"),
  BookValuePerShare(StockCode, Value, Name) AS (SELECT StockCode, Value, Name FROM financeinfo WHERE YearPeriod = 2020 and TermCode = "N" and NameEn = "Book value per share"),
  PE(StockCode, Value, Name) AS (SELECT StockCode, Value, Name FROM financeinfo WHERE YearPeriod = 2020 and TermCode = "N" and NameEn = "P/E"),
  ROS(StockCode, Value, Name) AS (SELECT StockCode, Value, Name FROM financeinfo WHERE YearPeriod = 2020 and TermCode = "N" and NameEn = "ROS"),
  ROEA(StockCode, Value, Name) AS (SELECT StockCode, Value, Name FROM financeinfo WHERE YearPeriod = 2020 and TermCode = "N" and NameEn = "ROEA"),
  ROAA(StockCode, Value, Name) AS (SELECT StockCode, Value, Name FROM financeinfo WHERE YearPeriod = 2020 and TermCode = "N" and NameEn = "ROAA")
SELECT 
  NetRevenue.StockCode as StockCode,
  NetRevenue.Value as NetRevenue,
  GrossProfit.Value as GrossProfit,
  OperatingProfit.Value as OperatingProfit,
  ProfitAfterTax.Value as ProfitAfterTax,
  NetProfit.Value as NetProfit,
  CurrentAssets.Value as CurrentAssets,
  TotalAssets.Value as TotalAssets,
  Liabilities.Value as Liabilities,
  ShortTermLiabilities.Value as ShortTermLiabilities,
  OwnerEnquity.Value as OwnerEnquity,
  MinorityInterest.Value as MinorityInterest,
  TrailingEPS.Value as TrailingEPS,
  BookValuePerShare.Value as BookValuePerShare,
  PE.Value as PE,
  ROS.Value as ROS,
  ROEA.Value as ROEA,
  ROAA.Value as ROAA
FROM NetRevenue
LEFT JOIN GrossProfit ON NetRevenue.StockCode = GrossProfit.StockCode
LEFT JOIN OperatingProfit ON NetRevenue.StockCode = OperatingProfit.StockCode
LEFT JOIN ProfitAfterTax ON NetRevenue.StockCode = ProfitAfterTax.StockCode
LEFT JOIN NetProfit ON NetRevenue.StockCode = NetProfit.StockCode
LEFT JOIN CurrentAssets ON NetRevenue.StockCode = CurrentAssets.StockCode
LEFT JOIN TotalAssets ON NetRevenue.StockCode = TotalAssets.StockCode
LEFT JOIN Liabilities ON NetRevenue.StockCode = Liabilities.StockCode
LEFT JOIN ShortTermLiabilities ON NetRevenue.StockCode = ShortTermLiabilities.StockCode
LEFT JOIN OwnerEnquity ON NetRevenue.StockCode = OwnerEnquity.StockCode
LEFT JOIN MinorityInterest ON NetRevenue.StockCode = MinorityInterest.StockCode
LEFT JOIN TrailingEPS ON NetRevenue.StockCode = TrailingEPS.StockCode
LEFT JOIN BookValuePerShare ON NetRevenue.StockCode = BookValuePerShare.StockCode
LEFT JOIN PE ON NetRevenue.StockCode = PE.StockCode
LEFT JOIN ROS ON NetRevenue.StockCode = ROS.StockCode
LEFT JOIN ROEA ON NetRevenue.StockCode = ROEA.StockCode
LEFT JOIN ROAA ON NetRevenue.StockCode = ROAA.StockCode
