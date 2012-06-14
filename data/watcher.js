var glob = (function () {return this;})();

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


function Element(tag, attrs, children) {
  if (this === glob) {
    return new Element(tag, attrs, children);
  }
  this.tag = tag;
  this.attrs = attrs;
  this.children = children;
}

Element.prototype = {
  toString: function () {
    var s = '<' + this.tag;
    for (var i in this.attrs) {
      if (i == 'value' && this.tag == 'TEXTAREA') {
        continue;
      }
      s += ' ' + i;
      var value = this.attrs[i];
      if (value !== null) {
        s += '="' + htmlQuote(value) + '"';
      }
    }
    s += '>';
    if (this.tag == 'TEXTAREA') {
      s += htmlQuote(this.attrs.value || '');
    }
    if (this.children && this.children.length) {
      s += this.toStringChildren();
      s += '</' + this.tag + '>';
    } else {
      if (! voidElements[this.tag]) {
        s += '</' + this.tag + '>';
      }
    }
    return s;
  },
  toStringChildren: function () {
    return this.children.join('');
  }
};

function serializeElement(el) {
  if (el.tagName == 'CANVAS') {
    return Element('IMG', {src: el.toDataURL('image/png')});
  }
  var attrs = serializeAttributes(el);
  var children = this.normalChildren(el);
  var length = children.length;
  for (var i=0; i<length; i++) {
    var child = children[i];
    if (typeof child != 'string') {
      children[i] = serializeElement(children[i]);
    }
  }
  return Element(el.tagName, attrs, children);
}

function htmlQuote(s) {
  if (! s) {
    return s;
  }
  if (s.search(/[&<"]/) == -1) {
    return s;
  }
  return s.replace(/&/g, "&amp;").replace(/</g, '&lt;').replace(/"/g, "&quot;");
}

function serializeAttributes(el) {
  var attrs = {};
  if (el.attributes) {
    for (var i=0; i<el.attributes.length; i++) {
      var attrName = el.attributes[i].name;
      if (attrName.substr(0, 2).toLowerCase() == "on") {
        // Don't keep any event-based attributes
        continue;
      } else if (attrName == 'href' || attrName == 'src' || attrName == 'value') {
        attrs[attrName] = el[attrName];
      } else {
        attrs[attrName] = el.attributes[i].nodeValue;
      }
    }
  }
  if (el.tagName == 'TEXTAREA') {
    attrs.value = el.value;
  }
  return attrs;
}

function normalChildren(el) {
  // Returns a normalized representation of a set of children, as
  // as a list of text and elements, with no two adjacent text elements
  // and no empty text strings.  Ignorable elements are omitted.
  var result = [];
  var children = el.childNodes;
  var length = children.length;
  for (var i=0; i<length; i++) {
    var child = children[i];
    if (skipElement(child)) {
      continue;
    }
    if (child.nodeType == document.TEXT_NODE) {
      var value = child.nodeValue;
      if (! value) {
        continue;
      }
      if (i && typeof result[result.length-1] == 'string') {
        // Append this text to the last
        result[result.length-1] += value;
      } else {
        result.push(value);
      }
    } else if (child.nodeType == document.ELEMENT_NODE) {
      result.push(child);
    }
  }
  return result;
};

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

function serializeDocument(doc) {
  doc = doc || document;
  return Element('HTML', {}, [serializeElement(document.head), serializeElement(document.body)]);
}


/* This is quite a bit faster than creating intermediate objects: */
const TEXT_NODE = document.TEXT_NODE;
const ELEMENT_NODE = document.ELEMENT_NODE;

function staticHTML(el) {
  if (el.tagName == 'CANVAS') {
    return '<IMG SRC="' + htmlQuote(el.toDataURL('image/png')) + '">';
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
      if (name == "href" || name == "src" || name == "value") {
        var value = el[name];
      } else {
        var value = attrs[i].nodeValue;
      }
      s += ' ' + name + '="' + htmlQuote(value) + '"';
    }
  }
  s += '>';
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
  if (l || ! voidElements[el.tagName]) {
    s += '</' + el.tagName + '>';
  }
  return s;
}


self.port.on("ReceiveDocument", function (message) {
  var start = Date.now();
  // unsafeWindow is quite a bit faster than the proxied access:
  self.port.emit("SerializedDocument", {
    location: location.href,
    head: staticHTML(unsafeWindow.document.head),
    body: staticHTML(unsafeWindow.document.body)
  });
  console.log("serializing took " + (Date.now() - start) + " milliseconds");
});
