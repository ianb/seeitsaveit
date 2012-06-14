/*
@function scrape
@require jquery
@url-regex https?://(www\.)?facebook\.com
@name Scrape updates from Facebook
@type status-update
*/

function scrape(callback, log) {
  var els = $('.genericStreamStory');
  var result = [];
  log("Got", els.length, "items");
  els.each(function () {
    var item = {};
    result.push(item);
    var el = $(this);
    var profilePic = $("img.profilePic", el);
    //log("el", el.html(), "profile", profilePic.html);
    if (profilePic[0])
      item.profilePic = profilePic[0].src;
    var link = $('.actorName a', el);
    if (link[0])
      item.profileLink = link[0].href;
    var date = $('abbr.timestamp', el);
    item.date = date.attr('date-utime');
    var body = $('.messageBody', el);
    item.bodyHTML = body.html();
  });
  callback({
    status: result,
    type: 'status-update',
    count: 'plural'
  });
}
