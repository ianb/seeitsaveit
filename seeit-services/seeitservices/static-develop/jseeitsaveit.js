jQuery.fn.collect = function (callback) {
  var result = [];
  this.each(function () {
    var $this = jQuery(this);
    var item = callback($this);
    if (item) {
      result.push(item);
    }
  });
  return result;
};

jQuery.strip = jQuery.fn.strip = function (text, normalize) {
  if (normalize === undefined) {
    normalize = true;
  }
  if (text === undefined && this.text) {
    text = this.text();
  }
  text = text.replace(/^\s*/, '').replace(/\s*$/, '');
  if (normalize) {
    text = text.replace(/\s\s+/, ' ');
  }
  if (! text) {
    return null;
  }
  return text;
};

jQuery.reverse = function (list) {
  var n = [];
  for (var i=list.length-1; i>= 0; i--) {
    n.push(list[i]);
  }
  return n;
};

jQuery.fn.link = function () {
  if (! this.length) {
    return null;
  }
  if (this[0].src) {
    return this[0].src;
  }
  if (this[0].href) {
    return this[0].href;
  }
  return null;
};

// Deprecated:
jQuery.fn.getlink = jQuery.fn.link;

jQuery.fn.backgroundImage = function () {
  var css = this.css('background-image') || this.css('background');
  if (! css) {
    return null;
  }
  var match = (/url\(([^)]+)\)/i).exec(css);
  if (! match) {
    return null;
  }
  return match[1];
};

jQuery.parseURL = function (url) {
  var parsed = {};
  parsed.url = url;
  function getItem(regex, search) {
    var match = regex.exec(search);
    if (! match) {
      return null;
    }
    return match[1];
  }
  function toLower(s) {
    if (s) {
      return s.toLowerCase();
    }
    return s;
  }
  parsed.scheme = toLower(getItem(/^([^:]+):/, url));
  parsed.host = toLower(getItem(/^[^:]+:\/\/([^\/]+)/, url));
  parsed.origin = parsed.scheme + '://' + parsed.host;
  parsed.hostname = parsed.host && getItem(/^([^:]+)/, parsed.host);
  parsed.fullPath = getItem(/^[^:]+\/\/[^\/]+(\/.*)$/, url);
  parsed.path = parsed.fullPath && getItem(/^([^?]*)/, parsed.fullPath);
  parsed.queryString = getItem(/\?(.*)/, parsed.fullPath);
  parsed.params = {};
  parsed.paramSequence = [];
  if (parsed.queryString) {
    var items = parsed.split(/\&/g);
    for (var i=0; i<items.length; i++) {
      var item = items[i];
      if (item.indexOf('=') == -1) {
        var name = item;
        var value = null;
      } else {
        var name = item.substr(0, item.indexOf('='));
        var value = item.substr(item.indexOf('=') + 1);
      }
      if (name) {
        name = decodeURIComponent(name);
      }
      if (value) {
        value = decodeURIComponent(value);
      }
      parsed.paramSequence.push([name, value]);
      parsed.params[name] = value;
    }
  }
  return parsed;
};

jQuery.fn.allAttrs = function () {
  var result = {};
  this.each(function () {
    var attrs = this.attributes;
    if (attrs && attrs.length) {
      var l = attrs.length;
      for (var i=0; i<l; i++) {
        var name = attrs[i].name;
        var value = attrs[i].nodeValue;
        result[name] = value;
      }
    }
  });
  return result;
};

jQuery.fn.clean = function (options) {

  if (options === undefined) {
    options = this.cleanOptions.hardClean;
  }

  function makeSet(array) {
    if (! array) {
      return null;
    }
    var obj = {};
    for (var i=0; i<array.length; i++) {
      obj[array[i]] = true;
    }
    return obj;
  }

  var badAttrs = makeSet(options.badAttrs);
  var goodAttrs = makeSet(options.goodAttrs);
  var attrCheck = options.attrCheck;
  var linkAttrs = this.cleanOptions.linkAttrs;

  function cleanAttrs(el) {
    if (! (badAttrs || goodAttrs || attrCheck)) {
      return;
    }
    var attrs = el.attributes;
    var length = attrs.length;
    if ((! attrs) || (! length)) {
      return;
    }
    var toRemove = [];
    for (var i=0; i<length; i++) {
      var name = attrs[i].name.toUpperCase();
      console.log('check attr', name);
      if (badAttrs && badAttrs[name]) {
        toRemove.push(name);
        continue;
      }
      if (goodAttrs && (! goodAttrs[name])) {
        toRemove.push(name);
        continue;
      }
      if (attrCheck && (! attrCheck(name, attrs[i].nodeValue))) {
        toRemove.push(name);
        continue;
      }
      if (linkAttrs[name]) {
        var value = el[name.toLowerCase()];
        // FIXME: not a thorough check:
        if (value.toLowerCase().indexOf('javascript:') != -1) {
          toRemove.push(name);
        }
      }
    }
    length = toRemove.length;
    if (length) {
      for (var i=0; i<length; i++) {
        el.removeAttribute(toRemove[i]);
      }
    }
  }

  var dropElements = makeSet(options.dropElements);
  var removeElements = makeSet(options.removeElements);
  var goodElements = makeSet(options.goodElements);
  var elementCheck = options.elementCheck;
  var elementDropCheck = options.elementDropCheck;

  function removeElement(el) {
    var tagName = el.tagName;
    if (removeElements && removeElements[tagName]) {
      return true;
    }
    if (goodElements && (! goodElements[tagName])) {
      return true;
    }
    if (elementCheck && (! elementCheck(el))) {
      return true;
    }
    return false;
  }

  function dropElement(el) {
    if (dropElements && dropElements[el.tagName]) {
      return true;
    }
    if (elementDropCheck && (! elementDropCheck(el))) {
      return true;
    }
    return false;
  }

  this.each(function () {
    cleanAttrs(this);
    var els = this.getElementsByTagName("*");
    var toRemove = [];
    var toDrop = [];
    for (var i=0; i<els.length; i++) {
      var el = els[i];
      if (dropElement(el)) {
        toDrop.push(el);
      } else if (removeElement(el)) {
        toRemove.push(el);
      } else {
        cleanAttrs(el);
      }
    }
    var length = toDrop.length;
    for (var i=length-1; i>=0; i--) {
      var el = toDrop[i];
      if (el.parentNode) {
        el.parentNode.removeChild(el);
      }
    }
    length = toRemove.length;
    for (var i=length-1; i>=0; i--) {
      var el = toRemove[i];
      var parent = el.parentNode;
      if (! parent) {
        continue;
      }
      var children = el.childNodes;
      while (children.length) {
        parent.insertBefore(children[0], el);
      }
      parent.removeChild(el);
    }
  });

  return this;

};

jQuery.cleanOptions = jQuery.fn.cleanOptions = {
  hardClean: {
    // Old forgotten elements: acronym, basefont, dir, font
    // Structural elements: body, head, html, link, meta?, style
    // Elements we are leaving out: base, canvas, form, span
    // FIXME: datalist?  form?  replace form with div?  source? title?  keygen?
    dropElements: [
      'SCRIPT', 'IFRAME', 'NOSCRIPT', 'APPLET', 'EMBED', 'FRAME',
      'FRAMESET', 'NOFRAMES', 'OBJECT', 'PARAM'
      ],
    goodElements: [
      'A', 'ABBR', 'ADDRESS', 'AREA', 'ARTICLE', 'ASIDE', 'AUDIO',
      'B', 'BDI', 'BDO', 'BIG', 'BLOCKQUOTE', 'BR', 'BUTTON',
      'CAPTION', 'CENTER', 'CITE', 'CODE', 'COL', 'COLGROUP',
      'COMMAND', 'DATALIST', 'DD', 'DEL', 'DETAILS', 'DFN',
      'DIV', 'DL', 'DT', 'EM', 'FIELDSET', 'FIGCAPTION',
      'FIGURE', 'FOOTER', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
      'HEADER', 'HGROUP', 'HR', 'I', 'IMG', 'INPUT', 'INS',
      'KBD', 'LABEL', 'LEGEND', 'LI', 'MAP', 'MARK',
      'MENU', 'METER', 'NAV', 'OL', 'OPTGROUP', 'OPTION',
      'OUTPUT', 'P', 'PRE', 'PROGRESS', 'Q', 'RP', 'RT', 'RUBY',
      'S', 'SAMP', 'SECTION', 'SELECT', 'SMALL', 'SOURCE',
      'STRIKE', 'STRONG', 'SUB', 'SUMMARY', 'SUP', 'TABLE',
      'TBODY', 'TD', 'TEXTAREA', 'TFOOT', 'TH', 'THEAD', 'TIME',
      'TITLE', 'TR', 'TRACK', 'TT', 'U', 'UL', 'VAR', 'VIDEO',
      'WBR'
      ],
    // accesskey? tabindex? hidden?
    goodAttrs: [
      // global attrs:
      'DIR', 'ID', 'LANG', 'TITLE',
      // A attrs: (skip charset, coords, rev, shape)
      'HREF', 'NAME', 'HREFLANG', 'MEDIA', 'REL', 'TARGET', 'TYPE',
      // AREA attrs: (skip nohref)
      'ALT', 'COORDS', 'SHAPE',
      // AUDIO attrs: (skip autoplay, preload)
      'CONTROLS', 'LOOP',
      // BDO attrs:
      'DIR',
      // BUTTON attrs: (skip autofocus, form, formaction, formenctype, formmethod, formnovalidate, formtarget)
      'DISABLED', 'VALUE',
      // COL attrs: (skip char, charoff)
      'ALIGN', 'SPAN', 'VALIGN', 'WIDTH',
      // COLGROUP: (skip char, charoff)
      // COMMAND attrs:
      'CHECKED', 'DISABLED', 'ICON', 'LABEL', 'RADIOGROUP',
      // DEL attrs:
      'CITE', 'DATETIME',
      // DETAILS attrs:
      'OPEN',
      // IMG attrs:
      'HEIGHT', 'ISMAP', 'USEMAP',
      // INPUT attrs:
      'ACCEPT', 'AUTOCOMPLETE', 'LIST', 'MAX', 'MAXLENGTH', 'MIN', 'MULTIPLE',
      'PATTERN', 'PLACEHOLDER', 'READONLY', 'REQUIRED', 'SIZE', 'STEP',
      // LABEL attrs:
      'FOR',
      // METER attrs:
      'HIGH', 'LOW', 'OPTIMUM',
      // OL attrs:
      'REVERSED', 'START',
      // OPTION attrs:
      'SELECTED',
      // SELECT attrs:
      'MULTIPLE',
      // TABLE attrs:
      'BORDER', 'CELLPADDING', 'CELLSPACING',
      // TD attrs: (skip axis)
      'COLSPAN', 'HEADERS', 'NOWRAP', 'ROWSPAN', 'SCOPE',
      // TEXTAREA attrs:
      'COLS', 'ROWS', 'WRAP',
      // TH attrs:
      'SCOPE',
      // TIME attrs:
      'PUBDATE',
      // TRACK attrs:
      'DEFAULT', 'KIND', 'SRCLANG',
      // VIDEO attrs:
      'MUTED', 'POSTER'
      ]
  },

  // FIXME: not sure if this is really all the attrs we need/want
  linkAttrs: {
    'HREF': true,
    'SRC': true
  }

};

jQuery.makeUUID = jQuery.fn.makeUUID = function () {
  // From: http://stackoverflow.com/a/2117523/303070
  var template = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';
  return template.replace(/[xy]/g, function(c) {
    var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
    return v.toString(16);
  });
};

jQuery.encodeDataURL = function (data, contentType) {
  contentType = contentType || 'text/html';
  return 'data:' + contentType + ';base64,' + btoa(data).replace(/=/g, '');
};

jQuery.fn.fillFrame = function (data) {
  this.attr('src', jQuery.encodeDataURL(data));
  return this;
}

jQuery.emptyObject = function (obj) {
  for (var i in obj) {
    if (obj.hasOwnProperty(i) && obj[i]) {
      return false;
    }
  }
  return true;
};
