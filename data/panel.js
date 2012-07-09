var developBound = false;

self.port.on("Extractors", function (extractors) {
  var el = show('options', 'option-list');
  if (! extractors.length) {
    el.appendChild(
      make('li', null, ['There are no pre-built options available']));
  } else {
    extractors.forEach(function (extractor) {
      var li = make('li');
      var button = make('button', {'type': 'button'},
        [(extractor.icon ? make('img', {src: extractor.icon}) : null),
         extractor.name]);
      button.addEventListener('click', function () {
        show('processing');
        self.port.emit("ExtractorChosen", extractor);
      }, false);
      var anchor = make('a', {href: '#', 'class': 'develop-script'}, 'develop');
      anchor.addEventListener('click', function () {
        self.port.emit("Develop", {js: extractor.js});
      });
      li.appendChild(button);
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

self.port.on("Consumers", function (consumers, extractors) {
  var el = show('consumers', 'consumer-list');
  var detail = getElement('consumer-detail');
  detail.style.display = 'none';
  if (! consumers.length) {
    el.appendChild(make('li', null, ['No consumers available']));
  }
  consumers.forEach(function (consumer) {
    var button = make('button', {'type': 'button'},
      [(consumer.icon ? make('img', {src: consumer.icon}) : null),
       consumer.name || consumer.url]);
    button.addEventListener('click', function () {
      show('processing');
      self.port.emit("ConsumerChosen", consumer);
    }, false);
    var li = make('li', null, [button, ' ']);
    var anchor = make('a', {href: '#'}, ['about']);
    anchor.addEventListener('click', function () {
      detail.style.display = '';
      detail.innerHTML = 'Details:';
      var detailUl = make('ul');
      detail.appendChild(detailUl);
      extractors.forEach(function (extractor) {
        if (consumer.types.indexOf(extractor.type) != -1) {
          var link = make('a', {href: extractor.js, title: extractor.js, target: '_blank'}, [extractor.js.replace(/.*\//, '')]);
          var develop = make('a', {href: '#'}, ['develop']);
          develop.addEventListener('click', function () {
            self.port.emit("Develop", {js: extractor.js});
          }, false);
          var detailLi = make('li', null, [link, ' ', develop]);
          detailUl.appendChild(detailLi);
        }
      });
    });
    li.appendChild(anchor);
    el.appendChild(li);
  });
  var developNew = make('a', {href: '#'}, ['make something new...']);
  developNew.addEventListener('click', function () {
    self.port.emit("Develop");
  }, false);
  el.appendChild(developNew);
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
        continue;
      } else if (typeof child == "string") {
        el.appendChild(document.createTextNode(child));
      } else {
        el.appendChild(child);
      }
    }
  }
  return el;
}
