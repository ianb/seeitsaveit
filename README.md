This is the SeeItSaveIt add-on.

This addon helps setup scrapers.  The scrapers *act on what you are looking
at*, not just the URL you are looking at.  The difference?  If you scrape a
URL, you can only scrape the public and non-personalized web, what another
server will see when they ask for the same page you are looking at.

The addon works by waiting for you to hit the scraping button, then it
asks a server (as implemented trivially in `server/`) for any scrapers
that know how to scrape that URL.  It asks you which scraper you want
to use.  The whole page is then frozen and passed on to the scraping
code.  This is not like Greasemonkey or a bookmarklet, in that the
scraper never touches the live page you are looking at.

The scraper can then produce some JSON of whatever it might want to
scrape from the page.  Then you are asked where you want to send that
JSON - scraping and the consumption of the scraped content are separated.

It's rough and incomplete right now, it could probably benefit from
using [Web Activities](https://wiki.mozilla.org/WebAPI/WebActivities)
for the data dump.  I want to do good sandboxing of the scraper, so
that it can't (at least easily) leak information during the scrape.
Also I want the scraper to be able to ask for more information.  For
example, to click a link labelled "next" to receive more information
to scrape.

Ultimately I hope to separate scraper development from storage and use
of that scraped data, and allow easy discovery of scrapers (which
means the scrapers have to be somewhat safe).
