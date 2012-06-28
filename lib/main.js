const widgets = require("widget");
const tabs = require("tabs");
const data = require("self").data;
const Panel = require("panel").Panel;
const Request = require("request").Request;
const Page = require("page-worker").Page;
const { atob, btoa } = require("chrome").Cu.import("resource://gre/modules/Services.jsm");
const { htmlQuote, encodeData } = require("quoting");
const simplePrefs = require('simple-prefs');

var URLs = {
  SERVER: 'http://localhost:8080',
  DEVELOP: 'http://localhost:8080/develop/',
  JSEEITSAVEIT: "http://localhost:8080/static/jseeitsaveit.js",
  template: {
    SERVER: 'URL',
    DEVELOP: 'URL/develop/',
    JSEEITSAVEIT: 'URL/static/jseeitsaveit.js'
  }
};

var TIMEOUT = 5000;
var REQUIREMENTS = {
  jquery: "https://ajax.googleapis.com/ajax/libs/jquery/1.7.2/jquery.min.js"
};

simplePrefs.on("serverBase", serverBaseChanged);

function serverBaseChanged() {
  var url = simplePrefs.prefs.serverBase;
  console.log('set serverBase', url);
  for (var i in URLs.template) {
    var tmpl = URLs.template[i];
    tmpl = tmpl.replace(/URL/g, url);
    URLs[i] = tmpl;
  }
}

serverBaseChanged();

function Extraction(panel) {
  if (currentExtraction) {
    currentExtraction.shutdown();
    currentExtraction.reset();
    currentExtraction = null;
  }
  this.panel = panel;
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
        this.allConsumers = response.json.consumers;
        console.log('Got extractor options; ' + this.extractorOptions.length + ' extractors and ' + this.allConsumers.length + ' consumers');
        this.panel.port.emit("Extractors", this.extractorOptions);
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
        if (tab.url == URLs.DEVELOP) {
          this.panel.hide();
          var worker = tab.attach({
            contentScriptFile: data.url('develop-opener.js')
          });
          worker.port.emit("Document", this.document, options);
        } else {
          console.log('Not the tab I was looking for: ' + tab.url);
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
      contentScriptFile: data.url("scraper-runner.js")
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
    this.getConsumer();
  },

  getConsumer: function () {
    var goodConsumers = [];
    var matchType = this.result.type;
    this.allConsumers.forEach(function (consumer) {
      if (consumer.types.indexOf(matchType) != -1) {
        goodConsumers.push(consumer);
      }
    });
    this.panel.port.emit("Consumers", goodConsumers, this.result.type);
  },

  ConsumerChosen: function (consumer) {
    console.log('showing consumer ' + consumer.post + ' data ' + JSON.stringify(this.result));
    Request({
      url: consumer.post,
      content: JSON.stringify(this.result),
      contentType: 'application/json',
      onComplete: (function (response) {
        this.panel.port.emit("ConsumerResponse", response.text);
      }).bind(this)
    }).post();
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

var widget = widgets.Widget({
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
