from cgi import escape as html_escape
from seeitservices.util import wsgify
from seeitservices.subber import Subber


class Later(object):

    def __init__(self, syncclient):
        self.syncclient = syncclient
        self.static_app = Subber(
            'package:seeitservices.later:./static-later/')

    @wsgify
    def __call__(self, req):
        req.add_sub(
            'syncclient',
            '</body>',
            ('<script src="%s"></script>'
             % (html_escape(self.syncclient))),
            replace=False)
        return self.static_app
