function activateBookmarklet(options) {
  addBaseHref();
  var doc = serializeDocument(document.getElementsByTagName('html')[0]);
  var form = createForm(options.app, options.target, 'text/html', doc, {'ui-type': 'annotation'});
  form.submit();
}

function addBaseHref(url) {
  if (url === undefined) {
    url = location.href;
  }
  var els = document.getElementsByTagName('base');
  if (! els.length) {
    var el = document.createElement('base');
    el.setAttribute('href', url);
    document.head.appendChild(el);
  }
}

var emptyElements = {
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
var skipElementsOKEmpty = {
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
var skipElementsBadTags = {
  SCRIPT: true,
  NOSCRIPT: true
};

function skipElement(el) {
  var tag = el.tagName;
  // FIXME: also skip empty/non-displaying tags
  if (skipElementsBadTags[tag]) {
    return true;
  }
  if ((el.style && el.style.display == 'none') ||
      ((el.clientWidth === 0 && el.clientHeight === 0) &&
          (! skipElementsOKEmpty[tag]) &&
          (! el.childNodes.length))) {
    return true;
  }
  return false;
}

var counter = 1;

function serializeDocument(el) {
  if (el.nodeType == document.TEXT_NODE) {
    return quoteText(el.nodeValue);
  }
  if (el.nodeType == document.COMMENT_NODE) {
    return '<!-- ' + el.nodeValue + ' -->';
  }
  if (el.nodeType != document.ELEMENT_NODE) {
    return '';
  }
  if (skipElement(el)) {
    return '';
  }
  var res = '<' + el.tagName;
  var id = el.id;
  if (! id) {
    id = 'id' + (counter++);
  }
  res += ' id="' + quoteAttr(id) + '"';
  if (el.attributes) {
    for (var i=0; i<el.attributes.length; i++) {
      var attr = el.attributes[i];
      var attrName = attr.name.toLowerCase();
      if (attrName == 'id' || attrName.substr(0, 2) == 'on') {
        continue;
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
      res += quoteAttr(value) + '"';
    }
  }
  res += '>';
  if (! emptyElements[el.tagName]) {
    for (var i=0; i<el.childNodes.length; i++) {
      res += serializeDocument(el.childNodes[i]);
    }
    res += '</' + el.tagName + '>';
  }
  return res;
}

function createForm(options, content_type, body, fields) {
  var form = document.createElement('form');
  if (options.target) {
    form.setAttribute('target', options.target);
  }
  var href = options.url || location.href + '';
  href = href.replace(/^https?:\/\//i, '');
  href = href.replace(/\/+$/, '');
  href = href.replace(/\//g, '.');
  form.action = options.app + '/' + quoteUrl(href);
  form.method = 'POST';
  form.appendChild(createField('content-type', content_type));
  form.appendChild(createField('body', body));
  form.appendChild(createField('_charset_', ''));
  if (fields) {
    for (var i in fields) {
      if (! fields.hasOwnProperty(i)) {
        continue;
      }
      form.appendChild(createField(i, fields[i]));
    }
  }
  document.body.appendChild(form);
  return form;
}

function createField(name, value) {
  var el = document.createElement('input');
  el.type = 'hidden';
  el.name = name;
  el.value = value;
  return el;
}

function quoteUrl(url) {
  return encodeURIComponent(url);
}

function quoteText(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;');
}

function quoteAttr(attr) {
  if (! attr) {
    return '';
  }
  if (! attr.replace) {
    console.log('weird', attr, typeof attr);
    return '';
  }
  return attr.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}


/*************************************************************
 Annotation view
 */

var styles = {
  base: 'font-family: Helvetica, sans-serif; font-size: 14px; background-color: #000; color: #fff; text-align: left; ',
  border: 'border: 2px solid #999; border-radius: 3px; ',
  bigButton: 'background-color: #444; border: 3px inset #777; border-radius: 4px; cursor: pointer; font-size: 175%; text-align: center; color: #999; padding: 2px;',
  bigButtonActiveColor: '#4f4',
  bigButtonInactiveColor: '#999',
  annotationBackground: '#ff9',
  annotationHighlight: '#f99',
  button: 'font-family: Helvetica, sans-serif; background: inherit; text-transform: none; letter-spacing: inherit; border-radius: 3px; padding: 3px; box-shadow: none; background-color: #bbb; color: #000; border: 2px outset #aaa; margin: 1px; ',
  link: 'color: #fff; text-decoration: underline'
};

function activateComments(appUrl, pageUrl) {
  var server = new Server(appUrl, pageUrl);
  // FIXME: for debugging:
  window.server = server;
  server.getAnnotations();
  server.showPanel();
}

function Server(appUrl, pageUrl) {
  if (this === window) {
    throw 'You forgot new';
  }
  this.appUrl = appUrl;
  this.pageUrl = pageUrl;
  this.annotationUrl = pageUrl + '+comments';
  this.annotations = [];
}

Server.prototype.getAnnotations = function () {
  var req = new XMLHttpRequest();
  var self = this;
  req.open('GET', this.annotationUrl);
  req.onreadystatechange = function () {
    if (req.readyState != 4) {
      return;
    }
    if (req.status == 404) {
      // OK, just no annotations
    } else if (req.status == 200) {
      var anns = [];
      try {
        anns = JSON.parse(req.responseText);
      } catch (e) {
        console.error('Got a bad response:', e, req.responseText);
      }
      for (var i=0; i<anns.length; i++) {
        self.addAnnotation(anns[i]);
      }
    } else {
      console.log('Bad response', self.annotationUrl, req.status);
    }
  };
  req.send();
};

Server.prototype.addAnnotation = function (repr) {
  var obj = new Annotation(repr, this);
  obj.display();
  this.annotations.push(obj);
};

Server.prototype.removeAnnotation = function (ann) {
  if (this.annotations.indexOf(ann) == -1) {
    throw 'Annotation does not exist: ' + ann;
  }
  this.annotations.splice(this.annotations.indexOf(ann), 1);
};

Server.prototype.showPanel = function () {
  this.panel = document.createElement('div');
  this.panel.annotateHide = true;
  this.panel.style.position = 'fixed';
  this.panel.style.top = '10px';
  this.panel.style.right = '10px';
  this.panel.height = '10em';
  this.panel.style.zIndex = '10001';
  this.panel.innerHTML = '<div style="'+styles.base+styles.border+'padding: 6px 3px 6px 3px;">' +
    '<span id="webannotate-annotate" style="'+styles.bigButton+'" title="Make annotations on the page">Annotate</span>' +
    '<span id="webannotate-view" style="'+styles.bigButton+'" title="View the page (without adding annotations)">View</span>' +
    '<span id="webannotate-hide" style="'+styles.bigButton+'" title="Hide all the annotations">Hide</span>' +
    '<div id="webannotate-info" style="padding-top: 4px"><span style="cursor: pointer" id="webannotate-info-expand">Info: &#9656;</span>' +
    '<div id="webannotate-info-details" style="display: none">' +
    '<span id="webannotate-login-status"></span><br>' +
    'URL: <a href="#" id="webannotate-info-url" target="_blank" style="'+styles.link+'"></a><br>' +
    '<a href="#" id="webannotate-info-share" style="'+styles.link+'">Share</a>' +
    '<input type="text" id="webannotate-info-share-link" style="display: none"><br>' +
    '</div></div>' +
    '</div>';
  document.body.appendChild(this.panel);
  this.annotateButton = document.getElementById('webannotate-annotate');
  this.viewButton = document.getElementById('webannotate-view');
  this.hideButton = document.getElementById('webannotate-hide');
  var self = this;
  this.annotateButton.addEventListener('click', function () {
    self.setView('annotate');
  }, false);
  this.viewButton.addEventListener('click', function () {
    self.setView('view');
  }, false);
  this.hideButton.addEventListener('click', function () {
    if (self.viewingState == 'hide') {
      self.setView('view');
    } else {
      self.setView('hide');
    }
  }, false);
  this.infoButton = document.getElementById('webannotate-info-expand');
  this.infoDetails = document.getElementById('webannotate-info-details');
  this.infoButton.addEventListener('click', function (ev) {
    ev.preventDefault();
    ev.stopPropagation();
    if (self.infoDetails.style.display) {
      self.infoDetails.style.display = '';
      self.infoButton.innerHTML = 'Info: &#9662;';
    } else {
      self.infoDetails.style.display = 'none';
      self.infoButton.innerHTML = 'Info: &#9656;';
    }
  }, false);
  var baseHref = document.getElementsByTagName('base')[0];
  baseHref = baseHref.getAttribute('href');
  var urlLink = document.getElementById('webannotate-info-url');
  urlLink.appendChild(document.createTextNode(baseHref));
  urlLink.href = baseHref;
  this.shareButton = document.getElementById('webannotate-info-share');
  this.shareText = document.getElementById('webannotate-info-share-link');
  this.shareButton.addEventListener('click', function (ev) {
    ev.preventDefault();
    ev.stopPropagation();
    self.shareButton.innerHTML = 'Share...';
    self.getShareLink(function (data) {
      if (! data) {
        self.shareButton.innerHTML = 'Share failed';
        return;
      }
      self.shareButton.style.display = 'none';
      self.shareText.style.display = '';
      self.shareText.value = data.url;
      self.shareText.focus();
      self.shareText.select();
      if (window.clipboardData) {
        window.clipboardData.setData('text', self.shareText.value);
      }
      self.shareText.addEventListener('blur', function () {
        self.shareText.style.display = 'none';
        self.shareButton.innerHTML = 'Share';
        self.shareButton.style.display = '';
      }, false);
    });
  }, false);
  this.loginStatus = document.getElementById('webannotate-login-status');
  this.updateLoginStatus();
  this.clickListener = this.clickEvent.bind(this);
  this.changeListener = this.changeEvent.bind(this);
  this.annotationForm = new AnnotationForm(this);
  this.setView('annotate');
};

Server.prototype.updateLoginStatus = function (a) {
  var self = this;
  var email = WSGIBrowserID.loginStatus();
  if (email) {
    this.loginStatus.innerHTML = '';
    this.loginStatus.appendChild(document.createTextNode(email));
    this.loginStatus.innerHTML += ' <a href="#" style="'+styles.link+'">logout</a>';
    var el = this.loginStatus.getElementsByTagName('a')[0];
    el.addEventListener('click', function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      // FIXME: should I reload here?
      WSGIBrowserID.logout();
      self.updateLoginStatus();
    }, false);
  } else {
    this.loginStatus.innerHTML = '<a href="#" style="'+styles.link+'">login to ensure access</a>';
    var el = this.loginStatus.getElementsByTagName('a')[0];
    el.addEventListener('click', function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      WSGIBrowserID.login(self.updateLoginStatus.bind(self));
      // This will update any tokens to be bound to our login:
      var req = new XMLHttpRequest();
      req.open('GET', location.href);
      req.send();
    }, false);
  }
};

Server.prototype.clickEvent = function (ev) {
  var target = ev.target;
  var el = target;
  while (el) {
    if (el.annotateHide) {
      return;
    }
    el = el.parentNode;
  }
  ev.preventDefault();
  ev.stopPropagation();
  if (this.annotationForm.visible) {
    this.annotationForm.hide();
  } else {
    this.annotationForm.clickEvent(ev);
  }
};

Server.prototype.changeEvent = function (ev) {
  if (this.changing) {
    clearTimeout(this.changing);
  }
  this.changing = setTimeout(this.changeFinished.bind(this), 400);
};

Server.prototype.changeFinished = function () {
  this.changing = null;
  var range = window.getSelection();
  if ((! range) || (! range.rangeCount)) {
    // No range selected
    return;
  }
  range = range.getRangeAt(0);
  if (! range) {
    return;
  }
  var el = range.startContainer;
  while (el) {
    if (el.annotateHide) {
      return;
    }
    el = el.parentNode;
  }
  if (range.endContainer === range.startContainer && range.startOffset === range.endOffset) {
    // Empty selection
    return;
  }
  this.annotationForm.range(range);
};

Server.prototype.setView = function (viewing) {
  var turnOn, turnOff;
  if (viewing != 'hide' && this.viewingState == 'hide') {
    this.showAnnotations();
  }
  this.viewingState = viewing;
  if (viewing == 'annotate') {
    this.turnOn(this.annotateButton);
    this.turnOff(this.viewButton);
    this.turnOff(this.hideButton, 'Hide');
    document.addEventListener('click', this.clickListener, true);
    document.addEventListener('selectionchange', this.changeListener, true);
  } else if (viewing == 'view') {
    this.turnOn(this.viewButton);
    this.turnOff(this.annotateButton);
    this.turnOff(this.hideButton, 'Hide');
    this.annotationForm.hide();
    document.removeEventListener('click', this.clickListener, true);
    document.removeEventListener('selectionchange', this.changeListener, true);
  } else if (viewing == 'hide') {
    this.turnOn(this.hideButton, 'Show');
    this.turnOff(this.annotateButton);
    this.turnOff(this.viewButton);
    this.annotateButton.style.display = 'none';
    this.viewButton.style.display = 'none';
    this.hideAnnotations();
    this.annotationForm.hide();
    document.removeEventListener('click', this.clickListener, true);
    document.removeEventListener('selectionchange', this.changeListener, true);
  }
};

Server.prototype.turnOff = function (button, text) {
  button.style.display = '';
  button.style.borderStyle = 'outset';
  button.style.color = styles.bigButtonInactiveColor;
  if (text) {
    button.innerHTML = text;
  }
};

Server.prototype.turnOn = function (button, text) {
  button.style.display = '';
  button.style.borderStyle = 'inset';
  button.style.color = styles.bigButtonActiveColor;
  if (text) {
    button.innerHTML = text;
  }
};

Server.prototype.showAnnotations = function () {
  for (var i=0; i<this.annotations.length; i++) {
    this.annotations[i].show();
  }
};

Server.prototype.hideAnnotations = function () {
  for (var i=0; i<this.annotations.length; i++) {
    this.annotations[i].hide();
  }
};

Server.prototype.saveAnnotations = function (callback) {
  var req = new XMLHttpRequest();
  var self = this;
  req.open('PUT', this.annotationUrl);
  var repr = [];
  for (var i=0; i<this.annotations.length; i++) {
    repr.push(this.annotations[i].repr);
  };
  req.onreadystatechange = function () {
    if (req.readyState != 4) {
      return;
    }
    if (callback) {
      callback(req);
    }
  };
  req.send(JSON.stringify(repr));
};

Server.prototype.getShareLink = function (callback) {
  var self = this;
  var req = new XMLHttpRequest();
  req.open('GET', this.pageUrl + '?getlink');
  req.onreadystatechange = function () {
    if (req.readyState != 4) {
      return;
    }
    if (req.status != 200) {
      console.log('Got bad response to link request:', req.status, req);
      callback(null);
      return;
    }
    var data = JSON.parse(req.responseText);
    callback(data);
  };
  req.send();
};

function AnnotationForm(server) {
  if (this === window) {
    throw 'You forgot new';
  }
  this.server = server;
  this.visible = false;
}

AnnotationForm.prototype.hide = function () {
  if (this.div) {
    this.div.style.display = 'none';
  }
  this.visible = false;
};

AnnotationForm.prototype.clickEvent = function (ev) {
  this.resetForm();
  var elPos = getElementPosition(ev.target);
  this.position(
    {top: ev.pageY, left: ev.pageX},
    {click: {element: ev.target.id,
             offsetLeft: ev.pageX - elPos.left, offsetTop: ev.pageY - elPos.top}
     });
};

AnnotationForm.prototype.range = function (range) {
  this.resetForm();
  range = expandRange(range);
  this.rangePosition = showAnnotationRange(range);
  var positionElement = this.rangePosition.elements[this.rangePosition.elements.length-1];
  var elPos = getElementPosition(positionElement);
  this.position(
    {top: elPos.top + positionElement.offsetHeight, left: elPos.left},
    {range: {start: range.start.id, end: range.end.id,
             startOffset: range.startOffset,
             endOffset: range.endOffset,
             startText: range.startText, endText: range.endText}
            });
};

function showAnnotationRange(range) {
  var elements = [];
  var artificial = [];
  range = {start: range.start, end: range.end, startOffset: range.startOffset,
           endOffset: range.endOffset, startText: range.startText, endText: range.endText};
  if (typeof range.start == 'string') {
    range.start = document.getElementById(range.start);
  }
  if (typeof range.end == 'string') {
    range.end = document.getElementById(range.end);
  }
  showRange(range, function (el) {
    if (el.nodeType != document.ELEMENT_NODE) {
      return;
    }
    elements.push(el);
    if (el.artificialRangeElement) {
      artificial.push(el);
    }
    el.oldBackgroundColor = el.style.backgroundColor;
    el.style.backgroundColor = styles.annotationBackground;
  });
  return {elements: elements, artificial: artificial};
}

function removeAnnotationRange(rangeEls) {
  for (var i=0; i<rangeEls.elements.length; i++) {
    var el = rangeEls.elements[i];
    el.style.backgroundColor = el.oldBackgroundColor;
  }
  for (i=0; i<rangeEls.artificial.length; i++) {
    var el = rangeEls.artificial[i];
    if (el.childNodes.length > 1) {
      console.warn('Artificial element has multiple children:', el);
    }
    el.parentNode.replaceChild(el.childNodes[0], el);
  }
}

function highlightAnnotationRange(rangeEls, backgroundColor) {
  for (var i=0; i<rangeEls.elements.length; i++) {
    var el = rangeEls.elements[i];
    el.style.backgroundColor = backgroundColor;
  }
}

AnnotationForm.prototype.resetForm = function () {
  if (! this.div) {
    this.setupDiv();
  }
  this.visible = true;
  if (this.rangePosition) {
    removeAnnotationRange(this.rangePosition);
    this.rangePosition = null;
  }
};

AnnotationForm.prototype.setupDiv = function () {
  this.div = document.createElement('div');
  this.div.annotateHide = true;
  this.div.style.position = 'absolute';
  this.div.style.top = '0px';
  this.div.style.left = '0px';
  this.div.style.display = 'none';
  this.div.style.zIndex = '10000';
  this.div.innerHTML = '<div style="'+styles.base+styles.border+'">' +
    '<textarea id="webannotate-text" style="width: 100%; height: 5em"></textarea> <br>' +
    '<button style="'+styles.button+'" type="button" id="webannotate-save">Save</button>' +
    '<button style="'+styles.button+'" type="button" id="webannotate-clear">Clear/Cancel</button>';
  document.body.appendChild(this.div);
  this.text = document.getElementById('webannotate-text');
  this.saveButton = document.getElementById('webannotate-save');
  this.saveButton.addEventListener('click', this.save.bind(this), false);
  this.clearButton = document.getElementById('webannotate-clear');
  this.clearButton.addEventListener('click', this.clear.bind(this), false);
};

AnnotationForm.prototype.save = function () {
  if (! this.text.value) {
    // FIXME: or treat as cancel?
    return;
  }
  this.resetForm();
  server.addAnnotation({selector: this.selector, text: this.text.value});
  server.saveAnnotations(this.clear.bind(this));
};

AnnotationForm.prototype.clear = function () {
  this.resetForm();
  this.text.value = '';
  this.hide();
};

AnnotationForm.prototype.position = function (pos, selector) {
  this.div.style.top = pos.top + 'px';
  this.div.style.left = pos.left + 'px';
  this.div.style.display = '';
  this.selector = selector;
  this.text.focus();
};


function Annotation(repr, server) {
  if (this === window) {
    throw 'You forgot new';
  }
  this.repr = repr;
  this.server = server;
  this.div = null;
  this.rangePosition = null;
};

Annotation.prototype.display = function () {
  if (this.div) {
    this.div.style.display = '';
    return;
  }
  this.viewState = 'small';
  this.div = document.createElement('div');
  this.div.annotateHide = true;
  this.div.annotation = true;
  this.div.style.position = 'absolute';
  this.div.style.zIndex = '9990';
  this.div.innerHTML = '<div style="padding: 0.3em; '+styles.base+styles.border+'"><div></div><div style="display: none"><button style="'+styles.button+'" type="button">Delete</button></div></div>';
  var inner = this.div.getElementsByTagName('div')[0];
  inner.getElementsByTagName('div')[0].innerHTML = this.parseText(this.repr.text);
  this.controlDiv = inner.getElementsByTagName('div')[1];
  console.log(this.div, this.controlDiv);
  this.deleteButton = this.controlDiv.getElementsByTagName('button')[0];
  var self = this;
  this.deleteButton.addEventListener('click', function () {
    self.deleteFromServer();
  }, false);
  this.div.addEventListener('click', function () {
    self.expand();
  }, false);
  if (this.repr.selector.click) {
    var click = this.repr.selector.click;
    var el = document.getElementById(click.element);
    var pos = getElementPosition(el);
    pos = {top: pos.top + click.offsetTop,
           left: pos.left + click.offsetLeft};
  } else {
    this.rangePosition = showAnnotationRange(this.repr.selector.range);
    var el = this.rangePosition.elements[this.rangePosition.elements.length-1];
    var pos = getElementPosition(el);
    pos = {top: pos.top + el.offsetHeight,
           left: pos.left};
  }
  this.position(pos);
  document.body.appendChild(this.div);
};

Annotation.prototype.parseText = function (text) {
  /* Take plain text and apply some (minimal) formatting to it */
  text = quoteText(text);
  text = text.replace(/\n/g, '<br>\n');
  // FIXME: should use multiple &nbsp's:
  text = text.replace(/  /g, ' &nbsp;');
  return text;
};

Annotation.prototype.position = function (pos) {
  this.div.style.top = pos.top + 'px';
  this.div.style.left = pos.left + 'px';
};

Annotation.prototype.click = function (pos) {
  if (this.viewState == 'small') {
    this.expand();
  } else {
    this.compact();
  }
};

Annotation.prototype.expand = function () {
  this.viewState = 'large';
  this.controlDiv.style.display = '';
  if (this.server.raisedAnnotation) {
    // Lower any other forms
    this.server.raisedAnnotation.zIndex = '9991';
  }
  this.div.style.zIndex = '9992';
  this.server.raisedAnnotation = this;
  if (this.rangePosition) {
    highlightAnnotationRange(this.rangePosition, styles.annotationHighlight);
  }
};

Annotation.prototype.compact = function () {
  this.viewState = 'small';
  this.compact();
  this.controlDiv.style.display = 'none';
  this.div.style.zIndex = '9990';
  if (this.rangePosition) {
    highlightAnnotationRange(this.rangePosition, styles.annotationBackground);
  }
  if (this.server.raisedAnnotation === this) {
    this.server.raisedAnnotation = null;
  }
};

Annotation.prototype.hide = function () {
  this.div.style.display = 'none';
  if (this.rangePosition) {
    removeAnnotationRange(this.rangePosition);
    this.rangePosition = null;
  }
};

Annotation.prototype.show = function () {
  this.div.style.display = '';
  if (this.repr.selector.range) {
    this.rangePosition = showAnnotationRange(this.repr.selector.range);
  }
};

Annotation.prototype.deleteFromServer = function () {
  this.hide();
  this.server.removeAnnotation(this);
  this.server.saveAnnotations();
  this.div.parentNode.removeChild(this.div);
};


/*************************************************************
 Range routines (taken from Browser Mirror):
 */

function expandRange(range) {
  /* Given a range object, return
       {start: el, startOffset: int, startSibling: bool,
        end: el, endOffset: int, endSibling: bool}
     The standard range object (https://developer.mozilla.org/en/DOM/range) tends to
     point to text nodes which are not referencable for us.  If *Sibling is true, then the
     offset is after/before the element; if false then it is *interior to* the element.
  */
  var result = {start: range.startContainer, end: range.endContainer,
                startOffset: range.startOffset, endOffset: range.endOffset,
                startText: false, endText: false};
  function doit(name) {
    if (result[name].nodeType == document.TEXT_NODE) {
      while (true) {
        var prev = result[name].previousSibling;
        if (prev === null) {
          result[name] = result[name].parentNode;
          result[name+'Text'] = 'inner';
          break;
        } else if (prev.nodeType == document.ELEMENT_NODE) {
          result[name] = prev;
          result[name+'Text'] = 'after';
          break;
        } else if (prev.nodeType == document.TEXT_NODE) {
          result[name] = prev;
          result[name+'Offset'] += prev.nodeValue.length;
        }
      }
    }
  }
  doit('start'); doit('end');
  return result;
}

function showRange(range, elCallback) {
  var inner;
  if (range.start == range.end && range.startText == 'inner' && range.endText == 'inner') {
    // A special case, when the range is entirely within one element
    var el = splitTextBetween(range.start, range.startOffset, range.endOffset);
    elCallback(el);
    return;
  }
  if (range.startText == 'inner') {
    range.start = splitTextAfter(range.start.childNodes[0], range.startOffset);
  } else if (range.startText == 'after') {
    range.start = splitTextAfter(range.start.nextSibling, range.startOffset);
  } else if (range.startOffset) {
    inner = range.start.childNodes[range.startOffset];
    // While the spec says these offsets specify children, they don't always, and sometimes
    // the "container" is the element selected.
    if (inner) {
      range.start = inner;
    }
  }
  if (range.endText == 'inner') {
    range.end = splitTextBefore(range.end.childNodes[0], range.endOffset);
  } else if (range.endText == 'after') {
    range.end = splitTextBefore(range.end.nextSibling, range.endOffset);
  } else if (range.endOffset) {
    inner = range.end.childNodes[range.endOffset];
    if (inner) {
      range.end = inner;
    }
  }
  // Now we strictly need to go from the start element to the end element (inclusive!)
  var pos = range.start;
  var seenParents = [];
  while (true) {
    // This wraps top-level text elements in a span, but doesn't wrap text that
    // is inside some element we've already seen
    if (pos.nodeType == document.TEXT_NODE && seenParents.indexOf(pos.parentNode) == -1) {
      var span = document.createElement('span');
      span.artificialRangeElement = true;
      span.appendChild(document.createTextNode(pos.nodeValue));
      pos.parentNode.replaceChild(span, pos);
      pos = span;
    }
    elCallback(pos);
    seenParents.push(pos);
    pos = getNextElement(pos);
    if (pos === null) {
      log(WARN, 'pos fell out to null', range.start);
      break;
    }
    while (containsElement(pos, range.end)) {
      // FIXME: at some point pos might be a TextNode that needs to be wrapped in
      // a span.
      pos = pos.childNodes[0];
    }
    if (pos == range.end) {
      elCallback(pos);
      break;
    }
  }
}

function containsElement(container, subelement) {
  /* Returns true if subelement is inside container
     Does not return true if subelement == container */
  if (container == subelement) {
    return false;
  }
  if (container.nodeType != document.ELEMENT_NODE) {
    return false;
  }
  for (var i=0; i<container.childNodes.length; i++) {
    var node = container.childNodes[i];
    if (node == subelement) {
      return true;
    }
    if (containsElement(container.childNodes[i], subelement)) {
      return true;
    }
  }
  return false;
}

function getNextElement(el) {
  if (el.childNodes && el.childNodes.length) {
    return el.childNodes[0];
  }
  while (! el.nextSibling) {
    el = el.parentNode;
    if (! el) {
      log(WARN, 'no parent');
      return null;
    }
  }
  return el.nextSibling;
}

function splitTextBefore(el, offset) {
  /* Creates a node that emcompasses all the text starting at el
     and going offset characters */
  var span = document.createElement('span');
  span.artificialRangeElement = true;
  var text = '';
  if (el.nodeType != document.TEXT_NODE) {
    throw 'Unexpected node: ' + el;
  }
  while (el.nodeValue.length < offset) {
    text += el.nodeValue;
    offset -= el.nodeValue.length;
    var remove = el;
    el = el.nextSibling;
    remove.parentNode.removeChild(remove);
  }
  text += el.nodeValue.substr(0, offset);
  var rest = el.nodeValue.substr(offset, el.nodeValue.length-offset);
  el.nodeValue = rest;
  span.appendChild(document.createTextNode(text));
  el.parentNode.insertBefore(span, el);
  return span;
}

function splitTextAfter(el, offset) {
  /* Creates a node *after* offset characters, encompassing all
     text that follows it.  Also all other text siblings will be
     encompassed by spans. */
  var text = '';
  while (el.nodeValue.length < offset) {
    text += el.nodeValue;
    offset -= el.nodeValue.length;
    if (el.nextSibling) {
      el = el.nextSibling;
    } else {
      log(WARN, 'Could not get ' + offset + 'chars from element', el);
      break;
    }
  }
  var rest = el.nodeValue.substr(offset, el.nodeValue.length-offset);
  el.nodeValue = el.nodeValue.substr(0, offset);
  var last = document.createElement('span');
  last.artificialRangeElement = true;
  var span = last;
  last.appendChild(document.createTextNode(rest));
  el.parentNode.insertBefore(last, el.nextSibling);
  var pos = last.nextSibling;
  while (pos && pos.nodeType == document.TEXT_NODE) {
    span.appendChild(document.createTextNode(pos.nodeValue));
    var next = pos.nextSibling;
    pos.parentNode.removeChild(pos);
    pos = next;
  }
  return span;
}

function splitTextBetween(el, start, end) {
  /* Creates a span that encompasses the text within el, between start and
     end character offsets */
  if (start > end) {
    throw 'Unexpected range: '+start+' to '+end;
  }
  var innerLength = end-start;
  var startText = '';
  var endText = '';
  var innerText = '';
  var inStart = true;
  var inEnd = false;
  var textNodes = [];
  for (var i=0; i<el.childNodes.length; i++) {
    var node = el.childNodes[i];
    if (node.nodeType != document.TEXT_NODE) {
      if (inEnd) {
        break;
      }
      log(WARN, 'Unexpected element', node);
      continue;
    }
    textNodes.push(node);
    var text = node.nodeValue;
    if (inStart && text.length < start) {
      startText += text;
      start -= text.length;
    } else if (inStart) {
      startText += text.substr(0, start);
      inStart = false;
      text = text.substr(start, text.length-start);
    }
    if ((! inStart) && (! inEnd)) {
      if (text.length < innerLength) {
        innerText += text;
        innerLength -= text.length;
      } else {
        innerText += text.substr(0, innerLength);
        text = text.substr(innerLength, text.length-innerLength);
        inEnd = true;
      }
    }
    if (inEnd) {
      endText += text;
    }
  }
  var startNode = document.createTextNode(startText);
  var endNode = document.createTextNode(endText);
  var innerNode = document.createElement('span');
  innerNode.artificialRangeElement = true;
  innerNode.appendChild(document.createTextNode(innerText));
  for (i=0; i<textNodes.length; i++) {
    el.removeChild(textNodes[i]);
  }
  el.insertBefore(endNode, el.childNodes[0]);
  el.insertBefore(innerNode, endNode);
  el.insertBefore(startNode, innerNode);
  return innerNode;
}

function getElementPosition(el) {
  var top = 0;
  var left = 0;
  while (el) {
    if (el.offsetTop) {
      top += el.offsetTop;
    }
    if (el.offsetLeft) {
      left += el.offsetLeft;
    }
    el = el.offsetParent;
  }
  return {top: top, left: left};
}


/*************************************************************
 Startup routines:
 */

if (window.runBookmarklet) {
  activateBookmarklet(window.runBookmarklet);
}

if (window.runComments) {
  var appUrl = window.runComments.app;
  var pageUrl = window.runComments.page;
  activateComments(appUrl, pageUrl);
}
