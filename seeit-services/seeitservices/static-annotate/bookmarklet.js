{{def bookmarklet}}
javascript:var n='annotate-script';var s=document.getElementById(n);if (s) s.parentNode.removeChild(s);s = document.createElement('script');s.src = {{repr(bookmarkletUrl)}};s.id = n;document.body.appendChild(s);})()
{{enddef}}
/* {{ bookmarklet }} */
(function (bookmarkOptions) {
/* Bookmarklet that uses docserialize.js to send the current page
   to a webannotate server
   */

function activateBookmarklet(options) {
  var serializer = new DocumentSerializer(options);
  var doc = serializer.serialize();
  var url = location.href + '';
  // FIXME: get selection here
  var data = {doc: doc, url: url};
  navigator.apps.invokeService('dom.send', data, function (v) {
    // Success
  }, function (e) {
    // Error
  });
  //var form = createForm(options.appUrl, 'text/html', doc, {'ui-type': options.uiType});
  //form.submit();
}

function createForm(appUrl, content_type, body, fields) {
  var form = document.createElement('form');
  var href = location.href + '';
  href = href.replace(/^https?:\/\//i, '');
  href = href.replace(/\/+$/, '');
  href = href.replace(/\//g, '.');
  form.action = appUrl + '/' + quoteUrl(href);
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

// Included from docserialize.js:
{{ docserializeJs }}

if (! navigator.apps) {
  var script = document.createElement('script');
  script.src = {{repr(appIncludeJs)}};
  document.appendChild(script);
  // FIXME: should make sure this loads somehow
  setTimeout(function () {
    if (navigator.apps) {
      activateBookmarklet(bookmarkOptions);
    } else {
      setTimeout(arguments.callee, 500);
    }
  }, 500);
} else {
  activateBookmarklet(bookmarkOptions);
}

}(
{{if apps}}
  {apps: true}
{{elif static}}
  {uiType: {{ repr(uiType) }}, appUrl: {{ repr(appUrl) }}
  {{for name, value in options}}, {{name}}: {{ value }}{{endfor}}
  }
{{endif}});
