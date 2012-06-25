const widgets = require("widget");
const tabs = require("tabs");
const data = require("self").data;
const Panel = require("panel").Panel;
const Request = require("request").Request;
const Page = require("page-worker").Page;
const { atob, btoa } = require("chrome").Cu.import("resource://gre/modules/Services.jsm");

var SERVER = 'http://localhost:8080';
var DEVELOP = 'http://localhost:8080/develop/';
var REQUIREMENTS = {
  jquery: "https://ajax.googleapis.com/ajax/libs/jquery/1.7.2/jquery.min.js"
};
var JSEEITSAVEIT = "http://localhost:8080/static/jseeitsaveit.js";
var TIMEOUT = 5000;

function Scrape(panel) {
  if (scraping) {
    scraping.shutdown();
    scraping.reset();
    scraping = null;
  }
  this.panel = panel;
  this.bound = {};
  this.bound.ScraperChosen = this.ScraperChosen.bind(this);
  this.bound.ConsumerChosen = this.ConsumerChosen.bind(this);
  this.bound.Develop = this.Develop.bind(this);
  this.panel.port.on('ScraperChosen', this.bound.ScraperChosen);
  this.panel.port.on('ConsumerChosen', this.bound.ConsumerChosen);
  this.panel.port.on('Develop', this.bound.Develop);
  this.reset();
};

Scrape.prototype = {
  shutdown: function () {
    this.panel.port.removeListener('ScraperChosen', this.bound.ScraperChosen);
    this.panel.port.removeListener('ConsumerChosen', this.bound.ConsumerChosen);
    this.panel.port.removeListener('Develop', this.bound.Develop);
    if (this.documentSerializer) {
      this.documentSerializer.destroy();
    }
    if (this.scraperWorker) {
      this.scraperWorker.destroy();
    }
  },

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
    // Just displays a progress message:
    this.panel.port.emit("Collect");
    this.getScraperOptions(tab.url);
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
      this.ScrapeReady();
    }).bind(this));
    this.documentSerializer.port.emit("ReceiveDocument");
  },

  getScraperOptions: function (url) {
    var serverUrl = SERVER + "/query?url=" + encodeURIComponent(url);
    Request({
      url: serverUrl,
      onComplete: (function (response) {
        if (response.status != 200) {
          console.log('Bad result: ' + response.status);
          this.panel.port.emit("Error", "There was an error fetching " + serverUrl + ": " + response.status);
          return;
        }
        this.scraperOptions = response.json.scrapers;
        this.allConsumers = response.json.consumers;
        console.log('Got scraper result; ' + this.scraperOptions.length + ' scrapers and ' + this.allConsumers.length + ' consumers');
        this.panel.port.emit("Scrapers", this.scraperOptions);
      }).bind(this)
    }).get();
  },

  ScraperChosen: function (scraper) {
    if (! scraper.type) {
      this.panel.port.emit("Error", "The scraper from " + scraper.js + " has no type");
      return;
    }
    this.chosenScraper = scraper;
    this.ScrapeReady();
  },

  Develop: function (options) {
    console.log('Opening tab', DEVELOP);
    tabs.open({
      url: DEVELOP,
      onReady: (function (tab) {
        if (tab.url == DEVELOP) {
          this.panel.hide();
          var worker = tab.attach({
            contentScriptFile: data.url('develop-opener.js')
          });
          worker.port.emit("Document", this.document, options);
        }
      }).bind(this)
    });
  },

  ScrapeReady: function () {
    if ((! this.document) || (! this.chosenScraper)) {
      return;
    }
    this.scraperWorker = Page({
      contentURL: encodeData('text/html', makePage(this.chosenScraper, this.document)),
      contentScriptFile: data.url("scraper-runner.js")
    });
    this.scraperWorker.port.on("Result", this.ScraperResult.bind(this));
    this.scraperWorker.port.on("ErrorResult", (function (error, stack) {
      this.panel.port.emit("Error", "Error in script: " + error + (stack ? "\n" + stack : ""));
    }).bind(this));
    this.scraperWorker.port.emit("StartScrape", this.chosenScraper['function'], TIMEOUT);
  },

  ScraperResult: function (result) {
    this.result = result;
    console.log('result', JSON.stringify(this.result), this.chosenScraper);
    this.result.type = this.chosenScraper.type;
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

var scraping = null;

var panel = Panel({
  contentURL: data.url("panel.html"),
  contentScriptFile: data.url("panel.js"),
  onHide: function () {
    if (scraping) {
      scraping.shutdown();
    }
  }
});

var widget = widgets.Widget({
  id: "seeitsaveit-link",
  label: "Save It!",
  contentURL: data.url("box-download.png"),
  panel: panel,
  onClick: function() {
    scraping = new Scrape(panel);
    scraping.start(tabs.activeTab);
  }
});

function makePage(scraper, doc) {
  var head = '<base href="' + doc.location + '">';
  if (! scraper) {
    throw 'You must pass an scraper to makePage';
  }
  // FIXME: quote:
  if (scraper.require) {
    var requires = scraper.require;
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
  // FIXME: should be a requirement:
  head += '<script src="' + JSEEITSAVEIT + '"></script>';
  head += '<script src="' + scraper.js + '"></script>';
  head += doc.head;
  var body = doc.body;
  return '<html><head>' + head + '</head><body>' + body + '</body>';
}

function encodeData(content_type, data) {
  return 'data:' + content_type + ';base64,' + btoa(data);
}

console.log("The add-on is running.");
