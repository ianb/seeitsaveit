from webob.dec import wsgify
from webob import exc
from webob import Response
from webob.static import DirectoryApp
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
        self.dir = dir
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
            return self.static_app

    @wsgify
    def api(self, req):
        if req.path_info == '/api/auth':
            return self.auth(req)

    def sign(self, email):
        return hmac.new(self.secret, email, hashlib.sha1).hexdigest()

    def auth(self, req):
        assertion = req.body
        r = urllib.urlopen('https://browserid.org/verify', assertion)
        r = json.load(r)
        if r['status'] == 'ok':
            data = {
                'status': 'ok',
                'email': r['email'],
                'signed': self.sign(r['email']),
                }
            resp = Response(json={'status': 'ok'})
            resp.set_cookie('auth', urllib.quote(json.dumps(data)))
            return resp
        else:
            return Response(json=r)
