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
    item.name = el.find('.actorName').strip();
    item.date = el.find('abbr.timestamp', el).attr('date-utime') || null;
    item.body = el.find('.messageBody').clean().html();
    var a = el.find('.uiStreamAttachments');
    if (a.length) {
      item.attachments = el.collect(function (attachment) {
        var a = {};
        a.image = attachment.find('img.shareMediaPhoto').getlink();
        if (a.image && /\.gif$/.test(a.image)) {
          var img = attachment.find('img.shareMediaPhoto');
          img = img.backgroundImage();
          if (img) {
            img = $.parseURL(img).params.url || img;
          }
          a.image = img || a.image;
        }
        a.link = attachment.find('a.shareMediaLink').getlink();
        a.title = attachment.find('.uiAttachmentTitle').strip();
        a.summary = attachment.find('.uiAttachmentDesc').strip();
        if (! $.emptyObject(a)) {
          return a;
        }
      });
    }
    return item;
  });
  callback({data: result});
}
