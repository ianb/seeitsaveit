var _CONTAINER = null;

window.addEventListener("message", function (event) {
  console.log('iframe received data', event.data);
  // FIXME: do proper check here
  _CONTAINER = event.source;
  _CONTAINER.postMessage('test', "*");
  if (event.data == "scrape") {
    try {
      scrape(function (result) {
        console.log('sending', result);
        _CONTAINER.postMessage("scriptresult:" + JSON.stringify(result), "*");
      });
    } catch (e) {
      var result = {error: e+''};
      if (e.stack) {
        result.stack = e.stack.replace(/data:.*:/, '<script>:');
      }
      _CONTAINER.postMessage("scriptresult:" + JSON.stringify(result), "*");
    }
  } else if (event.data.substr(0, 'showselector:'.length) == 'showselector:') {
    //_CONTAINER.postMessage('selector:{"showing":".foo","subclasses":[],"els":[]}', "*");
    var selector = event.data.substr('showselector:'.length);
    var result = getSelectorInfo(selector);
    //console.log('sending data', JSON.stringify(result), _CONTAINER);
    _CONTAINER.postMessage('selector:' + JSON.stringify(result), "*");
  } else if (event.data == "hello") {
    _CONTAINER.postMessage("classes:" + JSON.stringify(getAllClasses()), "*");
  }
}, false);

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

console.log('develop-iframe loaded');
