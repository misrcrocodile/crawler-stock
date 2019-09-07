const sqlite3 = require('sqlite3').verbose();

var db = {}

var openDB = function(dbName) {
    db = new sqlite3.Database(dbName, function(err) {
        if (err) {
            console.log('503 - Database error');
        }
    });
    return db;
};

var init = function(dbName, callback) {
    openDB(dbName);
    return db;
}

exports.init = init;