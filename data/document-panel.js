var developBound = false;

self.port.on("Scrapers", function (scrapers) {
  if (! scrapers.length) {
    var el = show('options', 'option-list');
    var li = document.createElement('li');
    li.innerHTML = 'There are no pre-built options available';
    el.appendChild(li);
  } else {
    var el = show('options', 'option-list');

    scrapers.forEach(function (scraper) {
      var li = document.createElement('li');
      var button = document.createElement('button');
      button.setAttribute('type', 'button');
      li.appendChild(button);
      if (scraper.icon) {
        var img = document.createElement('img');
        img.src = scraper.icon;
        button.appendChild(img);
      }
      var name = scraper.name || scraper.js;
      button.appendChild(document.createTextNode(name));
      button.addEventListener('click', function () {
        show('processing');
        self.port.emit("ScraperChosen", scraper);
      }, false);
      el.appendChild(li);
    });
  }

  if (! developBound) {
    //developBound = true;
    getElement('develop').addEventListener('click', function () {
      self.port.emit("Develop");
    }, false);
  }

});

self.port.on("Result", function (result) {
  var el = show("result", "result-json");
  el.appendChild(document.createTextNode(JSON.stringify(result, null, '  ')));
});

self.port.on("Collect", function () {
  show("collecting");
});

self.port.on("Consumers", function (consumers) {
  var el = show('consumers', 'consumer-list');
  el.innerHTML = '';
  if (! consumers.length) {
    el.innerHTML = '<li>No consumers!</li>';
    return;
  }
  consumers.forEach(function (consumer) {
    var li = document.createElement('li');
    var button = document.createElement('button');
    button.setAttribute('type', 'button');
    li.appendChild(button);
    if (consumer.icon) {
      var img = consumer.createElement('img');
      img.src = consumer.icon;
      button.appendChild(img);
    }
    var name = consumer.name || consumer.url;
    button.appendChild(document.createTextNode(name));
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

function show(id, inner) {
  ['processing', 'options', 'preview', 'result',
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
