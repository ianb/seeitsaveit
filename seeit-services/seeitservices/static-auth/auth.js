/*
auth.js
Author: Ian Bicking <ianb@mozilla.com>

This library wraps the navigator.id APIs from browserid.org

The exposed object is Auth.  You will usually start out with a call to Auth.watch, like:

function onauthready() {
  Auth.authUrl = '/verify';
  Auth.watch({
    onlogin: function (email, authData) {
      $('#login').text(email);
    },
    onlogout: function () {
      $('#login').text('login');
    }
  });
}

if (typeof Auth !== "undefined") {
  onauthready();
}

$('#login').click(function () {
  if (Auth.email) {
    Auth.logout();
  } else {
    Auth.request();
  }
});


The onauthready() stuff protects you from depending on a specific
order of auth.js and your script - if auth.js is included after your
script then onauthready() will be called.  If auth.js is included
before your script then Auth will be defined.  Note that
https://browserid.org/include.js still must be included before auth.js.

One of onlogout or onlogin will be run as soon as things are ready.
When a successful login happens, and is confirmed with the server, the
results will be stored locally.  On subsequent page loads this local
data will be used and a login signaled immediately.

To trigger a login call Auth.request() - this will cause a popup and
login process that might take a while and may not succeed; onlogin
will be called if it does.  To trigger a logout call Auth.logout()
(onlogout will also be called, and quickly).

The URL in authUrl is the location on the server where you verify the
authentication.  It would look something like (in pseudocode):

    def verify(request):
      assertion = request.get('assertion')
      audience = request.get('audience')
      resp = POST('https://browserid.org/verify',
                  'assertion=' + urlquote(assertion) +
                  '&audience=' + urlquote(audience))
      resp = json_decode(resp)
      if resp['status'] == 'okay':
        resp['auth'] = {'query': {'auth': sign(resp['email'])}}
      return Response(content_type='application/json', body=json_encode(resp))

This also has some integration with jQuery.  Once you've authenticated
it will change any requests using $.ajax() to use the data in auth.
With the pseudocode it would add a query string parameter
"auth=signature".  It will also try to catch 401 responses and trigger
an authentication refresh.

*/

var Auth = {
  authToken: null,
  authData: null,
  get email() {
    if (this.authData) {
      return this.authData.email;
    }
    return null;
  },
  authUrl: null,
  onlogin: function () {},
  onlogout: function () {},
  request: function () {
    navigator.id.request();
  },
  watch: function (options) {
    if (options.onlogin) {
      this.onlogin = options.onlogin;
      if (this.authData) {
        this.onlogin(this.email, this.authData);
      }
    }
    if (options.onlogout) {
      this.onlogout = options.onlogout;
      if (! this.authData) {
        this.onlogout();
      }
    }
    if (options.authUrl) {
      this.authUrl = options.authUrl;
    }
  },
  logout: function () {
    navigator.id.logout();
    this.authToken = this.authData = null;
    this.onlogout();
  }
};

if (localStorage.getItem('Auth.cachedData') && localStorage.getItem('Auth.cachedData') !== 'null') {
  Auth.authData = JSON.parse(localStorage.getItem('Auth.cachedData'));
  Auth.authData.fromCache = true;
  Auth.onlogin(Auth.email, Auth.authData);
}

// FIXME: protect against https://browserid.org/include.js being included after this script?
navigator.id.watch({
  loggedInEmail: Auth.email,
  onlogin: function (assertion) {
    var req = new XMLHttpRequest();
    req.open('POST', Auth.authUrl);
    var audience = location.protocol + "//" + location.host;
    req.onreadystatechange = function () {
      if (req.readyState != 4) {
        return;
      }
      if (req.status != 200) {
        console.log("Error in auth:", req.status);
        return;
      }
      var result = JSON.parse(req.responseText);
      if (result.status != "okay") {
        Auth.onlogout();
        return;
      }
      Auth.authData = result;
      localStorage.setItem('Auth.cachedData', JSON.stringify(Auth.authData));
      Auth.onlogin(Auth.email, Auth.authData);
    };
    req.setRequestHeader('content-type', 'application/x-www-form-urlencoded');
    req.send('assertion=' + encodeURIComponent(assertion)
             + '&audience=' + encodeURIComponent(audience));
  },
  onlogout: function () {
    Auth.authData = null;
    localStorage.removeItem('Auth.cachedData');
    Auth.onlogout();
  }
});

// FIXME: I should add a failure filter to reauthenticate on failure
if ((typeof $ !== "undefined" && $.ajax) || typeof jQuery !== "undefined") {
  (function () {
    if (typeof jQuery !== "undefined") {
      var q = jQuery;
    } else {
      var q = $;
    }

    q.ajaxPrefilter(function (options) {
      if (! Auth.authData) {
        return;
      }
      var url = options.url;
      var auth = Auth.authData.auth;
      if (auth.query) {
        for (var key in auth.query) {
          if (! auth.query.hasOwnProperty(key)) {
            continue;
          }
          if (url.indexOf('?') == -1) {
            url += '?';
          } else {
            url += '&';
          }
          url += encodeURIComponent(key) + '=' + encodeURIComponent(auth.query[key]);
          options.url = url;
        }
      }
      if (auth.headers) {
        options.headers = options.headers || {};
        for (var key in auth.headers) {
          if (! auth.headers.hasOwnProperty(key)) {
            continue;
          }
          options.headers[key] = auth.headers[key];
        }
      }
    });

    q('body').ajaxError(function (event, xhr, ajaxSettings, thrownError) {
      if (xhr && xhr.status == 401 && Auth.email) {
        Auth.request();
      }
    });
  })();
}

if (window.onauthready) {
  window.onauthready();
}
