import os
from webob.dec import wsgify
from webob import Response
from webob import exc
from seeitservices.util import JsonFile
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
            name="Simple global storage for lots of data",
            post=base_url + '/post',
            types=['status', 'song'],
            )

    data = JsonFile('data_fn')

    def post(self, req):
        if req.method != 'POST':
            return exc.HTTPMethodNotAllowed(allow='POST')
        data = self.data
        body = req.json
        items = self.explode_items(body, ['status', 'song'])
        data.extend(items)
        self.data = data
        result = self.success_template.substitute(url=req.application_url + '/')
        return Response(result)

    def explode_items(self, data, keys):
        result = []
        for key in keys:
            if not data.get(key):
                continue
            items = data[key]
            if not isinstance(items, (list, tuple)):
                items = [items]
            for item in items:
                item['type'] = key
                item['location'] = data['location']
                result.append(item)
        return result

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
There are no items
{{else}}

<ul>
{{for item in reversed(data)}}
<li>
 {{if item['type'] == 'status'}}
  {{if item.get('profilePic') }}
    <img src="{{item['profilePic']}}">
  {{endif}}
  {{if item.get('profileLink') }}
    <a href="{{item['profileLink']}}">user</a>
  {{endif}}
  at {{item.get('date')}}:
  {{item.get('body') | html}}

 {{elif item['type'] == 'song'}}
  {{item.get('title')}} by {{item.get('artist')}}
  {{if item.get('album')}}
    in {{item['album']}}
  {{endif}}

 {{else}}
  Unknown item:
  <pre>{{item}}</pre>
 {{endif}}
</li>
{{endfor}}
</ul>

{{endif}}

""")

    def homepage(self, req):
        return Response(self.homepage_template.substitute(
                data=self.data,
                req=req))
