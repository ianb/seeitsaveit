import os
import urllib
import hmac
import re
import datetime
import logging
try:
    import simplejson as json
except ImportError:
    import json
from webob.dec import wsgify
from webob import exc
from webob import Response
from tempita import HTMLTemplate, Template
from wsgibrowserid.wsgiapp import Application as BrowserApp

logger = logging.getLogger('annotate')

here = os.path.dirname(os.path.abspath(__file__))


class Application(object):

    def __init__(self, dir):
        self.dir = dir
        self.appinclude_js = appinclude_js

    @wsgify
    def __call__(self, req):
        req.charset = None
        if req.path_info == '/':
            return self.homepage(req)
        elif req.path_info == '/code.js':
            return self.bookmarklet(req, 'code.js')
        #elif req.path_info == '/bookmarklet.js':
        #    return self.bookmarklet(req, 'bookmarklet.js')
        elif req.path_info == '/dom.send.bookmarklet.js':
            return self.bookmarklet(req, 'dom.send.bookmarklet.js')
        elif req.path_info == '/manifest.webapp':
            return Response(
                content_type='application/x-web-app-manifest+json',
                body=open(os.path.join(here, 'manifest.webapp')).read())
        elif req.path_info == '/dom.send.html':
            return self.bookmarklet(
                req,
                'dom.send.html',
                content_type='text/html')
        elif req.path_info == '/icon48.png':
            return Response(
              content_type='image/png',
              body=open(os.path.join(here, 'icon48.png')).read())
        elif req.path_info == '/favicon.ico':
            return exc.HTTPNotFound()
        elif req.path_info_peek() == 'auth':
            req.path_info_pop()
            return self.auth_app
        else:
            return self.store(req)

    def get_manifest(self, req):
        url = req.params.get('url')
        if not url:
            return Response(
                status=400,
                content_type='application/json',
                body=json.dumps(dict(status='error', message="Missing required 'url' parameter")))
        try:
            resp = urllib.urlopen(url)
        except Exception, e:
            return Response(
                status=502,
                content_type='application/json',
                body=json.dumps(dict(status='error', message='Unable to contact remote server (%s): %s' % (url, e))))
        return Response(
            content_type=resp.headers.getheader('content-type') or 'application/octet-stream',
            body=resp.read())

    def homepage(self, req):
        tmpl = HTMLTemplate.from_filename(os.path.join(here, 'homepage.html'))
        resp = tmpl.substitute(app=self, req=req, appIncludeJs=self.appinclude_js)
        return Response(body=resp)

    def bookmarklet(self, req, name, content_type='text/javascript'):
        tmpl = Template.from_filename(os.path.join(here, name))
        with open(os.path.join(here, 'docserialize.js')) as fp:
            docserialize = fp.read()
        body = tmpl.substitute(
            uiType='annotation',
            appUrl=req.application_url,
            options={},
            bookmarkletUrl=req.url,
            docserializeJs=docserialize,
            appIncludeJs=self.appinclude_js,
            )
        return Response(
            body=body,
            content_type=content_type)

    def store(self, req):
        req.userid = self.get_userid(req)
        auth = AuthDomain.from_request(req, self)
        authorized = auth.without_lock
        add_cookie = None
        if authorized:
            add_cookie = auth.add_authorization()
        else:
            authorized, add_cookie = auth.authorize()
        if not authorized:
            if auth.has_users():
                resp = Response(
                    status=403,
                    body=open(os.path.join(here, 'login.html')).read())
            else:
                resp = exc.HTTPForbidden()
        elif 'getlink' in req.params:
            resp = Response(
                content_type='application/json',
                body=json.dumps(dict(url=auth.make_link())))
        else:
            resp = self.store_response(req, auth)
        if add_cookie:
            resp.set_cookie(add_cookie[0], add_cookie[1], max_age=datetime.timedelta(days=10 * 365))
        if not req.userid and req.cookies.get(self.auth_app.cookie_name):
            logger.debug('Invalid cookie: %r' % req.cookies.get(self.auth_app.cookie_name))
            ## Invalid cookie:
            resp.delete_cookie(self.auth_app.cookie_name)
        return resp

    def check_sig(self, value, sig):
        return self.make_sig(value) == sig

    def make_sig(self, value):
        return hmac.new(self.secret(), value).hexdigest()

    def secret(self):
        return self.auth_app.secret_getter()

    def get_userid(self, req):
        cookie = req.cookies.get(self.auth_app.cookie_name)
        if not cookie:
            return None
        userid, sig = urllib.unquote(cookie).split(None, 1)
        if not self.check_sig(userid, sig):
            return None
        return userid

    def store_response(self, req, auth):
        url = auth.url
        fn = auth.filename
        if req.method == 'GET':
            if not os.path.exists(fn):
                logger.debug('not found: %s' % fn)
                return exc.HTTPNotFound()
            with open(fn, 'rb') as fp:
                content_type = fp.readline().strip()
                ui_type = fp.readline().strip().lower()
                body = fp.read()
                if ui_type:
                    ui_type_method = getattr(self, 'ui_type_' + ui_type)
                    body = ui_type_method(body, req, url)
                return Response(
                    cache_expires=True,
                    content_type=content_type,
                    body=body)
        elif req.method == 'POST':
            content_type = req.str_POST.get('content-type', 'text/html')
            if '_charset_' in req.str_POST:
                content_type += '; charset=' + req.str_POST['_charset_']
            body = req.str_POST['body']
            ui_type = req.POST.get('ui-type', 'raw')
            with open(fn, 'wb') as fp:
                fp.write(content_type.strip() + '\n')
                fp.write(ui_type.strip() + '\n')
                fp.write(body)
            logger.debug('redirecting to: %s' % url)
            return Response(
                cache_expires=True,
                status=303,
                location=url)
        elif req.method == 'PUT':
            # FIXME: should figure out content-type, ui_type
            content_type = 'application/json'
            ui_type = 'raw'
            body = req.body
            with open(fn, 'wb') as fp:
                fp.write(content_type.strip() + '\n')
                fp.write(ui_type.strip() + '\n')
                fp.write(body)
            return Response(
                cache_expires=True,
                status=201,
                location=url)
        else:
            return exc.HTTPMethodNotAllowed(
                allow='GET,POST')

    def ui_type_annotation(self, body, req, url):
        body += ('\n<script>runComments = {app: %(app)r, page: %(page)r};</script>\n'
                 '<script src="https://browserid.org/include.js"></script>\n'
                 '<script src="%(app)s/auth/wsgibrowserid.js"></script>\n'
                 '<script src="%(app)s/code.js"></script>\n'
                 '<link rel="application-manifest" href="%(app)s/manifest.webapp">\n'
                 % dict(app=req.application_url, page=url))
        return body

    def ui_type_raw(self, body, req, url):
        return body


class AuthDomain(object):
    """This represents a set of files that all have the same
    authorization access.  Each domain has a name (what goes in
    /a/{domain}/filename)
    """

    def __init__(self, lock, path, req, server, without_lock=False):
        assert re.match(r'^[a-zA-Z0-9_]+$', lock)
        self.lock = lock
        self.path = path
        self.req = req
        self.server = server
        self.without_lock = without_lock

    @property
    def url(self):
        path = urllib.quote(self.path)
        if not path.startswith('/'):
            path = '/' + path
        return self.req.application_url + '/a/%s%s' % (self.lock, path)

    @classmethod
    def from_request(cls, req, server):
        """Creates an auth object from the request path
        """
        path = req.path_info
        if not path.startswith('/a/'):
            lock = generate_key()
            without_lock = True
            rest = path.lstrip('/')
        else:
            without_lock = False
            rest = path[3:]
            if '/' not in rest:
                lock = rest
                rest = ''
            else:
                lock, rest = rest.split('/', 1)
        auth = cls(lock, rest, req, server, without_lock=without_lock)
        return auth

    def has_users(self):
        """True if, by logging in, you might be able to access this"""
        fn = os.path.join(self.server.dir, self.lock + '.authorization')
        return os.path.exists(fn)

    def add_authorization(self):
        """When a request is considered authorized, generate the cookie
        to make this client authorized (if needed)

        Cookie is returned as (cookie_name, value)"""
        if self.req.userid:
            users = self.get_metadata('authorization') or []
            if self.req.userid not in users:
                users.append(self.req.userid)
                self.save_metadata(users, 'authorization')
            c = urllib.unquote(self.req.cookies.get('explicitauth', ''))
            new_cookie = []
            for op in c.split(','):
                if op.strip() and ':' in op:
                    lock, sig = op.split(':', 1)
                    if lock != self.lock:
                        new_cookie.append(op)
            return ('explicitauth', ','.join(new_cookie))
        else:
            c = urllib.unquote(self.req.cookies.get('explicitauth', ''))
            if c:
                c += ','
            c += self.lock + ':' + self.server.make_sig(self.lock)
            return ('explicitauth', urllib.quote(c))

    def authorize(self):
        """Checks if a request is authorized, and may generate a cookie
        as part of that authorization.

        Returns (authorized, (cookie_name, value)) or (authorized, None)
        """
        if self._check_cookie_auth():
            if self.req.userid:
                add_cookie = self.add_authorization()
                return (True, add_cookie)
            return (True, None)
        if self._check_user_auth():
            return (True, None)
        if self._check_link_auth():
            add_cookie = self.add_authorization()
            return (True, add_cookie)
        return (False, None)

    def _check_cookie_auth(self):
        c = urllib.unquote(self.req.cookies.get('explicitauth', ''))
        ops = c.split(',')
        for op in ops:
            op = op.strip()
            if not op:
                continue
            if ':' not in op:
                logger.debug('Bad cookie value: %r' % op)
                continue
            lock, sig = op.split(':', 1)
            if lock == self.lock:
                ## FIXME: check userid here, add if possible
                return self.server.check_sig(lock, sig)
        return False

    def _check_user_auth(self):
        userid = self.req.userid
        if not userid:
            return False
        ## FIXME: not really secure?
        users = self.get_metadata('authorization')
        return users and userid in users

    def _check_link_auth(self):
        linkauth = self.req.params.get('auth')
        if not linkauth:
            return False
        links = self.get_metadata('links')
        if not links or linkauth not in links:
            return False
        ## FIXME: might be nice to check that cookie is set first:
        links.remove(linkauth)
        self.save_metadata(links, 'links')
        return True

    def make_link(self):
        links = self.get_metadata('links') or []
        ## FIXME: it's not a new auth really:
        link_key = generate_key()
        links.append(link_key)
        self.save_metadata(links, 'links')
        url = self.url
        url += '?auth=' + urllib.quote(link_key)
        return url

    def get_metadata(self, type):
        fn = os.path.join(self.server.dir, self.lock + '.' + type)
        if not os.path.exists(fn):
            return None
        with open(fn, 'rb') as fp:
            return json.load(fp)

    def save_metadata(self, value, type):
        fn = os.path.join(self.server.dir, self.lock + '.' + type)
        with open(fn, 'wb') as fp:
            json.dump(value, fp)

    @property
    def filename(self):
        path = urllib.quote(self.path, '')
        dir = os.path.join(self.server.dir, urllib.quote(self.lock, ''))
        if not os.path.exists(dir):
            os.makedirs(dir)
        path = os.path.join(dir, path)
        return path


def generate_key(length=10):
    name = os.urandom(length)
    name = name.encode('base64').replace('\n', '').replace('=', '1').replace('/', '2').replace('+', '3')
    name = name[:length]
    return name


if __name__ == '__main__':
    from wsgiref import simple_server
    data = os.path.join(here, 'annotation-data')
    if not os.path.exists(data):
        os.makedirs(data)
    app = Application(data)
    wsgi_server = simple_server.make_server('127.0.0.1', 8080, app)
    print 'server on http://localhost:8080'
    try:
        wsgi_server.serve_forever()
    except KeyboardInterrupt:
        pass
