// // const Fetch = require('./utils/crawler');
// const DCOM_RATE_LINK = "https://sendmoney.co.jp/vi/fx-rate";
// const vietStock = require("./utils/VietStock");
// const vndirect = require("./utils/Vndirect");
// const http = require("http");
// const express = require("express");
// const app = express();


























// vndirect.scan(["FPT", "MWG", "VNM"]).then(res => {
//     console.log(res);
// });
// vndirect.scan().then(res => {
//     console.log(res[0]);
// })

// var port = process.env.PORT || 8080;

// // Root API intro
// app.get("/", function(req, res) {
//     vietStock.getVnindex().then(data => {
//         var name = data[0].Name;
//         var price = data[0].Price;
//         var change = data[0].Change;
//         var perchange = data[0].PerChange;
//         var sign = change > 0 ? "⬆" : "⬇";
//         var retStr = space(name, 10) + " " + sign + price + "(" + change + " " + perchange + "%)\r\n";
//         res.send("VN-Index ⬆979.38(10.47 1.08%)\r\n");
//     });
// });
// // Setup server.
// http.createServer(app).listen(port, function() {
//     console.log("Root Folder: ", __dirname);
//     console.log("Server is listening on port " + port);
// });