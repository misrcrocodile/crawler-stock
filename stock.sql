select code, open, macd_histogram, volume,(close - open) as grow
from stock_history
where open > 15
and macd_histogram > -2
and volume > 400000
and time = 1569283200
order by macd_histogram asc

select max(time) from stock_history
1569283200