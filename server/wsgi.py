#!/usr/bin/env python
import os
import sys
import site
here = os.path.dirname(os.path.abspath(__file__))
site.addsitedir(os.path.join(here, 'vendor'))
site.addsitedir(os.path.join(here, 'vendor-binary'))
sys.path.insert(0, here)

from server import Application

app_instance = None

def application(environ, start_response):
    global app_instance
    if not app_instance:
        dir = '/tmp/seeitsaveit'
        app_instance = Application(dir)
    return app_instance(environ, start_response)
