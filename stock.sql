select code, open, macd_histogram, volume,(close - open) as grow
from stock_history
where open > 15
and macd_histogram > -2
and volume > 500000
and time = (select max(time) from stock_history)
order by macd_histogram asc


SELECT code, (close-open)*volume AS grow
FROM stock_history
WHERE time = (SELECT max(time) FROM stock_history)
ORDER BY grow ASC 
LIMIT 50


select code, open, macd_histogram, volume,(close - open) as grow
from stock_history
where open > 15
and macd_histogram > -2
and volume > 500000
and time >= select min(mintime) from (select distinct time as mintime from stock_history order by time desc limit 7)
order by macd_histogram asc


select min(time) from stock_history order by time desc limit 7
1164067200
1164067200
1569888000