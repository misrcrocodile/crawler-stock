# Stock Crawler
Get dairy stock trading info from stock exchange, recalculate by using indicator.
Raw data will be save to MySql and recaculated data will be save to the Note API for many purpose.

## 1. Setup

```
# Logging in to mysql
sudo mysql -u root

# Creating database
DROP DATABASE IF EXISTS STOCK_DB;
CREATE DATABASE STOCK_DB;

# Creating user and grant permission to database
DROP USER 'STOCK_USER'@'localhost';
CREATE USER 'STOCK_USER'@'localhost' IDENTIFIED WITH mysql_native_password BY '@YOUR_PASSWORD_HERE1';
GRANT ALL PRIVILEGES ON STOCK_DB.* TO 'STOCK_USER'@'localhost';

# Connecting to database
CONNECT STOCK_DB;

# Creating table
DROP TABLE IF EXISTS STOCK_HISTORY;
CREATE TABLE STOCK_HISTORY (
  code VARCHAR(50) NOT NULL,
  time NUMERIC NOT NULL,
  high REAL,
  low REAL,
  open REAL,
  close REAL,
  volume REAL,
  macd_macd REAL,
  macd_histogram REAL,
  macd_signal REAL,
  rsi14 REAL,
  ma9 REAL,
  ma20 REAL,
  ma200 REAL,
  mfi14 REAL,
  vol20 REAL,
  PRIMARY KEY(code,time));

# Add index to table
ALTER TABLE STOCK_HISTORY ADD INDEX (time);
ALTER TABLE STOCK_HISTORY ADD INDEX (code);
ALTER TABLE STOCK_HISTORY ADD INDEX (time, code);

# Refresh privileges:
flush privileges;
```
## 2. Execute
```
# Run from npm
npm start

# Run from pm2
pm2 start index.js
```

## 3. Others
```
#Change mysql policy requirements about settings password
SHOW VARIABLES LIKE 'validate_password%';
SET GLOBAL validate_password.length = 6;
SET GLOBAL validate_password.number_count = 0;
SET GLOBAL validate_password.mixed_case_count = 0;
SET GLOBAL validate_password.special_char_count = 0;
```