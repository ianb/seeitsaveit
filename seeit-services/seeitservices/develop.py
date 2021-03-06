import urllib
import urlparse
import os
from seeitservices.util import wsgify, Response, send_request
from seeitservices.subber import Subber
from webob.static import FileApp
from webob import exc
import shutil


class DevelopApp(object):

    def __init__(self, dir, register_url):
        if not os.path.exists(dir):
            os.makedirs(dir)
        self.dir = os.path.normcase(os.path.abspath(dir))
        self.static_app = Subber(
            'package:seeitservices.develop:./static-develop/')
        self.register_url = register_url
        self.prefill_dir = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            'prefill-data')

    @wsgify
    def __call__(self, req):
        if req.path_info_peek() == 'api':
            return self.api(req)
        else:
            return self.static_app

    @wsgify
    def api(self, req):
        if req.path_info.startswith('/api/scripts'):
            return self.script_store(req)
        if req.path_info.startswith('/api/register-all'):
            return self.register_all(req)
        if req.path_info.startswith('/api/copy-prefill'):
            return self.copy_prefill(req)
        if req.path_info.startswith('/api/fill-prefill'):
            return self.fill_prefill(req)
        return exc.HTTPNotFound()

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
            if req.email != email:
                return exc.HTTPForbidden()
            if not os.path.exists(os.path.dirname(filename)):
                os.makedirs(os.path.dirname(filename))
            with open(filename, 'wb') as fp:
                fp.write(req.body)
            return Response('', content_type=None)
        elif req.method == 'GET':
            if not os.path.exists(filename):
                return exc.HTTPNotFound()
            return FileApp(filename)
        else:
            return exc.HTTPMethodNotAllow(allow='PUT,GET')

    def register_all(self, req):
        resp = Response(content_type='text/plain', body='Registering scripts\n')
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
                resp.write('  registering URL: %s\n' % url)
                register_url = urlparse.urljoin(req.application_url, self.register_url)
                send_request(req, register_url, url)
        return resp

    def copy_prefill(self, req):
        resp = Response(content_type='text/plain', body='Copying prefill from %s\n' % self.prefill_dir)
        force = req.params.get('force')
        return self.copy_files(resp, force, self.prefill_dir, self.dir)

    def fill_prefill(self, req):
        resp = Response(content_type='text/plain', body='Filling prefill from %s\n' % self.dir)
        force = req.params.get('force', True)
        return self.copy_files(resp, force, self.dir, self.prefill_dir)

    def copy_files(self, resp, force, source_dir, dest_dir):
        dir = os.path.normcase(os.path.abspath(source_dir))
        for dirpath, dirnames, filenames in os.walk(dir):
            if '.git' in dirnames:
                dirnames.remove('.git')
            for fn in filenames:
                fn = os.path.join(dirpath, fn)
                assert fn.startswith(dir)
                new_fn = fn[len(dir):]
                assert new_fn.startswith('/')
                new_fn = new_fn.strip('/')
                new_fn = os.path.join(dest_dir, new_fn)
                if not os.path.exists(os.path.dirname(new_fn)):
                    resp.write('  Creating %s/\n' % os.path.dirname(new_fn))
                    os.makedirs(os.path.dirname(new_fn))
                if os.path.exists(new_fn):
                    with open(new_fn, 'rb') as fp:
                        new_content = fp.read()
                    with open(fn, 'rb') as fp:
                        old_content = fp.read()
                    if new_content == old_content:
                        resp.write('  %s already up-to-date\n' % new_fn)
                    elif force:
                        resp.write('  Copying %s to %s (overwrite)\n' % (fn, new_fn))
                        shutil.copy(fn, new_fn)
                    else:
                        resp.write('  %s not up-to-date, leaving\n' % new_fn)
                else:
                    resp.write('  Copying %s to %s\n' % (fn, new_fn))
                    shutil.copy(fn, new_fn)
        return resp
