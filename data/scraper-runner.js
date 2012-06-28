var timeoutId = null;

self.port.on("StartExtraction", function (functionName, timeout) {
  console.log("Running " + functionName + ": " + unsafeWindow[functionName]);
  var func = unsafeWindow[functionName];
  if (! func) {
    self.port.emit("ErrorResult", "error loading script (no function " + functionName + ")");
    return;
  }
  timeoutId = setTimeout(function () {
    self.port.emit("ErrorResult", "function timed out");
  }, timeout);
  try {
    var staticResult = func(resultReceived, logger);
  } catch (e) {
    // FIXME: separate out error results
    self.port.emit("ErrorResult", e + "", e.stack);
    return;
  }
  if (typeof staticResult == "object" && staticResult !== null) {
    resultReceived(staticResult);
  }
});

function isArray(o) {
  return (typeof o.length == "number" && o.forEach);
}

function resultReceived(result) {
  if (timeoutId) {
    clearTimeout(timeoutId);
    timeoutId = null;
  }
  if (result === null || typeof result != "object" || isArray(result)) {
    self.port.emit("ErrorResult", "function returned invalid result: " + JSON.stringify(result));
  } else {
    self.port.emit("Result", result);
  }
}

function logger() {
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
}
