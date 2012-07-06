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
  onsoftlogin: function () {},
  _onlogin: function () {},
  get onlogin() {
    return this._onlogin;
  },
  set onlogin(value) {
    this._onlogin = value;
    if (this.authData) {
      this._onlogin(this.email, this.authData);
    }
  },
  _onlogout: function () {},
  get onlogout() {
    return this._onlogout;
  },
  set onlogout(value) {
    this._onlogout = value;
    if (! this.authData) {
      this._onlogout();
    }
  },
  onready: function () {}
};

if (localStorage['Auth.cachedData'] && localStorage['Auth.cachedData'] !== 'null') {
  Auth.authData = JSON.parse(localStorage['Auth.cachedData']);
  Auth.authData.fromCache = true;
  Auth.onlogin(Auth.email, Auth.authData);
}

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
      }
      Auth.authData = result;
      localStorage['Auth.cachedData'] = JSON.stringify(Auth.authData);
      Auth.onlogin(Auth.email, Auth.authData);
    };
    req.setRequestHeader('content-type', 'application/x-www-form-urlencoded');
    req.send('assertion=' + encodeURIComponent(assertion)
             + '&audience=' + encodeURIComponent(audience));
  },
  onlogout: function () {
    Auth.authData = null;
    localStorage['Auth.cachedData'] = null;
    Auth.onlogout();
  },
  onready: function () {
    Auth.onready();
  },
  request: function () {
    navigator.id.request();
  }
});

if (typeof $ !== "undefined" || typeof jQuery !== "undefined") {
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
  })();
}

if (window.onauthready) {
  window.onauthready();
}
