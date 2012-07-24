function onauthready() {
  Auth.watch({
    onlogin: function (email) {
      console.log('logged in', email, !!dataToSend);
      $('#login').text(email);
      if (dataToSend) {
        send(dataToSend);
      }
      startFetch();
    },
    onlogout: function () {
      console.log('logged out');
      $('#login').text('login');
    }
  });
}
if (typeof Auth != "undefined") {
  onauthready();
}

$(function () {

  $('#login').click(function () {
    if (Auth.email) {
      Auth.logout();
    } else {
      Auth.request();
    }
  });

  $(document).on('click', '.remove', function () {
    var el = $(this);
    var id = el.attr('data-id');
    $.ajax({
      url: './data?id=' + encodeURIComponent(id),
      type: 'DELETE',
      success: function (resp) {
        $('#item-' + id).remove();
      },
      error: function (req, status, thrown) {
        console.log('Error in remove:', status);
      }
    });
    return false;
  });

  $(document).on('click', '.showhide', function () {
    $(this).closest('li.item').find('.json').toggle();
    return false;
  });

});

function startFetch() {
  var genTmpl = $('script#general-item').text();
  $.ajax({
    url: './data',
    type: 'GET',
    dataType: 'json',
    success: function (resp) {
      for (var i=0; i<resp.items.length; i++) {
        var item = resp.items[i];
        if (presentObjects.has(item)) {
          continue;
        }
        presentObjects.add(item);
        var tmpl = $('script#' + item.type).text();
        if (! tmpl) {
          tmpl = $('script#unknown').text();
        }
        var result = _.template(tmpl, {item: item});
        result = _.template(genTmpl, {item: item, detail: result});
        var el = $(result);
        $('#items').prepend(el);
      }
    },
    error: function (xhr, status, thrown) {
      $('#items').append($('<li></li>').text('Error: ' + status + ' thrown: ' + thrown));
    }
  });
}

var dataToSend = null;

function ObjectSet(ignoreAttrs) {
  if (_.isArray(ignoreAttrs)) {
    var v = {};
    _.each(ignoreAttrs, function (i) {v[i] = true;});
    ignoreAttrs = v;
  }
  this._ignoreAttrs = ignoreAttrs || {};
  this._objs = {};
}

ObjectSet.prototype = {
  add: function (obj) {
    var key = this.makeKey(obj);
    this._objs[key] = true;
  },
  remove: function (obj) {
    var key = this.makeKey(obj);
    delete this._objs[key];
  },
  has: function (obj) {
    var key = this.makeKey(obj);
    return this._objs[key];
  },
  makeKey: function (obj) {
    if (typeof obj == "function") {
      return '';
    }
    if (typeof obj != "object" || obj === null) {
      return obj + '';
    }
    if (_.isArray(obj)) {
      var s = '[';
      for (var i=0; i<obj.length; i++) {
        s += this.makeKey(obj[i]);
      }
      return s + ']';
    }
    var s = '{';
    var keys = _.keys(obj).sort();
    for (var i=0; i<keys.length; i++) {
      if (this._ignoreAttrs[keys[i]]) {
        continue;
      }
      s += keys[i] + this.makeKey(obj[keys[i]]);
    }
    return s + '}';
  }
};

var presentObjects = new ObjectSet(['captureDate', 'id']);


function send(data) {
  console.log('sending data', data);
  if (! Auth.email) {
    console.log('Delaying for login');
    dataToSend = data;
    Auth.request();
    return;
  }
  dataToSend = null;
  for (var i=0; i<data.data.length; i++) {
    var item = data.data[i];
    item.location = data.location;
    item.captureDate = data.date;
    item.type = data.type;
    item.id = jQuery.makeUUID();
  }
  $.ajax({
    url: './data',
    type: 'POST',
    contentType: 'application/json',
    data: JSON.stringify({items: data.data}),
    success: function (resp) {
      startFetch();
    }
  });
}
