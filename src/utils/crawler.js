'use strict';
var Crawler = require("crawler");

var c = new Crawler({
    maxConnections : 10
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

async function fetchJSON(url) {
    return new Promise((resolve, reject) => {
        c.queue([{
            url: url,
            jQuery: false,
            callback: async function(error, res, done) {
                if (error) {
                    reject(error);
                } else
                    var data = await res.toJSON();
                    resolve(JSON.parse(data.body));
                done();
            }
        }]);
    });

}

module.exports = {
    fetch,
    fetchJSON
};