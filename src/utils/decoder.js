var atob = require('atob');
var btoa = require('btoa');
function generateKey() {
    var e = Math.floor(100 * Math.random())
      , t = Math.floor(200 * Math.random())
      , a = Math.floor(500 * Math.random())
      , n = Math.floor(50 * Math.random())
      , r = a / e
      , o = n / t
      , i = atob("NQ==") + ("+ " + a + " + " + n + " - " + e + "*" + r + " - " + t + "*" + o);
    return btoa(i)
}
function decodeData(e) {
    var t = e.split("").map(decodeCharMapper).join("").split(FIELD_SEPARATOR);
    return t
}

var FIELD_SEPARATOR = "|"
  , DECODE_KEY = Math.round(eval(atob(generateKey())))
  , decodeCharMapper = function(e, t) {
    return String.fromCharCode(e.charCodeAt(0) + t % DECODE_KEY)
};
module.exports = {decodeData};