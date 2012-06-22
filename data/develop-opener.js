var DOC = null;

function sendMessage() {
  var doc = DOC;
  console.log('readystate', document.readyState);
  if (document.readyState != "interactive"
      && document.readyState != "complete" &&false) {
    return;
  }
  document.onreadystatechange = null;
  console.log('Got document', document.readyState);
  var event = document.createEvent("MessageEvent");
  var data = 'doc:' + JSON.stringify(doc);
  var origin = location.protocol + '//' + location.host;
  console.log('created event', event);
  event.initMessageEvent(
    "message",
    false, // canBubble
    false, // cancelable
    data, // data
    origin, // origin
    "", // lastEventId (unused)
    window);
  console.log('event init');
  window.dispatchEvent(event);
  console.log('event dispatch');
}

self.port.on("Document", function (doc, options) {
  if (options) {
    for (var i in options) {
      doc[i] = options[i];
    }
  }
  var func = unsafeWindow.setDocument;
  func(doc);
  return;
  DOC = doc;
  if (document.readyState != "interactive"
      && document.readyState != "complete") {
    console.log('current state:', document.readyState);
    document.onreadystatechange = sendMessage;
    sendMessage();
  } else {
    sendMessage();
  }
});

window.addEventListener("load", function () {
  console.log('window loaded');
}, false);
