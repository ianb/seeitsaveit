import os
import urllib
from webob import exc
from webob import Request
from seeitservices.util import wsgify, Response, json, ServeStatic
from seeitservices.util import read_file, write_file, make_random, sign, indent
from seeitservices.mapper import Mapper


class DispatcherApp(object):

    def __init__(self, secret_filename='/tmp/seeit-services/secret.txt',
                 config_file='mapper.ini', **vars):
        self._secret_filename = secret_filename
        self.static_app = ServeStatic(__name__, 'static-auth', '/static-auth')
        self.config_file = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                        config_file)
        self.mapper = Mapper(vars=vars)
        self.mapper.add_configs(self.config_file)

    @wsgify
    def __call__(self, req):
        ## Hack for Petri
        if req.headers.get('X-SSL', '').lower() == 'on':
            req.scheme = 'https'
        ## Another hack for Petri (https://bugzilla.mozilla.org/show_bug.cgi?id=807796)
        if 'wsgi.file_wrapper' in req.environ:
            del req.environ['wsgi.file_wrapper']
        self.set_auth(req)
        req.root = (req.application_url, self)
        if req.path_info == '/auth':
            return self.auth(req)
        if req.path_info == '/setup':
            return self.setup(req)
        if self.static_app.matches(req):
            return self.static_app
        return self.mapper

    ############################################################
    ## Auth stuff

    def set_auth(self, req):
        req.add_sub(
            'auth',
            '</body>',
            ('<script src="https://browserid.org/include.js"></script>'
             '<script src="%s/static-auth/auth.js"></script>'
             '<script>Auth.authUrl=%r</script>') % (
                req.application_url,
                req.application_url + '/auth'),
            replace=False)
        auth = req.GET.get('auth')
        if not auth:
            return
        if '.' in auth:
            sig, auth = auth.split('.', 1)
            if self.signature(auth) == sig:
                req.auth = json.loads(auth)

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
        try:
            assertion = req.params['assertion']
            audience = req.params['audience']
        except KeyError, e:
            return exc.HTTPBadRequest('Missing key: %s' % e)
        r = urllib.urlopen(
            "https://browserid.org/verify",
            urllib.urlencode(
                dict(assertion=assertion, audience=audience)))
        r = json.loads(r.read())
        if r['status'] == 'okay':
            r['audience'] = audience
            static = json.dumps(r)
            static = self.signature(static) + '.' + static
            r['auth'] = {'query': {'auth': static}}
        return Response(json=r)

    @wsgify
    def setup(self, req):
        resp = Response(content_type='text/plain')
        root = req.application_url
        section = self.mapper.config['setup']
        for key in sorted(section):
            url = section.interpolate(key, root=root)
            subreq = Request.blank(url)
            subresp = subreq.send(self)
            resp.write('URL: %s\n' % url)
            resp_body = subresp.body or subresp.status
            resp_body = resp_body.strip() + '\n'
            resp.write(indent(resp_body))
        return resp
