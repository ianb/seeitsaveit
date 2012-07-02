## Addon

* Reverse the order of everything!  All that matters to the user is who they want to send data to (with the possible addition that some services might have multiple facets; but we'll just think of those as multiple services, though a simple brand is not sufficient).  Then we simply need to find the "best" extractor given the kind of data that is implied by the consumer.  Potentially we could run multiple extractors and compare.

* Let consumers accept postMessage, where a page is opened and the extracted data is sent via postMessage to that page.

* Fix all FIXMEs

* Create a way to handle pagination, so an extractor can get data from paginated results.  Maybe pagination will be a separate function, and the extractor will get multiple pages?  Or maybe the extractor can ask to do pagination.

  - Add IDs to all elements during extraction, so the extractor can talk back about specific elements.  E.g., say "I want the content from the pages linked to by these elements: [...]"

  - An analog to pagination is spidering in general.

* Make all data plural; singular data will just be a list with a single item.  Consumers must handle selection of a single item if they require that.

* Clarify the extracted data format.  Allow more than one kind of data to be included in an extraction?  Add date to the format, maybe add a hash of the source page (after serialization), add presence of cookies.  (Note: use case for more than one data type: article and html-page)

* Work to sandbox extractors more.  Create tests that try to break the sandboxing.

* Allow images to be turned into `data:` URLs: https://gist.github.com/958841

* Combine the selection of the extractor with the selection of the consumer

* When Web Activities or Web Intents are ready, use them in lieu of the consumer selection (or use some private API to still combine the choice)

* Create a bloom filter for all available extractors, keyed on domain, so you can do efficient client testing of whether an extractor is available for the domain you are on. (https://github.com/jasondavies/bloomfilter.js - translate to Python?)

* Show via the download button that an extractor is available

* Allow you to hide some extractors or consumers

* Allow you to favorite an extractor or consumer

* Allow dragging an extractor/consumer set to a separate button

* Let the consumer open a new URL automatically when a POST submission comes in.

* Add wildcards to the domain matchers

* Do URL matching on the client (domain matching only on the server)

* Consider validation of data types

* Consider scrubbing the extracted data to see if there are URLs that are not present in the source page (which could be a form of data leaking)

* Filter `<meta>` tags better in the staticHTML code.  `<meta charset>` for instance is not applicable, as the data is all unicode and separated from any transport.

* Let consumer signal an error with the incoming data (report to repository?)

* Make develop location configurable (separately)

* Can panels be sticky?

* Instead of sending the data immediately to a consumer, allow for sending to an intermediary rendering page and then on to a consumer. This requires some more formal data type definition that includes a way to render such data.

* Move the extractor button into the URL bar?

* The extractor's `<script>` element shouldn't be present in the page. Maybe we can add and remove the tag?


## Data Types

Some data types I'd like to define more formally:

* html-page (complete page)

* article (structured page, with HTML body)

* music (song/artist/album/etc)

* academic-article (article, extended with some more formal academic information)

* product (something you can buy)


## Examples

* Create space to document different data types.

* Create an extractor that works for any site, that produces "html-page" (basically just echos the complete page)

* Create an extractor that produces "article", which is an extracted form of the article.  Combined with "html-page" this would be a good read-later form.  (Or read-later could simply be a form.)  Article could be a domain=* setup, or custom extractors for specific sites (which seems to be necessary in some cases).

* Create a read-later consumer

* Create a annotation consumer

* Create a music list consumer: accepts a list of music, lets user select which items they want, and assembles a list based on that

* Shopping comparison


## Repository

* The repository should support some kind of review process

* Create MySQL storage backend (for Petri)

* Allow pages to be reported to extractor authors

* Add necessary CORS headers to allow external in-browser dev environments


## Develop

* Add an HTML stripper to jseeitsaveit, to strip HTML down to its more semantic base (i.e., removing classes and the like).

* Add HTML serialization (i.e., staticHTML) to jseeitsaveit.

* Make @require work properly in development

* Fix return values in extractor development

* Allow user to browse their extractors

* Let users save "sample pages" to go with their extractor, to let them come back to work later

* Make the onclick element browser a little more visually appealing. Combine that with the selector browser?

* Maybe use stacked collapsable items as a way of organizing the page

* Use ACE for the editor

* Allow extracted data to be sent right to a consumer, for full-stack test

* Version the extractors

* Allow the extractor in development to be pulled from (and committed to) github?  Maybe generally allow "remote" extractors (which is easy except for saving those extractors).

* Keep track of the saved state (i.e., has it been edited since saved?)

* Make some portions of the page resizable

* Set page title dynamically

* Use the full width of the page
