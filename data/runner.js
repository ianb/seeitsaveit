self.port.on("StartScrape", function (functionName) {
  console.log("Running " + functionName + ": " + unsafeWindow[functionName]);
  var func = unsafeWindow[functionName];
  if (! func) {
    self.port.emit("Result", "Error loading script");
    return;
  }
  try {
    func(function (result) {
        self.port.emit("Result", result);
      }, function () {
        if (arguments.length == 1) {
          var s = arguments[0];
        } else {
          s = '';
          for (var i=0; i<arguments.length; i++) {
            if (s) {
              s += ' ';
            }
            var a = arguments[i];
            if (typeof a == "string" || typeof a == "number" || a === null) {
              s += a;
            } else {
              var aJson = JSON.stringify(a);
              if (aJson && aJson != "null") {
                s += aJson;
              } else {
                s += a;
              }
            }
          }
        }
        console.log("Log: " + s);
      });
  } catch (e) {
    self.port.emit("Result", "exception: " + e + "\n" + e.stack);
  }
});
