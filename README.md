This is the SeeItSaveIt add-on.

See
[seeitsaveit.vcap.mozillalabs.com](https://seeitsaveit.vcap.mozillalabs.com)
for a more detailed end-user explanation.

This addon helps extraction scripts.  The scrapers *act on what you
are looking at*, not just the URL you are looking at.  The difference?
If you extract data from a URL you can only scrape the public and
non-personalized web, what another server will see when they ask for
the same page you are looking at.

The addon works by waiting for you to hit the extract button, then it
asks a server (as implemented trivially in `server/`) for any scrapers
that know how to scrape that URL.  It asks you which scraper you want
to use.  The whole page is then frozen and passed on to the scraping
code.  This is not like Greasemonkey or a bookmarklet, in that the
scraper never touches the live page you are looking at.

The scraper can then produce some JSON of whatever it might want to
scrape from the page.  Then you are asked where you want to send that
JSON - scraping and the consumption of the scraped content are separated.

I roughly maintain a list of ideas for enhancing this project in the
[TODO](https://github.com/ianb/seeitsaveit/blob/master/TODO.md) file.
