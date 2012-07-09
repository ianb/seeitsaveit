import os
import cgi
import urllib
import logging
from webob import exc
from seeitservices.util import json, wsgify, Response, write_file
from seeitservices.subber import Subber
from tempita import HTMLTemplate

logger = logging.getLogger('annotate')

here = os.path.dirname(os.path.abspath(__file__))


class Annotate(object):

    def __init__(self, dir):
        self.dir = dir
        self.static_app = Subber(
            'package:seeitservices.annotate:./static-annotate/')

    @wsgify
    def __call__(self, req):
        req.charset = None
        peek = req.path_info_peek()
        if peek == 'save':
            return self.save(req)
        elif peek == 'page':
            return self.page(req)
        elif peek == 'annotation':
            return self.annotation(req)
        if req.path_info == '/describe':
            return self.describe(req)
        return self.static_app

    def split_path(self, req, prefix):
        path = req.path_info.strip('/')
        assert path.startswith(prefix + '/')
        path = path[len(prefix):].strip('/')
        email, rest = path.split('/', 1)
        return email, rest

    def make_filename(self, type, email, path):
        path = os.path.join(self.dir, type, urllib.quote(email, ''),
                            urllib.quote(path, ''))
        assert os.path.abspath(path).startswith(os.path.abspath(self.dir))
        return path

    @wsgify
    def describe(self, req):
        data = dict(
            name='Annotate a document',
            sendToPage=req.application_url + '/create.html',
            sendToPageFunction='savePage',
            types=['html'],
            )
        return Response(json=data)

    @wsgify
    def save(self, req):
        if not req.email:
            return Response(
                status=403,
                content_type='text/plain',
                body='Not logged in')
        email, path = self.split_path(req, 'save')
        if email != req.email:
            return Response(
                status=403,
                content_type='text/plain',
                body='Email not correct (%r, not %r)' % (req.email, email))
        if req.method != 'PUT':
            return exc.HTTPMethodNotAllowed(allow='PUT')
        data = req.json
        filename = self.make_filename('page', email, path)
        write_file(filename, json.dumps(data))
        location = req.application_url + '/page/' + urllib.quote(email) + '/' + urllib.quote(path, '')
        return Response(
            json={'location': location})

    page_template = HTMLTemplate('''\
<html>
 <head>
  <meta charset="UTF-8">
  <base href="{{location}}">
  {{head | html}}
  <link href="{{application_url}}/annotate.css" rel="stylesheet" type="text/css">
 </head>
 <body{{body_attrs | html}}>
  {{body | html}}
  <script src="https://ajax.googleapis.com/ajax/libs/jquery/1.7.2/jquery.min.js"></script>
  <script src="{{application_url}}/annotate.js"></script>
  <script>annotationUrl = {{repr(annotation_url)}};</script>
  {{auth_html | html}}
 </body>
</html>
''')

    @wsgify
    def page(self, req):
        email, path = self.split_path(req, 'page')
        filename = self.make_filename('page', email, path)
        if not os.path.exists(filename):
            return exc.HTTPNotFound()
        with open(filename, 'rb') as fp:
            data = json.loads(fp.read())
        if data['data'].get('bodyAttrs'):
            body_attrs = [
                ' %s="%s"' % (name, cgi.escape(value))
                for name, value in data['data']['bodyAttrs'].items()]
        else:
            body_attrs = ''
        page = self.page_template.substitute(
            location=data['location'],
            head=data['data']['head'],
            application_url=req.application_url,
            body_attrs=body_attrs,
            body=data['data']['body'],
            auth_html=req.get_sub('auth'),
            annotation_url=req.url.replace('/page/', '/annotation/'),
            )
        return Response(page)

    @wsgify
    def annotation(self, req):
        email, path = self.split_path(req, 'annotation')
        filename = self.make_filename('annotation', email, path)
        if not os.path.exists(filename):
            data = {'annotations': []}
        else:
            with open(filename, 'rb') as fp:
                data = json.loads(fp.read())
        if req.method == 'GET':
            return Response(json=data)
        elif req.method == 'POST':
            req_data = req.json
            if req_data.get('annotations'):
                data['annotations'].extend(req_data['annotations'])
            if req_data.get('deletes'):
                for delete in req_data['deletes']:
                    for ann in list(data['annotations']):
                        if ann['id'] == delete['id']:
                            data['annotations'].remove(ann)
            if not os.path.exists(os.path.dirname(filename)):
                os.makedirs(os.path.dirname(filename))
            with open(filename, 'wb') as fp:
                fp.write(json.dumps(data))
            return Response(json=data)
        else:
            return exc.HTTPMethodNotAllowed(allow='GET,POST')
