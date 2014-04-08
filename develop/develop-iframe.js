var _CONTAINER = null;
var _LOG = [];
var _ELEMENTS = {};

window.addEventListener("message", function (event) {
  console.log('iframe received data', event.data);
  // FIXME: do proper check here
  _CONTAINER = event.source;
  if (event.data.indexOf('scrape:') == 0) {
    var data = JSON.parse(event.data.substr(('scrape:').length));
    highlight();
    _LOG = [];
    runScraper(data.functionName, function (result) {
      _CONTAINER.postMessage('scriptresult:' + JSON.stringify(result), '*');
    });
    try {
      // FIXME: doesn't work with return value
      scrape(function (result) {
        console.log('sending', result);
        result['LOG'] = _LOG;
        _CONTAINER.postMessage("scriptresult:" + JSON.stringify(result), "*");
      }, logger);
    } catch (e) {
      var result = {error: e+''};
      if (e.stack) {
        result.stack = e.stack.replace(/data:.*:/, '<script>:');
      }
      _CONTAINER.postMessage("scriptresult:" + JSON.stringify(result), "*");
    }
  } else if (event.data.substr(0, 'showselector:'.length) == 'showselector:') {
    highlight();
    //_CONTAINER.postMessage('selector:{"showing":".foo","subclasses":[],"els":[]}', "*");
    var selector = event.data.substr('showselector:'.length);
    var result = getSelectorInfo(selector);
    //console.log('sending data', JSON.stringify(result), _CONTAINER);
    _CONTAINER.postMessage('selector:' + JSON.stringify(result), "*");
  } else if (event.data.substr(0, 'highlight:'.length) == 'highlight:') {
    var selector = JSON.parse(event.data.substr('highlight:'.length));
    highlight(selector);
  } else if (event.data == "bindclick") {
    document.addEventListener("click", clickEvent, true);
  } else if (event.data == "hello") {
    createElementIds();
    _CONTAINER.postMessage("classes:" + JSON.stringify(getAllClasses()), "*");
  } else {
    console.warn("Could not understand message", event.data);
  }
}, false);

function runScraper(functionName, callback) {
  var timeoutId = null;
  logger.LOG = [];
  var TIMEOUT = 5000;
  function done(result) {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    if (result === null || typeof result != "object" || isArray(result)) {
      result = {error: "function returned invalid result: " + JSON.stringify(result)};
    }
    if (logger.LOG.length) {
      result.LOG = logger.LOG;
      logger.LOG = [];
    }
    callback(result);
  }
  function error(msg) {
    done({error: msg});
  }

  timeoutId = setTimeout(function () {
    error('Script timed out after ' + TIMEOUT + ' milliseconds');
  }, TIMEOUT);

  if (! window[functionName]) {
    error('No function ' + functionName + '() found');
  }
  try {
    var result = window[functionName](done, logger);
    if (result !== undefined) {
      done(result);
    }
  } catch (e) {
    var msg = 'Exception: ' + e;
    if (e.stack) {
      msg += '\n' + e.stack.replace(/data:.*:/, '<script>:');
    }
    error(msg);
  }
}

function isArray(o) {
  return (typeof o.length == "number" && o.forEach);
}

// Also found in scraper-runner.js:
function logger() {
  if (arguments.length == 1) {
    var s = arguments[0];
  } else {
    s = '';
    for (var i=0; i<arguments.length; i++) {
      if (s) {
        s += ' ';
      }
      var a = arguments[i];
      if (typeof a == "string" || typeof a == "number" || a === null) {
        s += a;
      } else {
        var aJson = JSON.stringify(a);
        if (aJson && aJson != "null") {
          s += aJson;
        } else {
          s += a;
        }
      }
    }
  }
  console.log("Log: " + s);
  logger.LOG.push(s);
}

logger.LOG = [];

function clickEvent(event) {
  event.stopPropagation();
  event.preventDefault();
  var el = event.target;
  var result = inspectElement(el);
  result.parents = [];
  result.children = [];
  var parent = el.parentNode;
  while (parent && parent.tagName != 'BODY') {
    result.parents.push(inspectElement(parent));
    parent = parent.parentNode;
  }
  var child = el;
  while (1) {
    child = firstChild(child);
    if (! child) {
      break;
    }
    result.children.push(child);
  }
  _CONTAINER.postMessage('inspect:' + JSON.stringify(result), "*");
  highlightEl(el);
}

function inspectElement(el) {
  highlight();
  var result = {
    tagName: el.tagName,
    id: el.id,
    elId: el.elId,
    classes: getClasses(el),
    html: el.innerHTML,
    text: $(el).text()
  };
  if (el.src) {
    result.src = el.src;
  }
  if (el.href) {
    result.href = el.href;
  }
  return result;
}

function firstChild(el) {
  for (var i=0; i<el.childNodes.length; i++) {
    var child = el.childNodes[i];
    if (child && child.nodeType == document.ELEMENT_NODE) {
      return child;
    }
  }
  return null;
}

function getAllClasses() {
  var els = document.getElementsByTagName("*");
  var classes = {};
  for (var i=0; i<els.length; i++) {
    getClasses(els[i]).forEach(function (cls) {
      if (cls in classes) {
        classes[cls]++;
      } else {
        classes[cls] = 1;
      }
    });
  }
  return classes;
}

function getClasses(el) {
  if (! el.className) {
    return [];
  }
  return el.className.replace(/^\s*/, '').replace(/\s*$/, '').split(/\s+/);
}

function getSelectorInfo(selector) {
  var data = {showing: selector};
  try {
    var els = document.querySelectorAll(selector);
  } catch (e) {
    data.error = e + '';
    return data;
  }
  data.count = els.length;
  data.els = [];
  data.subclasses = [];
  var classes = {};
  for (var i=0; i<els.length; i++) {
    var subels = els[i].getElementsByTagName("*");
    for (var j=0; j<subels.length; j++) {
      getClasses(subels[j]).forEach(function (c) {
        if (! (c in classes)) {
          classes[c] = {name: c, count: 1};
        } else {
          classes[c].count++;
        }
      });
    }
    data.els.push(serializeElement(els[i]));
  }
  for (i in classes) {
    data.subclasses.push(classes[i]);
  }
  data.subclasses.sort(function (a, b) {return a.name < b.name ? -1 : 1;});
  return data;
}

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

function htmlQuote(s) {
  if (! s) {
    return s;
  }
  if (s.search(/[&<"]/) == -1) {
    return s;
  }
  return s.replace(/&/g, "&amp;").replace(/</g, '&lt;').replace(/"/g, "&quot;");
}

function serializeElement(el) {
  var s = '<' + el.tagName;
  var attrs = el.attributes;
  if (attrs && attrs.length) {
    var l = attrs.length;
    for (var i=0; i<l; i++) {
      var name = attrs[i].name;
      var value = attrs[i].nodeValue;
      s += ' ' + name + '="' + htmlQuote(value) + '"';
    }
  }
  s += '>';
  if (! voidElements[el.tagName]) {
    s += el.innerHTML + '</' + el.tagName + '>';
  }
  return s;
}

var highlighted = null;

function highlight(selector) {
  unhighlight();
  if (! selector) {
    return;
  }
  if (selector.selector) {
    var els = document.querySelectorAll(selector.selector);
    var el = els[selector.index];
  } else if (selector.elId) {
    var el = _ELEMENTS[selector.elId];
  } else {
    throw 'Selector not understood: ' + JSON.stringify(selector);
  }
  highlightEl(el);
  el.scrollIntoView(false);
}

function unhighlight() {
  if (highlighted) {
    highlighted.className = highlighted.className.replace(/\s*develop-highlight/, '');
    highlighted = null;
  }
}

function highlightEl(el) {
  unhighlight();
  el.className += ' develop-highlight';
  highlighted = el;
}

function createElementIds() {
  _ELEMENTS = {};
  var els = document.getElementsByTagName("*");
  var l = els.length;
  var count = 1;
  for (var i=0; i<l; i++) {
    var id = 'el-' + (count++);
    els[i].elId = id;
    _ELEMENTS[id] = els[i];
  }
}

console.log('develop-iframe loaded');
