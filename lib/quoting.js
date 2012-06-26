function htmlQuote(s) {
  if (! s) {
    return s;
  }
  if (s.search(/[&<"]/) == -1) {
    return s;
  }
  return s.replace(/&/g, "&amp;").replace(/</g, '&lt;').replace(/"/g, "&quot;");
}

function encodeData(content_type, data) {
  // FIXME: utf8?
  return 'data:' + content_type + ';base64,' + btoa(data);
}
