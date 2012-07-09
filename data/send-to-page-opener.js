self.port.on("Document", function (doc, consumer) {
  var func = consumer.sendToPageFunction;
  console.log('got doc', func, unsafeWindow[func]);
  unsafeWindow[func](doc);
});
