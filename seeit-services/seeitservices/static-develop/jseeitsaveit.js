jQuery.fn.collect = function (callback) {
  var result = [];
  this.each(function () {
    var $this = jQuery(this);
    var item = callback($this);
    if (item) {
      result.push(item);
    }
  });
  return result;
};

jQuery.strip = jQuery.fn.strip = function (text, normalize) {
  if (normalize === undefined) {
    normalize = true;
  }
  if (text === undefined && this.text) {
    text = this.text();
  }
  text = text.replace(/^\s*/, '').replace(/\s*$/, '');
  if (normalize) {
    text = text.replace(/\s\s+/, ' ');
  }
  if (! text) {
    return null;
  }
  return text;
};

jQuery.reverse = function (list) {
  var n = [];
  for (var i=list.length-1; i>= 0; i--) {
    n.push(list[i]);
  }
  return n;
};

jQuery.fn.getlink = function () {
  if (! this.length) {
    return null;
  }
  if (this[0].src) {
    return this[0].src;
  }
  if (this[0].href) {
    return this[0].href;
  }
  return null;
};

jQuery.fn.allAttrs = function () {
  var result = {};
  this.each(function () {
    var attrs = this.attributes;
    if (attrs && attrs.length) {
      var l = attrs.length;
      for (var i=0; i<l; i++) {
        var name = attrs[i].name;
        var value = attrs[i].nodeValue;
        result[name] = value;
      }
    }
  });
  return result;
};
