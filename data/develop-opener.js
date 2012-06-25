self.port.on("Document", function (doc, options) {
  if (options) {
    for (var i in options) {
      doc[i] = options[i];
    }
  }
  var func = unsafeWindow.setDocument;
  func(doc);
  return;
});
