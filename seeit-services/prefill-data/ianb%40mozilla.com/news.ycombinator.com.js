/*
@function scrape
@require jquery
@name Do Something Neat
@domain news.ycombinator.com
@type news-items
*/

function scrape(callback, log) {
  var els = $('td.title');
  log('got', els.length, 'elements');
  var result = els.collect(function (el) {
    log('got element', el[0].elId);
    var item = {};
    item.title = el.find('a').strip();
    if (! item.title) {
      return;
    }
    item.link = el.find('a').getlink();
    var sub = el.parent('tr').next('tr').find('td.subtext');
    log('subitems', sub.length);
    item.score = sub.find('span[id^=score]').strip();
    if (item.score) {
      item.score = parseInt(item.score.split()[0], 10);
    }
    item.author = sub.find('a:first').strip();
    item.authorLink = sub.find('a:first').getlink();
    item.commentLink = sub.find('a[href*="item?id"]').getlink();
    return item;
  });
  callback({data: result});
}