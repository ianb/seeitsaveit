import sys
from seeitservices.util import wsgify, Response
from seeitservices.config import Config
from webob import exc


class Mapper(object):

    def __init__(self, items=None, vars=None):
        self.matchers = []
        self.vars = vars
        if items:
            if hasattr(items, 'items'):
                items = items.items()
            for prefix, value in items:
                self.add(prefix, value)

    def add(self, prefix, value):
        self.matchers.append((prefix, value))
        self.matchers.sort(key=lambda x: -len(x[0]))

    @wsgify
    def __call__(self, req):
        for i, (prefix, match) in enumerate(self.matchers):
            if req.path_info == prefix and not req.path_info.endswith('/'):
                return Response(
                    status=301,
                    location=req.url + '/')
            if req.path_info.startswith(prefix + '/'):
                req.script_name += prefix
                req.path_info = req.path_info[len(prefix):]
                return match
        return exc.HTTPNotFound()

    def load_object(self, name):
        mod, name = name.split(':', 1)
        __import__(mod)
        mod = sys.modules[mod]
        value = getattr(mod, name)
        return value

    def add_configs(self, filenames):
        config = Config(vars=self.vars)
        if isinstance(filenames, basestring):
            filenames = [filenames]
        for filename in filenames:
            config.load(filename)
        for section in config.by_prefix('app:'):
            options = dict(section.items())
            if 'name' not in options:
                print options
                raise KeyError("The section [%s] has no name option" % section.name)
            obj_name = options.pop('name')
            try:
                obj = self.load_object(obj_name)
            except:
                print 'Could not load object: %s' % obj_name
                raise
            try:
                instance = obj(**options)
            except:
                print 'Could not instantiate object: %s(%s)' % (
                    obj_name,
                    ', '.join('%s=%r' % (name, value) for name, value in sorted(options.items())))
                raise
            self.add(section.prefix_name, instance)
