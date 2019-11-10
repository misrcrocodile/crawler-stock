'use strict';
var Crawler = require("crawler");

var c = new Crawler({
    maxConnections: 10,
    rateLimit: 1=4000
});

function fetch(url) {
    return new Promise((resolve, reject) => {
        c.queue([{
            url: url,
            callback: function(error, res, done) {
                if (error) {
                    reject(error);
                } else
                    resolve(res);
                done();
            }
        }]);
    });
}

module.exports = fetch;