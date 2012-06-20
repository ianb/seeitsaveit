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
        self.data_fn = os.path.join(dir, 'statuses.json')

    @wsgify
    def __call__(self, req):
        if req.path_info == '/describe':
            return Response(json=self.description(req.application_url))
        if req.path_info == '/':
            return self.homepage(req)
        if req.path_info == '/post':
            return self.post(req)
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
        if req.method != 'POST':
            return exc.HTTPMethodNotAllowed(allow='POST')
        data = self.data
        body = req.json
        import pprint; pprint.pprint(body)
        if body.get('count') != 'plural':
            status = [body['status']]
        else:
            status = body['status']
        data.extend(status)
        self.data = data
        result = self.success_template.substitute(url=req.application_url + '/')
        return Response(result)

    success_template = tempita.HTMLTemplate("""\
Saved! <a target="_blank" href="{{ url }}">view results</a>""")

    homepage_template = tempita.HTMLTemplate("""\
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
{{for item in reversed(data)}}
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
