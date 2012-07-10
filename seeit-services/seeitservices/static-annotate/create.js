var savedData = null;

function savePage(data) {
  if (Auth.email) {
    createAnnotation(Auth.email, data);
  } else {
    savedData = data;
  }
}

function onauthready() {
  Auth.watch({
    onlogin: function (email) {
      $('#login').text('Logged in as ' + email);
      if (savedData) {
        createAnnotation(email, savedData);
      }
    },
    onlogout: function () {
      $('#login').text('You must log in: click here');
    }
  });
  $('#login').click(function () {
    navigator.id.request();
    return false;
  });
}

function createAnnotation(email, data) {
  console.log('Email:', email);
  console.log('Doc:', data.location);
  var path = './save/' + encodeURIComponent(email) + '/' +
    encodeURIComponent(encodeURIComponent(data.location));
  console.log('sending to', path);
  $.ajax({
    url: path,
    type: 'PUT',
    data: JSON.stringify(data),
    contentType: 'application/json',
    dataType: 'json',
    success: function (resp) {
      location.href = resp.location;
    },
    error: function (req, error, status) {
      console.log('Error:', status, 'Detail:', req.responseText);
      $('#error').show();
    }
  });
}
