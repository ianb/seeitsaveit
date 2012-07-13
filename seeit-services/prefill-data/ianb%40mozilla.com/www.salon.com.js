/*
@function scrape
@require jquery
@name Extract article text
@domain www.salon.com
@type article
*/

function scrape(callback, log) {
  var item = {};
  item.pubdate = $('.toLocalTime').strip();
  item.title = $('.articleInner h1').strip();
  item.author = $('.byline a[rel=author]:first').text();
  item.authorURL = $('.byline a[rel=author]:first').link();
  item.summary = $('.articleInner h2').strip();
  item.contentHTML = $('.articleContent').clean().html();
  return {data: [item]};
}
