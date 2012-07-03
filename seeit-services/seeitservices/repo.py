#!/usr/bin/env python
import os
import urlparse
import urllib
import re
from webob.dec import wsgify
from webob import exc
from webob import Response, Request
from seeitservices.util import json, JsonFile, ServeStatic
from statusstorage import StatusStorage


def parse_metadata(script, url):
    header = script.split('*/', 1)[0]
    functions = []
    last_property = None
    for line in header.splitlines():
        if not line.strip():
            last_property = None
            continue
        if line.strip().startswith('@'):
            parts = line.strip().split(None, 1)
            if len(parts) != 2:
                raise ValueError("Bad line, no property value: %r" % line)
            name = parts[0].strip('@').lower()
            value = parts[1]
            if name == 'function':
                functions.append({'js': url})
            elif not functions:
                raise ValueError("Bad line, first property must be @function: %r" % line)
            functions[-1][name] = value
            last_property = name
        elif last_property:
            functions[1][last_property] += '\n' + line.rstrip()
    if not functions:
        raise ValueError("No @function defined")
    for item in functions:
        cleanup(item, url)
    return functions


def cleanup(item, url):
    make_list(item, 'url')
    make_list(item, 'url-regex')
    make_list(item, 'require')
    map_reassign(item, 'require', make_url(url, ['jquery']))
    map_reassign(item, 'output-template', make_url(url))


def make_list(item, name):
    if item.get(name) and isinstance(item[name], basestring):
        item[name] = [item[name]]


def map_reassign(item, name, mapper):
    if not item.get(name):
        return
    if isinstance(item[name], list):
        new = []
        for value in item[name]:
            new.append(mapper(value))
        item[name] = new
    else:
        item[name] = mapper(item[name])


def make_url(url, except_values=None):
    def mapper(value):
        if except_values and value in except_values:
            return value
        return urlparse.urljoin(url, value)
    return mapper


class Application(object):

    def __init__(self, dir):
        self.dir = dir
        if not os.path.exists(dir):
            os.makedirs(dir)
        self.transformer_fn = os.path.join(dir, 'transformers.json')
        self.consumers_fn = os.path.join(dir, 'consumers.json')
        self.directory_app = ServeStatic(__name__, 'static-repo')
        self.status_capture = StatusStorage(os.path.join(dir, 'status'))

    @wsgify
    def __call__(self, req):
        ## Hack for Petri
        if req.headers.get('X-SSL', '').lower() == 'on':
            req.scheme = 'https'
        if req.path_info == '/auth':
            return self.auth(req)
        self.annotate_auth(req)
        if req.path_info == '/query':
            return self.query(req)
        if req.path_info == '/':
            return self.homepage(req)
        if req.path_info == '/register':
            return self.register(req)
        if req.path_info == '/register-consumer':
            return self.register_consumer(req)
        if req.path_info_peek() == 'static':
            req.path_info_pop()
            return self.directory_app
        if req.path_info_peek() == 'status':
            req.path_info_pop()
            return self.status_capture

    ############################################################
    ## Query/repository

    transformers = JsonFile('transformer_fn')

    consumers = JsonFile('consumers_fn')

    @wsgify
    def query(self, req):
        if req.GET.get('consumer'):
            return self.query_consumer(req)
        url = req.GET.get('url')
        url_domain = urlparse.urlsplit(url).netloc.lower().split(':')[0]
        matches = []
        transformers = self.transformers
        for key, all_data in transformers.iteritems():
            for func_data in all_data:
                done = False
                domains = func_data.get('domain', [])
                if isinstance(domains, basestring):
                    domains = [domains]
                for domain in domains:
                    if url_domain == domain:
                        matches.append(func_data)
                        done = True
                        break
                if done:
                    continue
                urls = func_data.get('urls', [])
                if isinstance(urls, basestring):
                    urls = [urls]
                for url_match in urls:
                    if url.startswith(url_match):
                        matches.append(func_data)
                        done = True
                        break
                if done:
                    continue
                url_regexes = func_data.get('url-regex', [])
                if isinstance(url_regexes, basestring):
                    url_regexes = [url_regexes]
                for url_regex in url_regexes:
                    if re.match(url_regex, url):
                        matches.append(func_data)
                        break
        result = {'extractors': matches}
        types = set(item['type'] for item in matches if item.get('type'))
        consumers = []
        for type in types:
            for consumer in self.consumers.itervalues():
                if type in consumer['types']:
                    consumers.append(consumer)
        result['consumers'] = consumers
        return Response(json=result)

    @wsgify
    def query_consumer(self, req):
        type = req.GET['consumer']
        matches = []
        for url, consumer in self.consumers.iteritems():
            if type in consumer['types']:
                matches.append(consumer)
        return Response(json={'matches': matches})

    @wsgify
    def register(self, req):
        if req.body.startswith('http'):
            js_url = req.body
        else:
            js_url = req.params.get('url')
        if not js_url:
            return exc.HTTPBadRequest('No url parameter provided')
        if js_url.startswith(req.application_url):
            data = Request.blank(js_url).get_response(self).body
        else:
            data = urllib.urlopen(js_url).read()
        try:
            properties = parse_metadata(data, js_url)
        except ValueError, e:
            return exc.HTTPBadRequest(str(e))
        transformers = self.transformers
        transformers[js_url] = properties
        self.transformers = transformers
        return exc.HTTPCreated()

    @wsgify
    def register_consumer(self, req):
        if req.body.startswith('http'):
            url = req.body
        else:
            url = req.params.get('url')
        if not url:
            return exc.HTTPBadRequest('No url parameter provided')
        body = urllib.urlopen(url).read()
        try:
            data = json.loads(body)
        except ValueError:
            import sys
            print >> sys.stderr, 'Bad data for url %r: %s' % (url, body)
            raise
        data['post'] = urlparse.urljoin(url, data['post'])
        data['url'] = url
        consumers = self.consumers
        consumers[url] = data
        self.consumers = consumers
        return exc.HTTPCreated()
