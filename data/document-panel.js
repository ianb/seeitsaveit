self.port.on("Scrapers", function (scrapers) {
  if (! scrapers.length) {
    show('no-options');
    return;
  }
  var el = show('option-list');
  el.innerHTML = '';

  scrapers.forEach(function (scraper) {
    var li = document.createElement('li');
    if (scraper.icon) {
      var img = document.createElement('img');
      img.src = scraper.icon;
      li.appendChild(img);
    }
    var name = scraper.name || scraper.js;
    li.appendChild(document.createTextNode(name));
    li.addEventListener('click', function () {
      show('processing');
      self.port.emit("ScraperChosen", scraper);
    }, false);
    el.appendChild(li);
  });

});

self.port.on("Result", function (result) {
  var el = show("result");
  el.innerHTML = '';
  el.appendChild(document.createTextNode(JSON.stringify(result, null, '  ')));
});

self.port.on("Collect", function () {
  show("collecting");
});

self.port.on("Consumers", function (consumers) {
  var el = show('consumer-list');
  el.innerHTML = '';
  if (! consumers.length) {
    el.innerHTML = '<li>No consumers!</li>';
    return;
  }
  consumers.forEach(function (consumer) {
    var li = document.createElement('li');
    if (consumer.icon) {
      var img = consumer.createElement('img');
      img.src = consumer.icon;
      li.appendChild(img);
    }
    var name = consumer.name || consumer.url;
    li.appendChild(document.createTextNode(name));
    li.addEventListener('click', function () {
      show('processing');
      self.port.emit("ConsumerChosen", consumer);
    }, false);
    el.appendChild(li);
  });
});

self.port.on("ConsumerResponse", function (response) {
  var el = show("consumer-response");
  el.innerHTML = '';
  el.appendChild(document.createTextNode(response));
});

function show(id) {
  ['processing', 'no-options', 'option-list', 'preview', 'result',
   'collecting', 'consumer-list', 'consumer-response'].forEach(function (name) {
    var el = document.getElementById(name);
    el.style.display = 'none';
  });
  if (id) {
    var el = document.getElementById(id);
    el.style.display = '';
    return el;
  }
  return null;
}
