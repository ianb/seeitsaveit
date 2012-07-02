{{default appIncludeJs = 'https://myapps.mozillalabs.com/jsapi/include.js'}}
{{def bookmarklet}}
javascript:var n='dom-send-bookmarklet';var s=document.getElementById(n);if (s) s.parentNode.removeChild(s);s = document.createElement('script');s.src = {{repr(bookmarkletUrl)}};s.id = n;document.body.appendChild(s);})()
{{enddef}}
/* {{ bookmarklet }} */
(function () {
/* Bookmarklet that uses docserialize.js to send the page via the dom.send OWA service
   */

var appIncludeJs = {{ repr(appIncludeJs) }};

function domSend() {
  var serializer = new DocumentSerializer();
  var doc = serializer.serialize();
  var url = location.href + '';
  // FIXME: get selection here
  var data = {doc: doc, url: url};
  navigator.apps.invokeService('dom.send', data, function (v) {
    // Success
  }, function (e) {
    if (window.console) {
      console.log('Error invoking service: ' + e);
    }
  });
}

// Included from docserialize.js:
{{ docserializeJs }}

// FIXME: should also check document.readyState:
if (! navigator.apps) {
  var script = document.createElement('script');
  script.src = {{repr(appIncludeJs)}};
  document.body.appendChild(script);
  // FIXME: should make sure this loads somehow
  setTimeout(function () {
    if (navigator.apps) {
      domSend();
    } else {
      setTimeout(arguments.callee, 500);
    }
  }, 500);
} else {
  domSend();
}

})();
