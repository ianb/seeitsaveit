"""Static file server that makes URL substitutions
"""
import os
import sys
import shutil
import urllib
import random
import mimetypes
from webob.dec import wsgify
from webob import exc
from webob import Response
from webob.static import FileApp
import posixpath


def add_slash(req):
    url = req.path_url + '/'
    if req.query_string:
        url += '?' + req.query_string
    return url


class Subber(object):

    def __init__(self, source_dir, dest_dir=None, index_page='index.html', clear=True):
        name = 'path-%s' % random.randint(1, 10000)
        if source_dir.startswith('package:'):
            _, name, path = source_dir.split(':', 2)
            mod = sys.modules[name]
            base_path = os.path.dirname(mod.__file__)
            source_dir = os.path.join(base_path, path)
        self.source_dir = source_dir
        if dest_dir is None:
            dest_dir = os.environ.get('TMP_DEST_DIR', '/tmp/subbers')
            dest_dir = os.path.join(dest_dir, name)
        self.dest_dir = dest_dir
        if not os.path.exists(dest_dir):
            os.makedirs(dest_dir)
        self.index_page = index_page
        if clear:
            self.clear()

    @wsgify
    def __call__(self, req):
        dest_path = self.get_dest_path(req)
        source_path = self.source_dir
        file_path = posixpath.normpath(req.path_info.lstrip('/'))
        dest_file_path = os.path.join(dest_path, file_path)
        source_file_path = os.path.join(source_path, file_path)
        if (not dest_file_path.startswith(dest_path)
            or not source_file_path.startswith(source_path)):
            return exc.HTTPForbidden()
        if os.path.isdir(source_file_path) and not req.path_info.endswith('/'):
            return Response(
                status=301,
                location=add_slash(req))
        if req.path_info.endswith('/' + self.index_page):
            new_url = req.path_url.rsplit('/', 1)[0] + '/'
            return Response(
                status=301,
                location=new_url)
        if req.path_info.endswith('/'):
            source_file_path += os.path.sep + self.index_page
            dest_file_path += os.path.sep + self.index_page
        if not os.path.exists(source_file_path):
            ## FIXME: delete source_file_path?
            return exc.HTTPNotFound(comment='No file at %s' % source_file_path)
        if (not os.path.exists(dest_file_path)
            or os.path.getmtime(dest_file_path) < os.path.getmtime(source_file_path)):
            with open(source_file_path, 'rb') as fp:
                content = fp.read()
            subs = req.environ.get('subber.subs', {})
            for name, (old_content, new_content, content_types, replace) in subs.iteritems():
                content_type = mimetypes.guess_type(source_file_path)[0]
                if content_types and content_type not in content_types:
                    continue
                if not isinstance(new_content, basestring):
                    new_content = new_content(req)
                if replace:
                    content = content.replace(old_content, new_content)
                else:
                    content = content.replace(old_content, new_content + old_content)
            dest_dir = os.path.dirname(dest_file_path)
            if not os.path.exists(dest_dir):
                try:
                    os.makedirs(dest_dir)
                except OSError, e:
                    if e.errno == 17:
                        # File already exists
                        pass
                    else:
                        raise
            with open(dest_file_path, 'wb') as fp:
                fp.write(content)
        return FileApp(dest_file_path)

    def get_dest_path(self, req):
        key = req.environ.get('subber.key', req.application_url)
        dest = os.path.join(self.dest_dir, urllib.quote(key, ''))
        return dest

    def clear(self):
        for filename in os.listdir(self.dest_dir):
            shutil.rmtree(os.path.join(self.dest_dir, filename))
