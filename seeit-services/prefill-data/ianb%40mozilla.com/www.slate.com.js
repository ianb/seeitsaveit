/*
@function scrape
@require jquery
@name Extract article
@domain www.slate.com
@type article
*/

function scrape(callback) {
  var item = {};
  item.title = $('.slb-post-title').strip();
  item.author = $('.slb-post-byline').strip().replace(/^by\s+/i, '');
  item.pubdate = $('.slb-post-date').strip();
  item.contentHTML = $('.body.parsys').clean().html();
  return {data: [item]};
}
