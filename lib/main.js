const { Widget } = require("widget");
const tabs = require("tabs");
const data = require("self").data;
const { Panel } = require("panel");
const { Request } = require("request");
const { Page } = require("page-worker");
const { atob, btoa } = require("chrome").Cu.import("resource://gre/modules/Services.jsm");
const { htmlQuote, encodeData } = require("quoting");
const simplePrefs = require('simple-prefs');
const ss = require("simple-storage");
const { StartupPanel } = require("./startup-panel");

var URLs = {
  SERVER: 'http://localhost:8080',
  DEVELOP: 'http://localhost:8080/develop/',
  JSEEITSAVEIT: "http://localhost:8080/develop/jseeitsaveit.js",
  template: {
    SERVER: 'URL',
    DEVELOP: 'URL/develop/',
    JSEEITSAVEIT: 'URL/develop/jseeitsaveit.js'
  }
};

var TIMEOUT = 5000;
var REQUIREMENTS = {
  jquery: "https://ajax.googleapis.com/ajax/libs/jquery/1.7.2/jquery.min.js"
};

simplePrefs.on("serverBase", serverBaseChanged);

function serverBaseChanged() {
  var url = simplePrefs.prefs.serverBase;
  url = url.replace(/\/+$/, '');
  console.log('set serverBase', url);
  for (var i in URLs.template) {
    var tmpl = URLs.template[i];
    tmpl = tmpl.replace(/URL/g, url);
    URLs[i] = tmpl;
  }
}

serverBaseChanged();

StartupPanel({
  name: "SeeItSaveIt",
  contentURL: data.url("startup-help.html")
});

function Extraction(panel) {
  if (currentExtraction) {
    currentExtraction.shutdown();
    currentExtraction.reset();
    currentExtraction = null;
  }
  this.panel = panel;
  // FIXME: I should just prebind these methods directly
  this.bound = {};
  this.bound.ExtractorChosen = this.ExtractorChosen.bind(this);
  this.bound.ConsumerChosen = this.ConsumerChosen.bind(this);
  this.bound.Develop = this.Develop.bind(this);
  this.panel.port.on('ExtractorChosen', this.bound.ExtractorChosen);
  this.panel.port.on('ConsumerChosen', this.bound.ConsumerChosen);
  this.panel.port.on('Develop', this.bound.Develop);
  this.reset();
};

Extraction.prototype = {
  shutdown: function () {
    this.panel.port.removeListener('ExtractorChosen', this.bound.ExtractorChosen);
    this.panel.port.removeListener('ConsumerChosen', this.bound.ConsumerChosen);
    this.panel.port.removeListener('Develop', this.bound.Develop);
    if (this.documentSerializer) {
      this.documentSerializer.destroy();
    }
    if (this.extractorWorker) {
      this.extractorWorker.destroy();
    }
  },

  reset: function () {
    if (this.documentSerializer) {
      this.documentSerializer.destroy();
    }
    this.documentSerializer = null;
    this.document = null;
    this.extractorOptions = null;
    this.extractorChosen = null;
    this.tab = null;
    if (this.extractorWorker) {
      this.extractorWorker.destroy();
    }
    this.extractorWorker = null;
    this.result = null;
  },

  start: function (tab) {
    this.tab = tab;
    // Just displays a progress message:
    this.panel.port.emit("Collect");
    this.getExtractorOptions(tab.url);
    this.serializeDocument();
  },

  serializeDocument: function () {
    this.documentSerializer = this.tab.attach({
      contentScriptFile: data.url("make-static-html.js")
    });
    this.documentSerializer.port.on("SerializedDocument", (function (doc) {
      this.document = doc;
      this.panel.port.emit("Document", doc);
      this.documentSerializer.destroy();
      this.documentSerializer = null;
      this.ExtractorInputReady();
    }).bind(this));
    this.documentSerializer.port.emit("ReceiveDocument");
  },

  getExtractorOptions: function (url) {
    var serverUrl = URLs.SERVER + "/query?url=" + encodeURIComponent(url);
    Request({
      url: serverUrl,
      onComplete: (function (response) {
        if (response.status != 200) {
          console.log('Bad result: ' + response.status);
          this.panel.port.emit("Error", "There was an error fetching " + serverUrl + ": " + response.status);
          return;
        }
        this.extractorOptions = response.json.extractors;
        if (typeof this.extractorOptions != 'object') {
          console.log('Error; extractors is not a list:', response.json);
          throw 'Error: extractors is not a list';
        }
        this.allConsumers = response.json.consumers;
        console.log('Got extractor options; ' + this.extractorOptions.length + ' extractors and ' + this.allConsumers.length + ' consumers');
        this.panel.port.emit("Consumers", this.allConsumers, this.extractorOptions);
        if (this.consumerChosen) {
          this.ConsumerChosen(this.consumerChosen);
        }
        //this.panel.port.emit("Extractors", this.extractorOptions);
      }).bind(this)
    }).get();
  },

  ExtractorChosen: function (extractor) {
    if (! extractor.type) {
      this.panel.port.emit("Error", "The extractor from " + extractor.js + " has no type");
      return;
    }
    this.extractorChosen = extractor;
    this.ExtractorInputReady();
  },

  Develop: function (options) {
    console.log('Opening tab', URLs.DEVELOP);
    tabs.open({
      url: URLs.DEVELOP,
      onReady: (function (tab) {
        var tabUrl = tab.url;
        if (tabUrl.indexOf('#') != -1) {
          tabUrl = tabUrl.substr(0, tabUrl.indexOf('#'));
        }
        if (tabUrl == URLs.DEVELOP) {
          this.panel.hide();
          var worker = tab.attach({
            contentScriptFile: data.url('develop-opener.js')
          });
          worker.port.emit("Document", this.document, options);
        } else {
          console.log('Not the tab I was looking for: ' + tabUrl);
        }
      }).bind(this)
    });
  },

  ExtractorInputReady: function () {
    if ((! this.document) || (! this.extractorChosen)) {
      return;
    }
    this.extractorWorker = Page({
      contentURL: encodeData('text/html', makePage(this.extractorChosen, this.document)),
      contentScriptFile: data.url("extractor-runner.js")
    });
    this.extractorWorker.port.on("Result", this.ExtractorData.bind(this));
    this.extractorWorker.port.on("ErrorResult", (function (error, stack) {
      this.panel.port.emit("Error", "Error in script: " + error + (stack ? "\n" + stack : ""));
    }).bind(this));
    this.extractorWorker.port.emit("StartExtraction", this.extractorChosen['function'], TIMEOUT);
  },

  ExtractorData: function (result) {
    this.result = result;
    console.log('result', JSON.stringify(this.result), this.extractorChosen);
    this.result.type = this.extractorChosen.type;
    this.result.location = this.document.location;
    this.result.date = Date.now();
    this.ConsumerInputReady();
  },

  /*getConsumer: function () {
    var goodConsumers = [];
    var matchType = this.result.type;
    this.allConsumers.forEach(function (consumer) {
      if (consumer.types.indexOf(matchType) != -1) {
        goodConsumers.push(consumer);
      }
    });
    this.panel.port.emit("Consumers", goodConsumers, this.result.type);
  }, */

  ConsumerChosen: function (consumer) {
    this.consumerChosen = consumer;
    var extractors = [];
    this.extractorOptions.forEach(function (item) {
      if (consumer.types.indexOf(item.type) != -1) {
        extractors.push(item);
      }
    });
    if (! extractors.length) {
      throw 'No extractors found for types ' + consumer.types;
    }
    var extractor = null;
    if (extractors.length == 1) {
      // easy!
      extractor = extractors[0];
    } else {
      extractors.forEach(function (item) {
        if (extractor === null) {
          extractor = item;
          return;
        }
        if (contains(extractor.domains, '*') && ! contains(item.domains, '*')) {
          extractor = item;
        }
      });
      // Other ways of selecting the extractor would be useful
    }
    this.extractorChosen = extractor;
    this.ExtractorInputReady();
  },

  ConsumerInputReady: function () {
    var consumer = this.consumerChosen;
    if (consumer.post) {
      console.log('showing consumer ' + consumer.post + ' data ' + JSON.stringify(this.result));
      Request({
        url: consumer.post,
        content: JSON.stringify(this.result),
        contentType: 'application/json',
        onComplete: (function (response) {
          this.panel.port.emit("ConsumerResponse", response.text);
        }).bind(this)
      }).post();
    } else if (consumer.sendToPage) {
      console.log('showing consumer page ' + consumer.sendToPage);
      tabs.open({
        url: consumer.sendToPage,
        onReady: (function (tab) {
          var tabUrl = tab.url;
          if (tabUrl.indexOf('#') != -1) {
            tabUrl = tabUrl.substr(0, tabUrl.indexOf("#"));
          }
          if (tabUrl != consumer.sendToPage) {
            // FIXME: this will happen regularly, but really we want to just stop the onReady event
            console.log('Not the consumer tab that gets data:', tabUrl);
            return;
          }
          this.panel.hide();
          var worker = tab.attach({
            contentScriptFile: data.url('send-to-page-opener.js')
          });
          worker.port.emit("Document", this.result, consumer);
        }).bind(this)
      });
    }
  }

};

var currentExtraction = null;

var panel = Panel({
  contentURL: data.url("panel.html"),
  contentScriptFile: data.url("panel.js"),
  onHide: function () {
    if (currentExtraction) {
      currentExtraction.shutdown();
      currentExtraction = null;
      console.log('========================================');
    }
  }
});

var dropper = Widget({
  id: "seeitsaveit-dropper",
  label: "Save It Items!",
  contentURL: data.url("dropper.html"),
  contentScriptFile: data.url("dropper.js"),
  width: 40
});

dropper.port.on("AddConsumer", function (consumer) {
  var consumers = ss.storage.consumers || [];
  var remove = -1;
  consumers.forEach(function (item, index) {
    if (item.url == consumer.url) {
      remove = index;
    }
  });
  if (remove != -1) {
    consumers.splice(remove, 1);
    dropper.port.emit("RemoveConsumer", consumer);
  } else {
    consumers.push(consumer);
    addDropperConsumer(consumer);
  }
  ss.storage.consumers = consumers;
});

dropper.port.on("Ready", function () {
  var consumers = ss.storage.consumers || [];
  consumers.forEach(function (consumer) {
    addDropperConsumer(consumer);
  });
});

dropper.port.on("IncreaseWidth", function (amount) {
  dropper.width += amount;
});

dropper.port.on("ConsumerSelected", function (consumer) {
  console.log('----------------------------------------');
  console.log('Consumer button clicked');
  currentExtraction = new Extraction(panel);
  currentExtraction.consumerChosen = consumer;
  currentExtraction.start(tabs.activeTab);
  //panel.show();
});

function addDropperConsumer(consumer) {
  dropper.port.emit("AddConsumer", consumer);
}

var widget = Widget({
  id: "seeitsaveit-link",
  label: "Save It!",
  contentURL: data.url("box-download.png"),
  panel: panel,
  onClick: function() {
    console.log('----------------------------------------');
    currentExtraction = new Extraction(panel);
    currentExtraction.start(tabs.activeTab);
  }
});

function makePage(extractor, doc) {
  var head = '<base href="' + doc.location + '">';
  if (! extractor) {
    throw 'You must pass an extractor to makePage';
  }
  // FIXME: quote:
  if (extractor.require) {
    var requires = extractor.require;
    if (typeof requires == "string") {
      requires = [requires];
    }
    requires.forEach(function (requirement) {
      var src = REQUIREMENTS[requirement.toLowerCase()];
      // FIXME: signal error?
      // Allow URLs?
      if (src) {
        head += '<script src="' + htmlQuote(src) + '"></script>';
      }
    });
  }
  // FIXME: should be a requirement:
  head += '<script src="' + htmlQuote(URLs.JSEEITSAVEIT) + '"></script>';
  head += '<script src="' + htmlQuote(extractor.js) + '"></script>';
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

function getList(value) {
  if (! value) {
    return [];
  }
  if (typeof value == 'string') {
    value = [value];
  }
  return value;
}

function contains(seq, value) {
  return getList(seq).indexOf(value) != -1;
}
