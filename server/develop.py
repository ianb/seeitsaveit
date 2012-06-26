import os
from webob.dec import wsgify
from webob import exc
from webob import Response
from webob.static import DirectoryApp, FileApp
import urllib
try:
    import simplejson as json
except ImportError:
    import json
import hmac
import hashlib


class DevelopApp(object):

    def __init__(self, dir):
        if not os.path.exists(dir):
            os.makedirs(dir)
        self.dir = os.path.normcase(os.path.abspath(dir))
        self.static_app = DirectoryApp(os.path.join(
                os.path.dirname(os.path.abspath(__file__)),
                'static/develop'))

    @property
    def secret(self):
        ## FIXME: do this right:
        return 'secret!'

    @wsgify
    def __call__(self, req):
        if req.path_info_peek() == 'api':
            return self.api(req)
        else:
            if req.path_info == '/':
                # index file
                req.path_info += 'index.html'
            return self.static_app

    @wsgify
    def api(self, req):
        if req.path_info == '/api/auth':
            return self.auth(req)
        if req.path_info.startswith('/api/scripts'):
            return self.script_store(req)
        return exc.HTTPNotFound()

    def sign(self, email):
        return hmac.new(self.secret, email, hashlib.sha1).hexdigest()

    def auth(self, req):
        assertion = req.body
        data = 'assertion=%s&audience=%s' % (
            urllib.quote(assertion),
            urllib.quote(req.scheme + '://' + req.host))
        r = urllib.urlopen('https://browserid.org/verify', data)
        r = json.load(r)
        if r['status'] == 'okay':
            data = {
                'status': 'ok',
                'email': r['email'],
                'signed': self.sign(r['email']),
                }
            resp = Response(json={'status': 'okay'})
            resp.set_cookie('auth', urllib.quote(json.dumps(data)), max_age=60*60*24*365*10)
            return resp
        else:
            return Response(status=400, json=r)

    def get_script_filename(self, email, scriptname):
        path = os.path.join(self.dir,
                            urllib.quote(email, ''),
                            urllib.quote(scriptname, ''))
        path = os.path.normcase(os.path.abspath(path))
        if not path.startswith(self.dir):
            raise Exception('Bad path: %r (does not start with %r)' % (path, self.dir))
        return path

    def script_store(self, req):
        prefix = '/api/scripts'
        assert req.path_info.startswith(prefix)
        path_parts = req.path_info[len(prefix):].strip('/').split('/', 1)
        email = path_parts[0]
        name = path_parts[1]
        filename = self.get_script_filename(email, name)
        if req.method == 'PUT':
            user = self.get_user(req)
            if not user or email != user['email']:
                return exc.HTTPForbidden()
            if not os.path.exists(os.path.dirname(filename)):
                os.makedirs(os.path.dirname(filename))
            with open(filename, 'wb') as fp:
                fp.write(req.body)
            return exc.HTTPNoContent()
        elif req.method == 'GET':
            if not os.path.exists(filename):
                return exc.HTTPNotFound()
            return FileApp(filename)
        else:
            return exc.HTTPMethodNotAllow(allow='POST,GET')

    def get_user(self, req):
        cookie = req.cookies.get('auth')
        if not cookie:
            return None
        data = json.loads(urllib.unquote(cookie))
        sig = self.sign(data['email'])
        if sig != data['signed']:
            print 'Bad signature on data:', data
            return None
        return data
