const widgets = require("widget");
const tabs = require("tabs");
const data = require("self").data;
const Panel = require("panel").Panel;
const Request = require("request").Request;
const Page = require("page-worker").Page;
const {Cu} = require("chrome");
const { atob, btoa } = Cu.import("resource://gre/modules/Services.jsm");

var SERVER = 'http://localhost:8080';
var DEVELOP = 'http://localhost:8080/develop/';

var panel = Panel({
  contentURL: data.url("document-panel.html"),
  contentScriptFile: data.url("document-panel.js")
});

function Scrape(panel) {
  this.panel = panel;
  this.panel.port.on('ScraperChosen', this.PanelScraperChosen.bind(this));
  this.panel.port.on('ConsumerChosen', this.ConsumerChosen.bind(this));
  this.panel.port.on('Develop', this.Develop.bind(this));
  this.reset();
};

Scrape.prototype = {
  reset: function () {
    if (this.documentSerializer) {
      this.documentSerializer.destroy();
    }
    this.documentSerializer = null;
    this.document = null;
    this.scraperOptions = null;
    this.scraperChosen = null;
    this.tab = null;
    if (this.scraperWorker) {
      this.scraperWorker.destroy();
    }
    this.scraperWorker = null;
    this.result = null;
  },

  start: function (tab) {
    this.tab = tab;
    this.panel.port.emit("Collect");
    this.getScraperOptions(tab.url);
    this.serializeDocument();
  },

  serializeDocument: function () {
    this.documentSerializer = this.tab.attach({
      contentScriptFile: data.url("watcher.js")
    });
    this.documentSerializer.port.on("SerializedDocument", (function (doc) {
      this.document = doc;
      this.panel.port.emit("Document", doc);
      this.documentSerializer.destroy();
      this.documentSerializer = null;
      this.ScrapeReady();
    }).bind(this));
    this.documentSerializer.port.emit("ReceiveDocument", 1);
  },

  getScraperOptions: function (url) {
    Request({
      url: SERVER + "/query?url=" + encodeURIComponent(url),
      onComplete: (function (response) {
        if (response.status != 200) {
          console.log('Bad result: ' + response.status);
          // FIXME: show error
          this.panel.hide();
          return;
        }
        this.scraperOptions = response.json.matches;
        this.panel.port.emit("Scrapers", this.scraperOptions);
      }).bind(this)
    }).get();
  },

  PanelScraperChosen: function (scraper) {
    this.chosenScraper = scraper;
    this.ScrapeReady();
  },

  Develop: function (options) {
    console.log('Opening tab', DEVELOP);
    tabs.open({
      url: DEVELOP,
      onReady: (function (tab) {
        this.panel.hide();
        console.log('Tab ready', tab);
        var worker = tab.attach({
          contentScriptFile: data.url('develop-opener.js')
        });
        worker.port.emit("Document", this.document, options);
      }).bind(this)
    });
  },

  ScrapeReady: function () {
    if ((! this.document) || (! this.chosenScraper)) {
      return;
    }
    this.scraperWorker = Page({
      contentURL: encodeData('text/html', makePage(this.chosenScraper, this.document)),
      contentScriptFile: data.url("runner.js")
    });
    this.scraperWorker.port.on("Result", this.ScraperResult.bind(this));
    this.scraperWorker.port.emit("StartScrape", this.chosenScraper['function']);
  },

  ScraperResult: function (result) {
    this.result = result;
    var t = result.type;
    this.getConsumer(t);
    this.panel.port.emit("Result", result);
  },

  getConsumer: function (type) {
    Request({
      url: SERVER + '/query?consumer=' + encodeURIComponent(type),
      onComplete: (function (response) {
        if (response.status != 200) {
          console.log('Bad result from consumer query: ' + response.status);
          this.panel.hide();
          return;
        }
        this.consumerOptions = response.json.matches;
        this.panel.port.emit("Consumers", this.consumerOptions);
      }).bind(this)
    }).get();
  },

  ConsumerChosen: function (consumer) {
    console.log('showing consumer ' + consumer.post);
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

var scraping = new Scrape(panel);

var widget = widgets.Widget({
  id: "seeitsaveit-link",
  label: "Save It!",
  contentURL: data.url("box-download.png"),
  panel: panel,
  onClick: function() {
    scraping.reset();
    scraping.start(tabs.activeTab);
  }
});

var REQUIREMENTS = {
  jquery: "https://ajax.googleapis.com/ajax/libs/jquery/1.7.2/jquery.min.js"
};

function makePage(option, doc) {
  var head = '<base href="' + doc.location + '">';
  if (option) {
    // FIXME: quote:
    head += '<script src="' + option.js + '"></script>';
    if (option.require) {
      var requires = option.require;
      if (typeof requires == "string") {
        requires = [requires];
      }
      requires.forEach(function (requirement) {
        var src = REQUIREMENTS[requirement.toLowerCase()];
        // FIXME: signal error?
        // Allow URLs?
        if (src) {
        // FIXME: quote
          head += '<script src="' + src + '"></script>';
        }
      });
    }
  }
  head += doc.head;
  var body = doc.body;
  return '<html><head>' + head + '</head><body>' + body + '</body>';
}

function encodeData(content_type, data) {
  return 'data:' + content_type + ';base64,' + btoa(data);
}

console.log("The add-on is running.");
