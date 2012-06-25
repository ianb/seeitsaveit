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

jQuery.fn.strip = function (text) {
  if (text === undefined && this.text) {
    text = this.text();
  }
  text = text.replace(/^\s*/, '').replace(/\s*$/, '');
  if (! text) {
    return null;
  }
  return text;
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
