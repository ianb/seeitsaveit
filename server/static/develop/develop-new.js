var BASE = location.protocol + '//' + location.host;
var DOC = null;
var REGISTER = BASE + '/register';
var IFRAME = BASE + '/develop/develop-iframe.js';
var IFRAME_CSS = BASE + '/develop/develop-iframe.css';
var JSEEITSAVEIT = BASE + '/static/jseeitsaveit.js';

var DEFAULT_SCRIPT = (
'/*\n' +
'@function scrape\n' +
'@require jquery\n' +
'@name Do Something Neat\n' +
'@domain DOMAIN.COM\n' +
'@type what-does-this-produce\n' +
'*/\n' +
'\n' +
'function scrape(callback) {\n' +
'  callback({ok: true});\n' +
'}\n'
);

function renderDefaultScript() {
  if (DOC) {
    return DEFAULT_SCRIPT.replace('DOMAIN.COM', DOC.domain);
  } else {
    return DEFAULT_SCRIPT;
  }
}

function iwindow() {
  return $('#iframe')[0].contentWindow;
}

var iframeToRemove = [];
function iframeLoad(callback) {
  iframeToRemove.push(callback);
  $('#iframe').bind('load', callback);
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
  console.log('setDocument(', doc.location, extraScript, ')');
  var location = doc.location;
  doc.domain = getDomain(location);
  checkServerScript();
  $('#url').text(location);
  var page = makePage(doc, extraScript);
  var w = iwindow();
  iframeToRemove.forEach(function (callback) {
    $('#iframe').unbind('load', callback);
  });
  iframeToRemove = [];
  $('#iframe').attr('src', encodeData('text/html', page));
  iframeLoad(function () {
    iwindow().postMessage('hello', "*");
  });
  if (doc.js) {
    console.log('getting JS from', doc.js);
    if ($('#script').val() == DEFAULT_SCRIPT) {
      $.ajax({
        url: doc.js,
        type: 'GET',
        success: function (resp) {
          $('#script').val(resp);
        },
        error: function (req, status, error) {
          console.log('Error loading script', doc.js, 'error:', error);
        }
      });
    }
  } else if ($('#script').val() == DEFAULT_SCRIPT) {
    $('#script').val(renderDefaultScript());
  }
  if (! extraScript) {
    // FIXME: this is kind of an ad hoc way to decide this
    iframeLoad(function () {
      console.log('sending bindclick');
      iwindow().postMessage("bindclick", "*");
    });
  }
  inInspectHighlight = false;
}

function makePage(doc, extraScript) {
  var head = '<base href="' + doc.location + '">\n';
  head += '<meta charset="UTF-8">\n';
  head += '<script src="https://ajax.googleapis.com/ajax/libs/jquery/1.7.2/jquery.min.js"></script>';
  head += '<script src="' + htmlQuote(JSEEITSAVEIT) + '"></script>\n';
  head += '<script src="' + htmlQuote(IFRAME) + '"></script>\n';
  head += '<link rel="stylesheet" href="' + htmlQuote(IFRAME_CSS) + '">\n';
  if (extraScript) {
    if (extraScript.url) {
      head += '<script src="' + htmlQuote(extraScript.url) + '"></script>\n';
    } else {
      head += '<script>' + extraScript + '</script>\n';
    }
  }
  head += doc.head;
  var body = doc.body;
  return makeTag('html', doc.htmlAttrs) + '<head>' + head + '</head>' +
    makeTag('body', doc.bodyAttrs) + body + '</body>';
}

function makeTag(tagName, attrs) {
  var s = '<' + tagName;
  if (attrs) {
    for (var i=0; i<attrs.length; i++) {
      s += ' ' + attrs[i][0] + '="' + htmlQuote(attrs[i][1]) + '"';
    }
  }
  s += '>';
  return s;
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

function encodeData(content_type, data) {
  // Hacky way to UTF-8 encode data:
  data = unescape(encodeURIComponent(data));
  return 'data:' + content_type + ';base64,' + btoa(data);
}

function executeScript() {
  var s = $('#script').val();
  console.log('executing', s);
  try {
    esprima.parse(s);
  } catch (e) {
    showResult({error: e+''});
    return;
  }
  console.log('reseting iframe');
  setDocument(null, s);
  iframeLoad(function () {
    console.log('sending scrape');
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

function activateShowSelector(value) {
  $('#showselector').val(value);
  if (! value) {
    return;
  }
  console.log('sending selector', value);
  iwindow().postMessage('showselector:' + value, "*");
}

function cmp(a, b) {
  return a < b ? -1 : (a > b ? 1 : 0);
}

function showSelector(data) {
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
    data.subclasses.sort(function (a, b) {return -cmp(a.count, b.count) || cmp(a.name, b.name);});
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
    position.text((index+1) + '/' + data.els.length);
    var el = data.els[index];
    preview.text(el);
    iwindow().postMessage('highlight:' + JSON.stringify({selector: data.showing, index: index}), "*");
  }
  showPreview();
}

$(function () {
  console.log('setting up onload');
  $('#execute').click(function () {
    executeScript();
    return false;
  });
  $('#selectors').change(function () {
    activateShowSelector(this.value);
  });
  $('#showselector').change(function () {
    activateShowSelector(this.value);
  });
  $('#iframe').height($(document).height()-68);
  $('#login').bind('click', loginClicked);
  setAuth();
  $('#saver').bind('click', saveClicked);
  $('#register').bind('click', registerClicked);
  $('#load-keep').click(loadKeepClicked);
  $('#load-overwrite').click(loadOverwriteClicked);
  if (! $('#script').val()) {
    $('#script').val(DEFAULT_SCRIPT);
  }
});

var authUser = null;

function setAuth() {
  var value = null;
  var ca = document.cookie.split(';');
  for (var i=0; i<ca.length; i++) {
    var c = ca[i];
    while (c.charAt(0)==' ') {
      c = c.substring(1,c.length);
    }
    if (c.indexOf("auth") == 0) {
      value = c.substring(5,c.length);
    }
  }
  if (! value) {
    return;
  }
  value = JSON.parse(unescape(value));
  var email = value.email;
  $('#login').text(email);
  authUser = email;
  checkServerScript();
}

function checkServerScript() {
  if (authUser && DOC) {
    $.ajax({
      url: scriptURL(),
      type: "GET",
      success: function (resp, status, req) {
        if ($('#script').val() == DEFAULT_SCRIPT
            || $('#script').val() == renderDefaultScript()) {
          $('#script').val(resp);
        } else if (resp != $('#script').val()) {
          $('#load-domain').text(DOC.domain);
          $('#load-data').text(resp);
          $('#load-question').modal();
        }
      },
      error: function (req, status, error) {
        // do nothing
      }
    });
  }
}

function loadKeepClicked() {
  $('#load-question').modal('hide');
}

function loadOverwriteClicked() {
  $('#script').val($('#load-data').text());
  $('#load-question').modal('hide');
}

function loginClicked() {
  if (authUser) {
    document.cookie = "auth=;path=/;";
    $('#login').text('login');
    authUser = null;
    return false;
  }
  navigator.id.get(function (assertion) {
    var url = BASE + '/develop/api/auth';
    if (! assertion) {
      return;
    }
    $.ajax({
      type: 'POST',
      url: url,
      data: assertion,
      success: function (resp, status, req) {
        setAuth();
      },
      error: function (req, status, error) {
        console.log('Got error', status, error);
      }
    });
  });
  return false;
}

function scriptURL() {
  return location.protocol + '//' + location.host + '/develop/api/scripts/' +
    encodeURIComponent(authUser) + '/' + encodeURIComponent(DOC.domain) + '.js';
}

function saveClicked() {
  if (! authUser) {
    $('#saver').text('Save (must log in)');
    return false;
  }
  $('#saver').text('Saving...').addClass('active');
  $.ajax({
    type: 'PUT',
    url: scriptURL(),
    data: $('#script').val(),
    success: function (resp, status, req) {
      $('#saver').text('Save').removeClass('active');
    },
    error: function (req, status, error) {
      console.log('Error in PUT to', scriptURL(), 'status:', status, 'error:', error);
      $('#saver').text('Save failed').removeClass('active');
    }
  });
  return false;
}

function registerClicked() {
  $('#register').text('Registering...').addClass('active');
  $.ajax({
    type: 'POST',
    url: REGISTER,
    data: scriptURL(),
    success: function (resp, status, req) {
      $('#register').text('Registered').removeClass('active');
    },
    error: function (req, status, error) {
      $('#register').text('Register failed').removeClass('active');
      console.log('Error in POST to', REGISTER, 'status:', status, 'error:', error);
    }
  });
}

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

var inInspectHighlight = false;

function inspectElement(element) {
  $(".inspector").remove();
  var alert = $('<div class="inspector alert alert-block"></div>').alert();
  alert.append($('<a class="close" data-dismiss="alert" href="#">&times;</a>'));
  alert.append($('<span class="alert-heading"></span>').text("Element ").append(
    $('<code></code>').text(element.tagName)));
  var div = $('<div></div>');
  alert.append(div);
  function displayElement(element, container) {
    var name = element.tagName;
    if (element.classes && element.classes.length) {
      name += '.' + element.classes.join('.');
    }
    if (element.id) {
      name += '#' + element.id;
    }
    var code = $('<code></code>').text(name).prepend($('<img class="arrow" src="arrow-right.png">'));;
    container.append(code);
    code.on('click', function () {
      var id = element.elId;
      inInspectHighlight = true;
      console.log('elId', element.elId+'');
      iwindow().postMessage('highlight:' + JSON.stringify({elId: element.elId}), "*");
    });
    /*code.on('mouseout', function () {
      if (inInspectHighlight) {
        iwindow().postMessage('highlight:null', "*");
        inInspectHighlight = false;
      }
    });*/
    if (element.text) {
      var textDiv = $('<div></div>').text('Text: ');
      textDiv.append($('<code></code>').text(element.text.substr(0, 50))
        .attr('title', element.text));
      container.append(textDiv);
    }
    if (element.html) {
      var htmlDiv = $('<div></div>').text('HTML: ');
      htmlDiv.append($('<code></code>').text(element.html.substr(0, 50)).
        attr('title', element.html));
      container.append(htmlDiv);
    }
    if (element.src || element.href) {
      var linkDiv = $('<div></div>');
      if (element.src) {
        var name = 'src';
      } else {
        var name = 'href';
      }
      linkDiv.text(name + '= ' + (element.src || element.href));
      container.append(linkDiv);
    }
  }
  displayElement(element, div);
  if (element.children && element.children.length) {
    var childDiv = $('<div></div>');
    div.append(childDiv);
    childDiv.append($('<h3></h3>').text('Children'));
    var ul = $('<ul></ul>');
    childDiv.append(ul);
    element.children.forEach(function (child) {
      var li = $('<li></li');
      ul.append(li);
      displayElement(child, li);
    });
  }
  if (element.parents && element.parents.length) {
    var parentDiv = $('<div></div>');
    div.append(parentDiv);
    parentDiv.append($('<h3></h3>').text('Parents'));
    ul = $('<ul></ul>');
    parentDiv.append(ul);
    element.parents.forEach(function (parent) {
      var li = $('<li></li>');
      ul.append(li);
      displayElement(parent, li);
    });
  }
  $('#button-set').after(alert);
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
  } else if ((result = getRest(data, 'inspect:'))) {
    inspectElement(result);
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

function getDomain(url) {
  url = url.replace(/^https?:\/+/i, '');
  url = url.replace(/\/.*$/, '');
  url = url.replace(/:.*$/, '');
  return url.toLowerCase();
}
