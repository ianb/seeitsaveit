function htmlQuote(s) {
  if (! s) {
    return s;
  }
  if (s.search(/[&<"]/) == -1) {
    return s;
  }
  return s.replace(/&/g, "&amp;").replace(/</g, '&lt;').replace(/"/g, "&quot;");
}

function skipElement(el) {
  /* true if this element should be skipped when sending to the mirror */
  var tag = el.tagName;
  if (skipElementsBadTags[tag]) {
    return true;
  }
  // Skip elements that can't be seen, and have no children, and are potentially
  // "visible" elements (e.g., not STYLE)
  // Note elements with children might have children with, e.g., absolute
  // positioning -- so they might not make the parent have any width, but
  // may still need to be displayed.
  if ((el.style && el.style.display == 'none')
      || ((el.clientWidth === 0 && el.clientHeight === 0) &&
          (! skipElementsOKEmpty[tag]) &&
          (! el.childNodes.length))) {
    return true;
  }
  return false;
};

const voidElements = {
  AREA: true,
  BASE: true,
  BR: true,
  COL: true,
  COMMAND: true,
  EMBED: true,
  HR: true,
  IMG: true,
  INPUT: true,
  KEYGEN: true,
  LINK: true,
  META: true,
  PARAM: true,
  SOURCE: true,
  TRACK: true,
  WBR: true
};

// These elements can have e.g., clientWidth of 0 but still be relevant:
const skipElementsOKEmpty = {
  LINK: true,
  STYLE: true,
  HEAD: true,
  META: true,
  BODY: true,
  APPLET: true,
  BASE: true,
  BASEFONT: true,
  BDO: true,
  BR: true,
  OBJECT: true,
  TD: true,
  TR: true,
  TH: true,
  THEAD: true,
  TITLE: true
  // COL, COLGROUP?
};

// These elements are never sent:
const skipElementsBadTags = {
  SCRIPT: true,
  NOSCRIPT: true
};


/* This is quite a bit faster than creating intermediate objects: */
const TEXT_NODE = document.TEXT_NODE;
const ELEMENT_NODE = document.ELEMENT_NODE;

function staticHTML(el) {
  if (el.tagName == 'CANVAS') {
    return '<IMG SRC="' + htmlQuote(el.toDataURL('image/png')) + '">';
  }
  var replSrc = null;
  if (el.tagName == 'IFRAME') {
    // FIXME: need to add <base> element
    try {
      var html = staticHTML(el.contentWindow.document.documentElement);
      replSrc = encodeData('text/html', html);
    } catch (e) {
      console.log('Had to skip iframe for permission reasons:', e);
    }
  }
  var s = '<' + el.tagName;
  var attrs = el.attributes;
  if (attrs && attrs.length) {
    var l = attrs.length;
    for (var i=0; i<l; i++) {
      var name = attrs[i].name;
      if (name.substr(0, 2).toLowerCase() == "on") {
        continue;
      }
      if (name == 'src' && replSrc) {
        var value = replSrc;
      } else if (name == "href" || name == "src" || name == "value") {
        var value = el[name];
      } else {
        var value = attrs[i].nodeValue;
      }
      s += ' ' + name + '="' + htmlQuote(value) + '"';
    }
  }
  s += '>';
  s += staticChildren(el);
  if (l || ! voidElements[el.tagName]) {
    s += '</' + el.tagName + '>';
  }
  return s;
}

function staticChildren(el) {
  var s = '';
  var children = el.childNodes;
  var l = children.length;
  for (var i=0; i<l; i++) {
    var child = children[i];
    if (skipElement(child)) {
      continue;
    }
    if (child.nodeType == TEXT_NODE) {
      var value = child.nodeValue;
      s += htmlQuote(value);
    } else if (child.nodeType == ELEMENT_NODE) {
      s += staticHTML(child);
    }
  }
  return s;
}

function encodeData(content_type, data) {
  // FIXME: utf8?
  return 'data:' + content_type + ';base64,' + btoa(data);
}

self.port.on("ReceiveDocument", function () {
  var start = Date.now();
  // unsafeWindow is quite a bit faster than the proxied access:
  self.port.emit("SerializedDocument", {
    location: location.href,
    head: staticChildren(unsafeWindow.document.head),
    body: staticChildren(unsafeWindow.document.body)
  });
  console.log("serializing took " + (Date.now() - start) + " milliseconds");
});
