const moment = require("moment");
const Schedule = require("node-schedule");
const VND = require("./src/stocks/Vndirect");

// VND.debugCode();
VND.runEveryday();
// run job every day at 18:00
Schedule.scheduleJob("20 * * * *", function() {
  // Setting time
  let fromTime = moment({ hours: 11, minutes: 19, seconds: 0 })
    .unix()
    .toString();
  let toTime = moment({ hours: 17, minutes: 30, seconds: 0 })
    .unix()
    .toString();
  let now = moment()
    .unix()
    .toString();

  // prevent run code on Saturday, Sunday
  if ([0, 6].includes(moment().day())) {
    return;
  }

  // Check if fromTime <= now <= toTime
  if (now >= fromTime && now <= toTime) {
    // Writing a log
    console.log("Execute job at: ", moment().format("MMMM Do YYYY, h:mm:ss a"));

    // VND.debugCode();
    VND.runEveryday();
  }
});
