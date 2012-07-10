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
  onready: function () {},
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
  },
  onready: function () {
    Auth.onready();
  }
});

// FIXME: I should add a failure filter to reauthenticate on failure
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

    q('body').ajaxError(function (event, xhr, ajaxSettings, thrownError) {
      if (xhr && xhr.status == 401) {
        Auth.logout();
      }
    });
  })();
}

if (window.onauthready) {
  window.onauthready();
}
