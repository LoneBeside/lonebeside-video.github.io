import http.server
import os
import socket
import sys
import threading
import webbrowser

ROOT = os.path.dirname(os.path.abspath(__file__))
PORT = 8765
URL = f'http://127.0.0.1:{PORT}/'


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def log_message(self, fmt, *args):
        pass

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


def port_busy():
    s = socket.socket()
    s.settimeout(0.3)
    try:
        return s.connect_ex(('127.0.0.1', PORT)) == 0
    finally:
        s.close()


if port_busy():
    webbrowser.open(URL)
    sys.exit(0)

httpd = http.server.ThreadingHTTPServer(('127.0.0.1', PORT), Handler)
print('=' * 52)
print('  Lone / Beside  -  anime video archive')
print('  URL :', URL)
print('  Keep this window open. Close it to stop.')
print('  Videos stay in this browser (IndexedDB).')
print('=' * 52)
threading.Timer(0.7, lambda: webbrowser.open(URL)).start()
try:
    httpd.serve_forever()
except KeyboardInterrupt:
    print('\nstopped')
