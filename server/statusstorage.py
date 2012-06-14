import os
from webob.dec import wsgify
from webob import Response
from webob import exc
try:
    import simplejson as json
except ImportError:
    import json
import tempita


class StatusStorage(object):

    def __init__(self, dir):
        self.dir = dir
        if not os.path.exists(dir):
            os.makedirs(dir)
        self.data_fn = os.path.join(dir, 'consumers.json')

    @wsgify
    def __call__(self, req):
        if req.path_info == '/describe':
            return Response(json=self.description(req.application_url))
        if req.path_info == '/':
            return self.homepage(req)
        if req.path_info == '/post':
            self.post(req)
        return exc.HTTPNotFound()

    def description(self, base_url):
        return dict(
            name="Simple global storage for status updates",
            post=base_url + '/post',
            types=['status-update'],
            count='*',
            )

    @property
    def data(self):
        if not os.path.exists(self.data_fn):
            return []
        with open(self.data_fn, 'rb') as fp:
            return json.load(fp)

    @data.setter
    def data(self, value):
        with open(self.data_fn, 'wb') as fp:
            json.dump(value, fp)

    def post(self, req):
        data = self.data
        print 'body', repr(req.body)
        data.append(req.json)
        self.data = data
        return Response('Saved, thank you!')

    homepage_template = tempita.HTMLTemplate("""
<!DOCTYPE html>
<html>
<head>
  <title>Status Updates From Everywhere</title>
</head>
<body>

<h1>Status Updates From Everywhere</h1>

{{if not data}}
There are no updates
{{else}}

<ul>
{{for item in data}}
<li>
  {{if item.get('profilePic') }}
    <img src="{{item['profilePic']}}">
  {{endif}}
  {{if item.get('profileLink') }}
    <a href="{{item['profileLink']}}">user</a>
  {{endif}}
  at {{item.get('date')}}:
  {{item.get('bodyHTML')}}
</li>
{{endfor}}
</ul>

{{endif}}

""")

    def homepage(self, req):
        return Response(self.homepage_template.substitute(
                data=self.data,
                req=req))
