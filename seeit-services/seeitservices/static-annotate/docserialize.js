/* This thing serializes documents!
   You can use it like:

   s = new DocumentSerializer({skipScripts: false});
   text = s.serialize();

   There are some options.  The document is always "dead", all Javascript
   is disabled.  You can skip Javascript (by leaving out Javascript-related
   elements and attributes entirely) or just munge it (SCRIPT -> X-SCRIPT
   and ONCLICK -> X-ONCLICK etc).
*/

// FIXME: lots of scripts actually get through, like style="background: url(javascript:alert('hey'))"


function DocumentSerializer(options) {
  if (this === window) {
    throw 'You forgot new';
  }
  if (options) {
    for (var op in options) {
      if (options.hasOwnProperty(op)) {
        this[op] = options[op];
      }
    }
  }
  this.counter = 0;
}

// Set this to false to send script tags:
DocumentSerializer.prototype.skipScripts = true;
// Set this to false to send tags that aren't visible
DocumentSerializer.prototype.skipInvisible = true;
// Set to true to make sure all elements have an id:
DocumentSerializer.prototype.addIds = false;
// Set to false to avoid adding <base href="...">
DocumentSerializer.prototype.addBaseHref = true;

// How ids are generated:
DocumentSerializer.prototype.makeId = function () {
  // FIXME: this doesn't ensure that an id doesn't collide:
  return 'el' + (this.counter++);
};

DocumentSerializer.prototype.serialize = function () {
  // FIXME: doesn't get DOCTYPE?
  return this.serializeElement(document.getElementsByTagName('html')[0]);
};

/* All the elements which shouldn't have children: */
DocumentSerializer.prototype.emptyElements = {
  AREA: true,
  BASE: true,
  BASEFONT: true,
  BR: true,
  COL: true,
  FRAME: true,
  HR: true,
  IMG: true,
  INPUT: true,
  ISINDEX: true,
  LINK: true,
  META: true,
  PARAM: true
};


// These elements can have e.g., clientWidth of 0 but still be relevant:
DocumentSerializer.prototype.skipElementsOKEmpty = {
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
DocumentSerializer.prototype.scriptTags = {
  SCRIPT: true,
  NOSCRIPT: true
};

DocumentSerializer.prototype.skipElement = function (el) {
  /* Returns true if an element should be skipped */
  var tag = el.tagName;
  if (this.skipScripts && this.scriptTags[tag]) {
    return true;
  }
  if (this.skipInvisible &&
      ((el.style && el.style.display == 'none') ||
       ((el.clientWidth === 0 && el.clientHeight === 0) &&
           (! this.skipElementsOKEmpty[tag]) &&
           (! el.childNodes.length)))) {
    return true;
  }
  return false;
};

DocumentSerializer.prototype.serializeElement = function (el) {
  if (el.nodeType == document.TEXT_NODE) {
    return this.quoteText(el.nodeValue);
  }
  if (el.nodeType == document.COMMENT_NODE) {
    // FIXME: not sure if I should quote?
    return '<!-- ' + el.nodeValue + ' -->';
  }
  // FIXME: add other element types
  if (el.nodeType != document.ELEMENT_NODE) {
    return '';
  }
  if (this.skipElement(el)) {
    return '';
  }
  var tagName = el.tagName;
  if (this.scriptTags[tagName]) {
    // FIXME: is this a good way to munge?
    tagName = 'x-' + tagName;
  }
  var res = '<' + tagName;
  var id = el.id;
  if ((! id) && this.addIds) {
    id = this.makeId();
  }
  if (id) {
    res += ' id="' + this.quoteAttr(id) + '"';
  }
  if (el.attributes) {
    for (var i=0; i<el.attributes.length; i++) {
      var attr = el.attributes[i];
      var attrName = attr.name.toLowerCase();
      if (attrName == 'id') {
        continue;
      }
      if (attrName.substr(0, 2) == 'on') {
        if (this.skipScripts) {
          continue;
        } else {
          // FIXME: or use data-script-attrName?
          attrName = 'x-' + attrName;
        }
      }
      res += ' ' + attrName + '="';
      if (attrName == 'href' || attrName == 'src' || attrName == 'value') {
        var value = el[attrName];
      } else if (attrName == 'checked') {
        // FIXME: this doesn't really handle the case when el.checked is true
        // and there's no checked attribute
        if (el.checked) {
          var value = 'checked';
        } else {
          continue;
        }
      } else {
        var value = attr.value;
      }
      res += this.quoteAttr(value) + '"';
    }
  }
  res += '>';
  if (tagName === 'HEAD' && this.addBaseHref) {
    res += this.addBaseHref();
  }
  if (! this.emptyElements[el.tagName]) {
    for (var i=0; i<el.childNodes.length; i++) {
      res += this.serializeElement(el.childNodes[i]);
    }
    res += '</' + tagName + '>';
  }
  return res;
};

DocumentSerializer.prototype.addBaseHref = function () {
  var url = this.baseHrefUrl || location.href + '';
  if (! url) {
    return '';
  }
  var els = document.getElementsByTagName('base');
  if (! els.length) {
    return '<base href="' + this.quoteAttr(url) + '">\n';
  }
  return '';
};

DocumentSerializer.prototype.quoteUrl = function (url) {
  return encodeURIComponent(url);
};

DocumentSerializer.prototype.quoteText = function (text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;');
};

DocumentSerializer.prototype.quoteAttr = function (attr) {
  if (! attr) {
    return '';
  }
  if (! attr.replace) {
    console.log('weird', attr, typeof attr);
    return '';
  }
  return attr.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
};
