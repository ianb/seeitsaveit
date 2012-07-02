/*
@function scrape
@require jquery
@name Scrape Updates
@domain www.facebook.com
@type status
*/

function scrape(callback, log) {
  var els = $('.genericStreamStory');
  log("Got", els.length, "items");
  var result = els.collect(function (el) {
    var item = {};
    item.profilePic = el.find("img.profilePic").getlink();
    item.profileLink = el.find('.actorName a').getlink();
    var date = el.find('abbr.timestamp', el).attr('date-utime');
    item.body = el.find('.messageBody').html();
    return item;
  });
  callback({
    status: result,
    count: 'plural'
  });
}
