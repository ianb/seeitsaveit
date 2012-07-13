var dropper = document.getElementById('dropper');
var dropContainer = document.getElementById('drop-container');

dropper.addEventListener('drop', function (event) {
  console.log('Got a drop event');
  dropper.classList.remove('over');
  event.stopPropagation();
  var data = event.dataTransfer.getData('text/html');
  var tmp = document.createElement('span');
  tmp.innerHTML = data;
  var consumer = JSON.parse(tmp.childNodes[0].getAttribute('data-consumer'));
  if (! consumer) {
    return;
  }
  console.log('Event data:', JSON.stringify(consumer));
  self.port.emit('AddConsumer', consumer);
}, false);

dropper.addEventListener('dragenter', function (event) {
  dropper.classList.add('over');
}, false);

dropper.addEventListener('dragleave', function (event) {
  dropper.classList.remove('over');
}, false);

dropper.addEventListener('dragover', function (event) {
  if (event.preventDefault) {
    event.preventDefault();
  }

  event.dataTransfer.dropEffect = 'copy';
}, false);

/* FIXME: doesn't work?
document.getElementById('deleter').addEventListener('click', function (event) {
  console.log('----------------------------------------\ngot', event.target && event.target.innerHTML);
}, false); */

self.port.on("AddConsumer", function (consumer) {
  var button = document.createElement('button');
  // FIXME: doesn't work?
  //button.setAttribute('contextmenu', 'deleter');
  button.addEventListener('click', function () {
    self.port.emit("ConsumerSelected", consumer);
  });
  button.consumerUrl = consumer.url;
  if (consumer.icon) {
    var img = document.createElement('img');
    img.src = consumer.icon;
    img.style.height = '100%';
    button.appendChild(img);
  } else {
    button.appendChild(document.createTextNode(consumer.shortName || consumer.name));
  }
  var tmp = document.createElement('div');
  tmp.style.position = 'absolute';
  tmp.style.left = '-1000px';
  document.body.appendChild(tmp);
  tmp.appendChild(button);
  var width = button.scrollWidth;
  dropContainer.appendChild(button);
  document.body.removeChild(tmp);
  console.log('------------------------------------------------------------\nGOT BUTTON', dropContainer.innerHTML, width);
  self.port.emit("IncreaseWidth", width);
});

self.port.on("RemoveConsumer", function (consumer) {
  var url = consumer.url;
  var buttons = dropper.getElementsByTagName('button');
  for (var i=0; i<buttons.length; i++) {
    console.log("---CHECK", buttons[i].consumerUrl, url, buttons[i].innerHTML);
    if (buttons[i].consumerUrl == url) {
      var width = buttons[i].clientWidth;
      self.port.emit("IncreaseWidth", -width);
      buttons[i].parentNode.removeChild(buttons[i]);
      break;
    }
  }
});

self.port.emit("Ready");
