var ArticleList = {
  articles: {},
  dirtyDeleted: {},

  onadd: function () {},
  onremove: function () {},

  addArticle: function (article, noSave) {
    if (! article.url) {
      console.warn('bad article', article);
      throw 'Bad article, no url';
    }
    this.articles[article.url] = article;
    this.onadd(article);
    if (! noSave) this.save();
  },

  removeArticle: function (article, noSave) {
    if (typeof article == "string") {
      var url = article;
    } else {
      var url = article.url;
    }
    if (! url) {
      console.warn('bad article', article);
      throw 'Bad article, no url';
    }
    if (this.articles.hasOwnProperty(url)) {
      delete this.articles[url];
      this.dirtyDeleted[url] = true;
    }
    this.onremove(url);
    if (! noSave) this.save();
  },

  save: function () {
    localStorage.setItem('ArticleList', JSON.stringify(this.articles));
    localStorage.setItem('ArticleList.dirtyDeleted', JSON.stringify(this.dirtyDeleted));
  },

  load: function () {
    var data = localStorage.getItem('ArticleList');
    if (data == "null" || ! data) {
      data = {};
    } else {
      data = JSON.parse(data);
      if (typeof data != "object") {
        data = {};
      }
    }
    this.articles = data;
    data = localStorage.getItem('ArticleList.dirtyDeleted');
    if (data == "null" || ! data) {
      data = {};
    } else {
      data = JSON.parse(data);
      if (typeof data != "object") {
        data = {};
      }
    }
    this.dirtyDeleted = data;
  },

  /****************************************
   Functions for Sync/appData
   */

  getPendingObjects: function (callback) {
    var result = [];
    _.each(this.articles, function (article) {
      if (! article.saved) {
        result.push({id: article.url, type: 'article', data: article});
      }
    }, this);
    _.each(this.dirtyDeleted, function (url) {
      result.push({id: url, type: 'article', deleted: true});
    }, this);
    callback(null, result);
  },

  objectsSaved: function (objects, callback) {
    var errors = [];
    _.each(objects, function (object) {
      if (object.deleted) {
        if (! (object.id in this.dirtyDeleted)) {
          errors.push('Got unexpected delete: ' + object.id);
        } else {
          delete this.dirtyDeleted[object.id];
        }
      } else {
        var article = this.articles[object.id];
        if (! article) {
          errors.push('Saved article not found: ' + object.id);
        } else if (article.saved) {
          errors.push('Resaved article unexpected: ' + object.id);
        } else {
          article.saved = true;
        }
      }
    }, this);
    this.save();
    if (! errors.length) {
      errors = null;
    }
    if (callback) callback(errors);
  },

  objectsReceived: function (objects, callback) {
    _.each(objects, function (object) {
      if (object.deleted) {
        if (this.dirtyDeleted[object.id]) {
          // We agree it should be deleted
          delete this.dirtyDeleted[object.id];
        } else {
          this.removeArticle(object.id, true);
        }
      } else {
        var article = object.data;
        if (this.dirtyDeleted[object.id]) {
          // Huh, re-saved... not sure what best to do here
          delete this.dirtyDeleted[object.id];
        }
        article.saved = true;
        this.addArticle(article, true);
      }
    }, this);
    this.save();
    if (callback) callback();
  },

  resetSaved: function () {
    _.each(this.articles, function (article) {
      delete article.saved;
    }, this);
    // FIXME: not sure if I should do anything about dirtyDeleted?
  },

  reportObjectErrors: function (errors) {
    console.log('Object errors:', errors);
  },

  status: function (message) {
  }

};

ArticleList.load();

var scheduler, authenticator;

$(function () {
  $('#login').click(function () {
    if (authenticator.email) {
      authenticator.logout();
    } else {
      authenticator.request();
    }
  });
  ArticleList.onadd = function (article) {
    var id = makeId(article.url);
    var tmpl = $('#article-template').text();
    var result = _.template(tmpl, {article: article, id: id});
    var el = $('<li></li>').html(result);
    $('#articles').append(el);
  };
  ArticleList.onremove = function (url) {
    var id = makeId(url);
    var el = $('#' + id);
    el.closest('li').remove();
  };

  scheduler = Sync.assemble({
    appData: ArticleList
  });

  authenticator = scheduler.authenticator;

  scheduler.authenticator.watch({
    onlogin: function (email) {
      $('#login').text(email);
    },
    onlogout: function () {
      $('#login').text('Login');
    }
  });

});

$(document).on("click", ".remove", function () {
  var id = $(this).closest('.article').attr('id');
  $(this).closest('li').remove();
  ArticleList.removeArticle(id);
});

function makeId(url) {
  url = url.replace(/^https?:\/\//i, '');
  url = url.replace(/\//, '_');
  url = url.replace(/[^a-zA-Z0-9_-]/, '');
  return url;
}

function send(data) {
  console.log('sending data', data);
  data.data.forEach(function (item) {
    item.url = item.location || data.location;
    ArticleList.addArticle(item, true);
  });
  ArticleList.save();
}
