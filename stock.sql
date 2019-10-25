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


SELECT code, open, volume, vol20
from stock_history
where time = (select min(mintime) from (select distinct time as mintime from stock_history order by time desc limit 2))
and volume > vol20
order by volume desc

SELECT * FROM STOCK_HISTORY WHERE time = (select max(time) from stock_history) and code='AAA'



SELECT code, open, close, (close-open)*100/open as sa, volume, vol20, volume/vol20 as bu
from stock_history
where time = (select max(time) from stock_history)--(select min(mintime) from (select distinct time as mintime from stock_history order by time desc limit 2))
and volume > vol20
and volume > 100000
and sa > 0
order by sa desc

select min(time) from stock_history order by time desc limit 7
1164067200
1164067200
1569888000

delete from stock_history where code = 'AAA' and time = (select max(time) from stock_history)
