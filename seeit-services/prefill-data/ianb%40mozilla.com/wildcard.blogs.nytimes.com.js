/*
@function scrape
@require jquery
@name Get article content
@domain .blogs.nytimes.com
@type article
*/

function scrape(callback) {
  var item = {};
  item.title = $('.entry-title').strip();
  item.pubdate = $('span.date:first').strip();
  item.contentHTML = $('.entry-content').clean().html();
  var author = $('#header img').attr('alt');
  item.author = author.split(/\s+-\s+/)[0];
  return {data: [item]};
}
