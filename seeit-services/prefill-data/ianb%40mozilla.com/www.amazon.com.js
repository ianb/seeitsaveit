/*
@function scrape
@require jquery
@name Get product information
@domain www.amazon.com
@type product
*/

function scrape(callback, log) {
  var item = {};
  item.name = $('#btAsinTitle').strip();
  var rating = $('.crAvgStars .swSprite').strip().split(/\s+out\s+of\s+/);
  log(JSON.stringify(rating));
  item.rating = {value: parseFloat(rating[0]), min: 1, max: 5};
  var price = $('.priceLarge').strip();
  if (price.indexOf('$') == 0) {
    item.price = {amount: price.substr(1), currency: 'USD'};
  } else {
    item.price = {amount: price};
  }
  item.inStock = !! ($('.availGreen').length);
  item.descriptionHTML = $('td.bucket.normal').clean().html();
  item.image = $('#prodImage').link();
  item.otherImages = $('.imageThumbNailHolder').collect(function (el) {
    // FIXME: Not sure where to find expanded image links
    return {thumbnail: el.find('img').link()};
  });
  return {data: [item]};
}
