#!/usr/bin/env python
import os
import sys
import site
here = os.path.dirname(os.path.abspath(__file__))
site.addsitedir(os.path.join(here, 'vendor'))
site.addsitedir(os.path.join(here, 'vendor-binary'))
sys.path.append(os.path.join(here, 'submodules/thecutout'))
site.addsitedir(os.path.join(here, 'submodules/thecutout/vendor'))
sys.path.insert(0, here)

from seeitservices.wsgiapp import DispatcherApp

app_instance = None


def application(environ, start_response):
    global app_instance
    if not app_instance:
        dir = '/tmp/seeitsaveit'
        app_instance = DispatcherApp(base=dir)
    return app_instance(environ, start_response)
