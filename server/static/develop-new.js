var DOC = null;

function iwindow() {
  return $('#iframe')[0].contentWindow;
}

function setDocument(doc, extraScript) {
  if (doc) {
    DOC = doc;
  } else if (! DOC) {
    console.log("setDocument called before message received");
    throw 'Too early to call setDocument';
  } else {
    doc = DOC;
  }
  var location = doc.location;
  var head = '<base href="' + doc.location + '">\n';
  head += '<script src="https://ajax.googleapis.com/ajax/libs/jquery/1.7.2/jquery.min.js"></script>';
  head += '<script src="http://localhost:8080/static/develop-iframe.js"></script>\n';
  if (extraScript) {
    if (extraScript.url) {
      head += '<script src="' + extraScript.url + '"></script>';
    } else {
      head += '<script>' + extraScript + '</script>\n';
    }
  }
  //head += '<script class="webxray" src="http://webxray.hackasaurus.org/webxray.js"></script>\n';
  head += doc.head;
  var page = '<html><head>' + head + '</head><body>' + doc.body + '</body></html>';
  var w = iwindow();
  $('#iframe').attr('src', encodeData('text/html', page));
  $('#iframe').load(function () {
    iwindow().postMessage('hello', "*");
  });
  $('#url').text(location);
}

function encodeData(content_type, data) {
  // Hacky way to UTF-8 encode data:
  data = unescape(encodeURIComponent(data));
  return 'data:' + content_type + ';base64,' + btoa(data);
}

function executeScript() {
  var s = $('#script').val();
  try {
    esprima.parse(s);
  } catch (e) {
    showResult({error: e+''});
    return;
  }
  setDocument(null, s);
  console.log('sending data');
  $('#iframe').load(function () {
    iwindow().postMessage("scrape", "*");
  });
}

function showResult(data) {
  if (data.error) {
    var alertClass = 'alert-error';
    var display = data.error;
    if (data.stack) {
      display += '\n' + data.stack;
    }
    var label = "Error:";
  } else {
    var alertClass = 'alert-success';
    display = JSON.stringify(data, null, '  ');
    var label = "Result:";
  }
  $('.executable').remove();
  var alert = $('<div class="executable alert alert-block"></div>').alert().addClass(alertClass);
  alert.append($('<a class="close" data-dismiss="alert" href="#">&times;</a>'));
  alert.append($('<span class="alert-heading"></span>').text(label));
  var pre = $('<pre class="pre-scrollable"></pre>').text(display);
  alert.append(pre);
  $('#button-set').after(alert);
}

function showXray() {
  setDocument(null, {url: "http://webxray.hackasaurus.org/webxray.js"});
}

function activateShowSelector(value) {
  $('#showselector').val(value);
  if (! value) {
    return;
  }
  console.log('sending selector', value);
  iwindow().postMessage('showselector:' + value, "*");
}

function showSelector(data) {
console.log('all goo showing', data);
  $('#showcselector').val(data.showing);
  var div = $('#aboutselector');
  div.empty();
  if (data.error) {
    div.append($('<span></span>').text(data.error));
    return;
  }
  div.append($('<span>Count: </span>')).append(
    $('<span id="aboutcount"></span>').text(data.count)).append(
    $('<br>'));
  if (data.subclasses && data.subclasses.length) {
    div.append($('<span>Subclasses:</span>'));
    var ul = $('<ul></ul>');
    div.append(ul);
    data.subclasses.forEach(function (cls) {
      var li = $('<li></li>').text(cls.name + ' (' + cls.count + ')');
      ul.append(li);
      li.click(function () {
        var val = $('#showselector').val() + ' .' + cls.name;
        $('#showclass').val(val);
        activateShowSelector(val);
      });
    });
  }
  var prev = $('<button style="margin-right: 3px" class="btn btn-mini btn-inverse">\u2190</button>');
  var next = $('<button class="btn btn-mini btn-inverse">\u2192</button>');
  var position = $('<span style="padding-left: 1em"></span>');
  div.append(prev).append(next).append(position).append($('<br>'));
  var preview = $('<div class="preview"></div>');
  div.append(preview);
  var index = 0;
  prev.click(function () {
    index--;
    if (index < 0) {
      index = data.els.length-1;
    }
    showPreview();
    return false;
  });
  next.click(function () {
    index++;
    if (index >= data.els.length) {
      index = 0;
    }
    showPreview();
    return false;
  });
  function showPreview() {
  console.log('showing', index, 'of', data.els.length);
    position.text((index+1) + '/' + data.els.length);
    var el = data.els[index];
    preview.text(el);
  }
  showPreview();
}

$(function () {
  var xraying = false;
  $('#execute').click(function () {
    executeScript();
  });
  $('#selectors').change(function () {
    activateShowSelector(this.value);
  });
  $('#showselector').change(function () {
    activateShowSelector(this.value);
  });
  $('#webxray').click(function () {
    xraying = ! xraying;
    if (xraying) {
      $('#webxray').button('toggle');
      showXray();
    } else {
      $('#webxray').button('toggle');
      setDocument(null);
    }
  });
  $('#iframe').height($(document).height());
});

function setClasses(classes) {
  var sorted = [];
  for (var i in classes) {
    sorted.push([i, classes[i]]);
  }
  sorted.sort(function (a, b) {
    return -cmp(a[1], b[1]) || cmp(a[0], b[0]);
  });
  var sel = $('#selectors');
  sel.empty();
  sel.append($('<option>--select a class--</option>'));
  sorted.forEach(function (item) {
    var option = $('<option></option>').attr('value', "."+item[0]).text(item[0] + ' (' + item[1] + ')');
    sel.append(option);
  });
}

function cmp(a, b) {
  return a < b ? -1 : (a > b ? 1 : 0);
}

window.addEventListener("message", function (event) {
  var data = event.data;
  console.log('got message', data.substr(0, 80), event.origin);
  var result = null;
  if ((result = getRest(data, 'doc:'))) {
    setDocument(result);
  } else if ((result = getRest(data, 'scriptresult:'))) {
    console.log('showing result', result);
    showResult(result);
  } else if ((result = getRest(data, 'selector:'))) {
    console.log('selector', result);
    showSelector(result);
  } else if ((result = getRest(data, 'classes:'))) {
    setClasses(result);
  } else {
    console.log('Could not understand message', data);
  }
}, false);

function getRest(string, prefix) {
  if (string.substr(0, prefix.length) != prefix) {
    return null;
  }
  return JSON.parse(string.substr(prefix.length));
}

console.log('added event listener');
