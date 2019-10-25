const moment = require("moment");
const Schedule = require("node-schedule");
const VND = require("./src/stocks/Vndirect");

// run job every 15 minutes
// Schedule.scheduleJob("*/15 * * * *", function() {
  // Setting time
  // let fromTime = moment({ hours: 11, minutes: 30, seconds: 0 })
  //   .unix()
  //   .toString();
  // let toTime = moment({ hours: 17, minutes: 0, seconds: 0 })
  //   .unix()
  //   .toString();
  // let now = moment()
  //   .unix()
  //   .toString();

  // // Check if fromTime <= now <= toTime
  // // if (now >= fromTime && now <= toTime) {
  //   // Writing a log
  //   console.log(
  //     "Execute job at: ",
  //     moment().format("MMMM Do YYYY, h:mm:ss a")
  //   );
    
    VND.runEveryday();
  // }
// });
// VND.getAll("VCB").then(res => {
//   var data = VND.calcIndicator(res);
//   console.log(JSON.stringify(data));
// }).catch(e => {
//   console.log(e);
// });