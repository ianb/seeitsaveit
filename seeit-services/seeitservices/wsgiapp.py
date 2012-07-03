import os
import urllib
from seeitservices.util import wsgify, Response, json, ServeStatic
from seeitservices.util import read_file, write_file, make_random, sign
from seeitservices.mapper import Mapper


class DispatcherApp(object):

    def __init__(self, secret_filename='/tmp/seeit-services/secret.txt',
                 config_file='mapper.ini'):
        self._secret_filename = secret_filename
        self.static_app = ServeStatic(__name__, 'static-auth', '/static-auth')
        self.config_file = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                        config_file)
        self.mapper = Mapper()
        self.mapper.add_configs(self.config_file)

    @wsgify
    def __call__(self, req):
        self.set_auth(req)
        req.root = (req.application_url, self)
        if req.path_info == '/auth':
            return self.auth()
        if self.static_app.matches(req):
            return self.static_app
        return self.mapper

    ############################################################
    ## Auth stuff

    def set_auth(self, req):
        req.auth_html = (
            '<script src="https://browserid.org/include.js"></script>'
            '<script src="%s/static-auth/auth.js"></script>'
            '<script>auth.authUrl=%r</script>') % (
            req.application_url,
            req.application_url + '/auth')
        auth = req.params.get('auth')
        if not auth:
            return
        if '.' in auth:
            sig, auth = auth.split(':')
            if self.signature(auth) == sig:
                self.auth = json.loads(auth)

    @property
    def secret(self):
        secret = read_file(self._secret_filename)
        if not secret:
            secret = make_random(10)
            write_file(self._secret_filename, secret)
        return secret

    def signature(self, text):
        return sign(self.secret, text)

    @wsgify
    def auth(self, req):
        assertion = req.params['assertion']
        audience = req.params['audience']
        r = urllib.urlopen(
            "https://browserid.org/verify",
            urllib.urlencode(
                dict(assertion=assertion, audience=audience)))
        r = json.loads(r.read())
        if r['status'] == 'okay':
            r['audience'] = audience
            static = json.dumps(r)
            static = self.signature(static) + '.' + static
            r['auth'] = static
        return Response(json=r)
