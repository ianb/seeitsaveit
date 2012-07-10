/*
@function scrape
@require jquery
@name Extract entire page
@domain *
@type html
*/

function scrape(callback, log) {
  $('script').remove();
  var count = 1;
  $("body *").each(function () {
    if (! this.id) {
      this.id = 'el-' + (count++);
    }
  });
  var item = {};
  item.head = $('head').html();
  item.body = $('body').html();
  item.bodyAttrs = $('body').allAttrs();
  item.title = $('title').strip();
  callback({data: item});
}