var developBound = false;

self.port.on("Scrapers", function (scrapers) {
  var el = show('options', 'option-list');
  if (! scrapers.length) {
    el.appendChild(
      make('li', null, ['There are no pre-built options available']));
  } else {
    scrapers.forEach(function (scraper) {
      var li = make('li');
      var button = make('button', {'type': 'button'},
        [(scraper.icon ? make('img', {src: scraper.icon}) : null),
         name]);
      button.addEventListener('click', function () {
        show('processing');
        self.port.emit("ScraperChosen", scraper);
      }, false);
      var anchor = make('a', {href: '#', 'class': 'develop-script'}, 'develop');
      anchor.addEventListener('click', function () {
        self.port.emit("Develop", {js: scraper.js});
      });
      li.appendChild(anchor);
      el.appendChild(li);
    });
  }

  if (! developBound) {
    developBound = true;
    getElement('develop').addEventListener('click', function () {
      self.port.emit("Develop", null);
    }, false);
  }

});

self.port.on("Collect", function () {
  show("collecting");
});

self.port.on("Consumers", function (consumers) {
  var el = show('consumers', 'consumer-list');
  if (! consumers.length) {
    el.appendChild(make('li', null, ['No consumers!']));
    return;
  }
  consumers.forEach(function (consumer) {
    var li = make('li');
    var button = make('button', {'type': 'button'},
      [(consumer.icon ? make('img', {src: consumer.icon}) : null),
       consumer.name || consumer.url]);
    button.addEventListener('click', function () {
      show('processing');
      self.port.emit("ConsumerChosen", consumer);
    }, false);
    el.appendChild(li);
  });
});

self.port.on("ConsumerResponse", function (response) {
  var el = show("consumer-response", "consumer-response-data");
  // FIXME: dangerous:
  el.innerHTML = response;
});

self.port.on("Error", function (message) {
  var el = show("error-message", "error-message-text");
  make(el, null, [message]);
});

function show(id, inner) {
  ['processing', 'options', 'preview', 'error-message',
   'collecting', 'consumers', 'consumer-response'].forEach(function (name) {
    var el = getElement(name);
    el.style.display = 'none';
  });
  var el = null;
  if (id) {
    el = getElement(id);
    el.style.display = '';
  }
  if (inner) {
    el = getElement(inner);
    el.innerHTML = '';
  }
  return el;
}

function getElement(id) {
  var el = document.getElementById(id);
  if (! el) {
    throw 'No element by the id ' + id + ' found';
  }
  return el;
}

function make(tag, attrs, children) {
  var el;
  if (typeof tag != "string") {
    // We're clearing/replacing an existing element
    el = tag;
  } else {
    el = document.createElement(tag);
  }
  if (attrs) {
    for (var i in attrs) {
      el.setAttribute(i, attrs[i]);
    }
  }
  if (children) {
    for (var i=0; i<children.length; i++) {
      var child = children[i];
      if (child === null || child === undefined) {
        // do nothing
      } else if (typeof child == "string") {
        el.appendChild(document.createTextElement(child));
      } else {
        el.appendChild(child);
      }
    }
  }
  return el;
}
