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

var server;

$(function () {
  var server = new Server(annotationUrl);
  // FIXME: for debugging:
  window.server = server;
  server.getAnnotations();
  server.showPanel();
  if (window.Auth) {
    onauthready();
  }
});

function onauthready() {
  if (! server) {
    return;
  }
  var self = server;
  Auth.onlogin = function () {
    self.loginStatus.text(Auth.email + ' ');
    var logoutEl = $('<a href="#">logout</a>').attr('style', styles.link);
    self.loginStatus.append(logoutEl);
    logoutEl.click(function () {
      // FIXME: should I reload here?
      Auth.logout();
      return false;
    });
  };
  Auth.onlogout = function () {
    self.loginStatus.clear();
    var loginEl = $('<a href="#">login</a>').attr('style', styles.link);
    self.loginStatus.append(loginEl);
    loginEl.click(function () {
      Auth.request();
    });
  };
}

function Server(annotationUrl) {
  if (this === window) {
    throw 'You forgot new';
  }
  this.annotationUrl = annotationUrl;
  this.annotations = [];
}

Server.prototype.getAnnotations = function () {
  var self = this;
  $.ajax({
    url: this.annotationUrl,
    type: 'GET',
    dataType: 'json',
    success: function (resp) {
      var anns = resp.annotations;
      for (var i=0; i<anns.length; i++) {
        anns[i].fromServer = true;
        self.addAnnotation(anns[i]);
      }
      console.log('Received', anns.length, 'annotations from server');
    },
    error: function (req, status, error) {
      if (req.status == 404) {
        // All okay, we just don't have annotations
        console.log('No annotations on server');
        return;
      }
      console.log('Error getting annotations:', req.status, 'error:', error);
    }
  });
};

Server.prototype.addAnnotation = function (repr) {
  var obj = new Annotation(repr, this);
  obj.display();
  this.annotations.push(obj);
  return obj;
};

Server.prototype.removeAnnotation = function (ann) {
  if (this.annotations.indexOf(ann) == -1) {
    throw 'Annotation does not exist: ' + ann;
  }
  this.annotations.splice(this.annotations.indexOf(ann), 1);
};

Server.prototype.showPanel = function () {
  var self = this;
  var baseHref = $('base').attr('href');
  this.panel = $('<div style="position: fixed; top: 10px; right: 10px; height: 10em; zIndex: 10001"></div>');
  this.panel[0].annotateHide = true;
  var innerDiv = $('<div></div>')
    .attr('style', styles.base + styles.border + 'padding: 6px 3px 6px 3px;');
  this.annotateButton = $('<span title="Make annotations on the page">Annotate</span>')
    .attr('style', styles.bigButton)
    .appendTo(innerDiv);
  this.viewButton = $('<span title="View the page (without adding annotations)">View</span>')
    .attr('style', styles.bigButton)
    .appendTo(innerDiv);
  this.hideButton = $('<span title="Hide all the annotations">Hide</span>')
    .attr('style', styles.bigButton)
    .appendTo(innerDiv);
  var info = $('<div style="padding-top: 4px"></div>')
    .appendTo(innerDiv);
  this.infoButton = $('<span style="cursor: pointer">Info: &#9656;</span>')
    .appendTo(info);
  this.infoDetails = $('<div></div>')
    .hide()
    .appendTo(info);
  this.loginStatus = $('<span></span>')
    .appendTo(this.infoDetails);
  this.infoDetails.append($('<br>'));
  this.infoDetails.append('URL: ');
  this.infoDetails.append($('<a target="_blank"></a>')
    .attr('style', styles.link)
    .text(baseHref)
    .attr('href', baseHref));
  this.shareText = $('<input type="text">')
    .hide()
    .appendTo(info);
  $('body').append(innerDiv);

  this.annotateButton.click(function () {
    self.setView('annotate');
  });
  this.viewButton.click(function () {
    self.setView('view');
  });
  this.hideButton.click(function () {
    if (self.viewingState == 'hide') {
      self.setView('view');
    } else {
      self.setView('hide');
    }
  });
  this.infoButton.click(function (ev) {
    if (self.infoDetails.is(':visible')) {
      self.infoDetails.hide();
      self.infoButton.html('Info: &#9656;');
    } else {
      self.infoDetails.show();
      self.infoButton.html('Info: &#9662;');
    }
    return false;
  });
  /*
  this.shareButton.click(function (ev) {
    self.shareButton.text('Share...');
    self.getShareLink(function (data) {
      if (! data) {
        self.shareButton.innerHTML = 'Share failed';
        return;
      }
      self.shareButton.hide();
      self.shareText.show().val(data.url).focus().select();
      if (window.clipboardData) {
        window.clipboardData.setData('text', self.shareText.value);
      }
      self.shareText.on('blur', function () {
        self.shareText.hide();
        self.shareButton.text('Share').show();
      });
    });
    return false;
  }); */

  this.clickListener = this.clickEvent.bind(this);
  this.changeListener = this.changeEvent.bind(this);
  this.annotationForm = new AnnotationForm(this);
  $('body').append(this.panel);
  this.setView('annotate');
  this.panel.append(innerDiv);
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
    this.annotateButton.hide();
    this.viewButton.hide();
    this.hideAnnotations();
    this.annotationForm.hide();
    document.removeEventListener('click', this.clickListener, true);
    document.removeEventListener('selectionchange', this.changeListener, true);
  }
};

Server.prototype.turnOff = function (button, text) {
  button.show();
  button.css({
    borderStyle: 'outset',
    color: styles.bigButtonInactiveColor
  });
  if (text) {
    button.text(text);
  }
};

Server.prototype.turnOn = function (button, text) {
  button.show();
  button.css({
    borderStyle: 'inset',
    color: styles.bigButtonActiveColor
  });
  if (text) {
    button.text(text);
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
  var repr = [];
  for (var i=0; i<this.annotations.length; i++) {
    if (this.annotations[i].fromServer) {
      continue;
    }
    repr.push(this.annotations[i].repr);
  };
  var data = {annotations: repr};
  $.ajax({
    url: this.annotationUrl,
    contentType: 'application/json',
    type: 'POST',
    data: JSON.stringify(data),
    success: function () {
      callback();
    }
  });
};

Server.prototype.getShareLink = function (callback) {
  return null;
  $.ajax({
    url: location.href + '?getlink',
    dataType: 'json',
    success: function (resp) {
      callback(resp);
    }
  });
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
    this.div.hide();
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
  this.div = $('<div style="position: absolute; top: 0px; left: 0px; display: none; z-index: 10000"></div>');
  this.div[0].annotateHide = true;
  var inner = $('<div></div>')
    .attr('style', styles.base + styles.border);
  this.text = $('<textarea style="width: 100%; height: 3em;"></textarea>');
  inner.append(this.text);
  inner.append($('<br>'));
  this.saveButton = $('<button type="button">Save</button>')
    .attr('style', styles.button)
    .appendTo(inner);
  this.clearButton = $('<button type="button">Clear/Cancel</button>')
    .attr('style', styles.button)
    .appendTo(inner);
  this.saveButton.click(this.save.bind(this));
  this.clearButton.click(this.clear.bind(this));
  this.div.append(inner);
  $('body').append(this.div);
};

AnnotationForm.prototype.save = function () {
  if (! this.text.val()) {
    // FIXME: or treat as cancel?
    return;
  }
  this.resetForm();
  console.log('added', this.server.addAnnotation({selector: this.selector, text: this.text.val()})+'');
  this.server.saveAnnotations(this.clear.bind(this));
};

AnnotationForm.prototype.clear = function () {
  this.resetForm();
  this.text.val('');
  this.hide();
};

AnnotationForm.prototype.position = function (pos, selector) {
  this.div.show();
  this.div.css({
    top: pos.top + 'px',
    left: pos.left + 'px'
  });
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

Annotation.prototype.toString = function () {
  return '[Annotation ' + JSON.stringify(this.repr) + ']';
};

Annotation.prototype.display = function () {
  var self = this;
  if (this.div) {
    this.div.show();
    return;
  }
  this.viewState = 'small';
  this.div = $('<div></div>');
  this.div[0].annotateHide = true;
  this.div[0].annotation = true;
  this.div.css({
    position: 'absolute',
    zIndex: '9990'
  });
  var inner = $('<div></div>').attr('style', 'padding: 0.3em;' + styles.base + styles.border);
  inner.html(this.parseText(this.repr.text));
  this.div.append(inner);
  this.controlDiv = $('<div></div>');
  this.div.append(this.controlDiv);
  this.deleteButton = $('<button type="button">Delete</button>').attr('style', styles.button);
  this.controlDiv.append(this.deleteButton);
  this.deleteButton.click(function () {
    self.deleteFromServer();
  });
  this.div.click(function () {
    self.expand();
  });
  if (this.repr.selector.click) {
    var click = this.repr.selector.click;
    var el = $('#' + click.element);
    var pos = getElementPosition(el);
    pos = {top: pos.top + click.offsetTop,
           left: pos.left + click.offsetLeft};
  } else {
    this.rangePosition = showAnnotationRange(this.repr.selector.range);
    var el = this.rangePosition.elements[this.rangePosition.elements.length-1];
    var pos = getElementPosition($(el));
    pos = {top: pos.top + el.offsetHeight,
           left: pos.left};
  }
  this.position(pos);
  $('body').append(this.div);
};

function quoteText(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;');
}

Annotation.prototype.parseText = function (text) {
  /* Take plain text and apply some (minimal) formatting to it */
  text = quoteText(text);
  text = text.replace(/\n/g, '<br>\n');
  // FIXME: should use multiple &nbsp's:
  text = text.replace(/  /g, ' &nbsp;');
  return text;
};

Annotation.prototype.position = function (pos) {
  this.div.css({
    top: pos.top + 'px',
    left: pos.left + 'px'
  });
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
  this.controlDiv.show();
  if (this.server.raisedAnnotation) {
    // Lower any other forms
    this.server.raisedAnnotation.zIndex = '9991';
  }
  this.div.css({zIndex: '9992'});
  this.server.raisedAnnotation = this;
  if (this.rangePosition) {
    highlightAnnotationRange(this.rangePosition, styles.annotationHighlight);
  }
};

Annotation.prototype.compact = function () {
  this.viewState = 'small';
  this.compact();
  this.controlDiv.hide();
  this.div.css({zIndex: '9990'});
  if (this.rangePosition) {
    highlightAnnotationRange(this.rangePosition, styles.annotationBackground);
  }
  if (this.server.raisedAnnotation === this) {
    this.server.raisedAnnotation = null;
  }
};

Annotation.prototype.hide = function () {
  this.div.hide();
  if (this.rangePosition) {
    removeAnnotationRange(this.rangePosition);
    this.rangePosition = null;
  }
};

Annotation.prototype.show = function () {
  this.div.show();
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
  var el = el[0];
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
