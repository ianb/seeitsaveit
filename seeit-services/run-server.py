#!/usr/bin/env python
import os
import site
here = os.path.dirname(os.path.abspath(__file__))
site.addsitedir(os.path.join(here, 'vendor'))
site.addsitedir(os.path.join(here, 'vendor-binary'))

from seeitservices.wsgiapp import DispatcherApp
import optparse


parser = optparse.OptionParser(
    usage='%prog [OPTIONS]',
    )
parser.add_option('-H', '--host', metavar='HOST', default='localhost')
parser.add_option('-p', '--port', metavar='PORT', default='8080')
parser.add_option('--dir', metavar='DIRECTORY', default='./data')


def main():
    options, args = parser.parse_args()
    app = DispatcherApp(options.dir)
    try:
        from paste.httpserver import serve
        print 'Using paste.httpserver'
        serve(app, host=options.host, port=int(options.port))
    except ImportError:
        import wsgiref.simple_server
        server = wsgiref.simple_server.make_server(
            options.host, int(options.port), app)
        print 'Serving wsgiref on http://%s:%s' % (options.host, options.port)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            print 'Bye'

if __name__ == '__main__':
    main()
