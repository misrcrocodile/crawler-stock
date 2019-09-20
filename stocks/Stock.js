const fetch = require('node-fetch');
const URL_STOCK_LIST = "https://price-fpt-03.vndirect.com.vn/priceservice/secinfo/snapshot/q=codes:";
const URL_STOCK_PILE = "https://misscrocodile-utility-server.glitch.me/note/";

function getStockList(arrCode) {

    // check input 
    if (!Array.isArray(arrCode) || arrCode.length == 0) {
        return Promise.reject({ err: "[getStockList]Input must be array" });
    }

    let url = URL_STOCK_LIST + arrCode.join(",")

    return fetch(url, {
            "headers": {
                "accept": "application/json, text/plain, */*",
            }
        })
        .then(res => res.json())
        .then(res => {
            let returnArr = [];
            for (var i = 0; i < res.length; i++) {
                let data = res[i].split("|");
                returnArr.push({
                    floor_code: data[0],
                    time: data[1],
                    code: data[3],
                    open: data[8],
                    high: data[12],
                    low: data[14],
                    close: data[19],
                    volume: data[36],
                    foreign_buy: data[37] * 10,
                    foreign_sell: data[38] * 10,
                });
            }
            return returnArr;
        });
};

function getStockpile(noteId) {
    let url = URL_STOCK_PILE + noteId;

    return fetch(url)
        .then(res => res.json())
        .then(res => {
            let contentArr = res.content.split("\n");
            let returnArr = [];
            for (var i = 0; i < contentArr.length; i++) {
                let data = contentArr[i].split(" ");
                returnArr.push({
                    code: data[0],
                    volume: data[1],
                    price: data[2]
                });
            }
            return returnArr;
        });
}

function getStocknotepile(noteId) {
    return getStockpile(noteId)
        .then(notes => {
            let codeList = [];
            for (var i = 0; i < notes.length; i++) {
                codeList.push(notes[i].code);
            }
            return getStockList(codeList)
                .then(stocks => {
                    let str = "";
                    let money = 0;
                    for (var i = 0; i < notes.length; i++) {
                        for (var j = 0; j < stocks.length; j++) {
                            if (notes[i].code === stocks[j].code) {
                                notes[i].close = stocks[j].close;
                                notes[i].money = Math.round((notes[i].close - notes[i].price) * notes[i].volume);
                            }
                        }
                        str += notes[i].code + " " + (notes[i].close - notes[i].price).toFixed(2) + " " + (notes[i].money / 1000).toFixed(1) + "M\n";
                        money += notes[i].money;
                    }
                    str = "SUM " + (money / 1000).toFixed(1) + "M\n" + str;
                    return str;
                });
        });
}

module.exports = {
    getStocknotepile
};