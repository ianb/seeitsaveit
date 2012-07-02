var auth = {
  status: undefined,
  _onlogin: null,
  get onlogin() {
    return this._onlogin;
  },
  set onlogin(value) {
    this._onlogin = value;
    if (this._authStatus) {
      this.onlogin(this.status);
    }
  },
  logout: function () {
    if (this.status) {
      document.cookie = "auth=;path=/;";
      this.status = null;
      if (this.onlogout) {
        this.onlogout();
      }
    }
  },
  login: function () {
    navigator.id.get(function (assertion) {
      if (! assertion) {
        return;
      }
      $.ajax({
        type: 'POST',
        url: this.authApiURL,,
        data: assertion,
        success: function (resp, status, req) {
          this._setStatus();
        },
        error: function (req, status, error) {
          console.log('Got error', status, error);
        }
      });
    });
  },
  _setStatus: function () {
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
      this.status = null;
      if (this.onlogout) {
        this.onlogout();
      }
      return;
    }
    this.status = value = JSON.parse(unescape(value));
    var email = value.email;
    if (this.onlogin) {
      this.onlogin(this.status);
    }
  }
};

$(function () {
  auth._setStatus();
});
