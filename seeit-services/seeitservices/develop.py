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
import shutil


class DevelopApp(object):

    def __init__(self, dir, register_app):
        if not os.path.exists(dir):
            os.makedirs(dir)
        self.dir = os.path.normcase(os.path.abspath(dir))
        self.static_app = DirectoryApp(os.path.join(
                os.path.dirname(os.path.abspath(__file__)),
                'static/develop'))
        self.register_app = register_app
        self.prefill_dir = os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            'prefill-data')

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
        if req.path_info.startswith('/api/register-all'):
            return self.register_all(req)
        if req.path_info.startswith('/api/copy-prefill'):
            return self.copy_prefill(req)
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
            return exc.HTTPMethodNotAllow(allow='PUT,GET')

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

    def register_all(self, req):
        resp = Response(content_type='text/plain')
        dir = os.path.normcase(os.path.abspath(self.dir))
        for dirpath, dirnames, filenames in os.walk(dir):
            if '.git' in dirnames:
                dirnames.remove('.git')
            for fn in filenames:
                fn = os.path.join(dirpath, fn)
                assert fn.startswith(dir)
                fn = fn[len(dir):]
                assert fn.startswith('/')
                url = req.application_url + '/api/scripts' + fn
                req = Request.blank('/register', body=url, method='POST')
                resp.write('Added URL: %s\n' % url)
                req.get_response(self.register_app)
        return resp

    def copy_prefill(self, req):
        resp = Response(content_type='text/plain')
        dir = os.path.normcase(os.path.abspath(self.prefill_dir))
        for dirpath, dirnames, filenames in os.walk(dir):
            if '.git' in dirnames:
                dirnames.remove('.git')
            for fn in filenames:
                fn = os.path.join(dirpath, fn)
                assert fn.startswith(dir)
                new_fn = fn[len(dir):]
                assert new_fn.startswith('/')
                new_fn = new_fn.strip('/')
                new_fn = os.path.join(self.dir, new_fn)
                if not os.path.exists(os.path.dirname(new_fn)):
                    os.path.makedirs(os.path.dirname(new_fn))
                if os.path.exists(new_fn):
                    with open(new_fn, 'rb') as fp:
                        new_content = fp.read()
                    with open(fn, 'rb') as fp:
                        old_content = fp.read()
                    if new_content == old_content:
                        resp.write('%s already up-to-date\n' % new_fn)
                    else:
                        resp.write('Copying %s to %s (overwrite)\n' % (fn, new_fn))
                        shutil.copy(fn, new_fn)
                else:
                    resp.write('Copying %s to %s\n' % (fn, new_fn))
                    shutil.copy(fn, new_fn)
        return resp
