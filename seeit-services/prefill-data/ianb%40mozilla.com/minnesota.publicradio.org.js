/*
@function scrape
@require jquery
@name Do Something Neat
@domain minnesota.publicradio.org
@type song
*/

function scrape(callback) {
  var date = $('.contentdiv h2:eq(0)').strip();
  var songs = $.reverse($('.songBlock').collect(function (el) {
    var item = {};
    item.artist = $.strip(el.find('h4').html().split('<')[0]);
    item.title = el.find('.songTitle').strip();
    item.playTime = el.find('.playTime').strip();
    item.date = date;
    return item;
  }));
  return {song: songs, count: 'plural'};
}
