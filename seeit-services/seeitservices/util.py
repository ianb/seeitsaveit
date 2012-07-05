import urlparse
import urllib
import os
import sys
import base64
from webob import dec
from webob import descriptors
import webob
try:
    import simplejson as json
except ImportError:
    import json
import hmac
import hashlib
from webob import static

__all__ = ['Request', 'wsgify', 'Response', 'json', 'write_file', 'read_file',
           'make_random', 'sign', 'ServeStatic', 'JsonFile']


class Request(webob.Request):
    auth = descriptors.environ_getter('seeitservices.auth')
    auth_html = descriptors.environ_getter('seeitservices.auth_html')
    root = descriptors.environ_getter('seeitservices.root')
    sub_key = descriptors.environ_getter('subber.key')

    def add_sub(self, content_types, old, new):
        if 'subber.subs' not in self.environ:
            self.environ['subber.subs'] = []
        self.environ['subber.subs'].append((content_types, old, new))

    @property
    def email(self):
        if self.auth:
            return self.auth['email']
        return None

Response = webob.Response


class wsgify(dec.wsgify):

    RequestClass = Request


def write_file(filename, content):
    if not os.path.exists(os.path.dirname(filename)):
        os.makedirs(os.path.dirname(filename))
    with open(filename, 'wb') as fp:
        fp.write(content)


def read_file(filename, default=None):
    if not os.path.exists(filename):
        return default
    with open(filename, 'rb') as fp:
        return fp.read()


def b64_decode(s):
    s = s + '=' * (len(s) % 4)
    return base64.urlsafe_b64decode(s)


def b64_encode(s):
    return base64.urlsafe_b64encode(s).strip('=').strip()


def make_random(length=16):
    return b64_encode(os.urandom(length))[:length]


def sign(secret, text):
    return b64_encode(hmac.new(secret, text, hashlib.sha1).digest())


def send_request(app_req, url, post_data=None):
    url = urlparse.urljoin(app_req.application_url, url)
    start, start_app = app_req.root
    if url.startswith(start):
        new_req = Request.blank(url)
        if post_data:
            new_req.method = 'POST'
            new_req.body = post_data
        resp = new_req.send(start_app)
        return resp.body
    else:
        r = urllib.urlopen(url, post_data)
        return r.read()


class ServeStatic(object):

    def __init__(self, module_name, path, grab=None, index_file='index.html'):
        mod = sys.modules[module_name]
        path = os.path.join(os.path.dirname(mod.__file__), path)
        self.static_app = static.DirectoryApp(path)
        if grab:
            if not grab.startswith('/'):
                grab = '/' + grab
            grab = grab.rstrip('/')
        self.grab = grab
        self.index_file = index_file

    def matches(self, req):
        return req.path_info.startswith(self.grab)

    @wsgify
    def __call__(self, req):
        if self.grab and req.path_info.startswith(self.grab):
            req.script_name += self.grab
            req.path_info = req.path_info[len(self.grab):]
        if not req.path_info:
            return Response(
                status=301,
                location=req.url + '/')
        if req.path_info.endswith('/' + self.index_file):
            return Response(
                status=301,
                location=req.url[:-len(self.index_file)])
        if req.path_info.endswith('/'):
            req.path_info += self.index_file
        return self.static_app


class JsonFile(object):

    def __init__(self, attr):
        self.attr = attr

    def __set__(self, obj, value):
        filename = getattr(obj, self.attr)
        write_file(filename, json.dumps(value))

    def __get__(self, obj, type=None):
        filename = getattr(obj, self.attr)
        if not os.path.exists(filename):
            return {}
        with open(filename, 'rb') as fp:
            return json.load(fp)

    def __del__(self, obj):
        filename = getattr(obj, self.attr)
        if os.path.exists(filename):
            os.unlink(filename)
