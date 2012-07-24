import os
from webob.dec import wsgify
from webob import Response
from webob import exc
from seeitservices.util import JsonFile
from seeitservices.subber import Subber
import tempita


class GeneralStorage(object):

    def __init__(self, dir):
        self.dir = dir
        if not os.path.exists(dir):
            os.makedirs(dir)
        self.data_fn = os.path.join(dir, 'statuses.json')
        self.static_app = Subber(
            'package:seeitservices.generalstorage:./static-generalstorage/')

    @wsgify
    def __call__(self, req):
        if req.path_info == '/data':
            return self.data_app(req)
        return self.static_app

    data = JsonFile('data_fn')

    @wsgify
    def data_app(self, req):
        if req.method not in ('GET', 'POST', 'DELETE'):
            return exc.HTTPMethodNotAllowed(allow='GET,POST,DELETE')
        data = self.data
        data.setdefault('items', [])
        if req.method == 'POST':
            body = req.json
            data['items'].extend(body['items'])
            self.data = data
            return Response(json=dict(status="okay"))
        elif req.method == 'DELETE':
            id = req.GET['id']
            for item in list(data['items']):
                if item.get('id') == id:
                    data['items'].remove(item)
                    break
            else:
                return Response(status=400, content_type='text/plain',
                                body='No item found with id %r' % id)
            self.data = data
            return Response(status=200, body='')
        else:
            return Response(json=data, cache_expires=True)
