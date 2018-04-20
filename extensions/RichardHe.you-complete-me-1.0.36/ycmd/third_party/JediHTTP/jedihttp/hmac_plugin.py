#     Copyright 2015 Cedraro Andrea <a.cedraro@gmail.com>
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
#    limitations under the License.


import logging
from bottle import request, response, abort
from jedihttp import hmaclib

try:
  from urllib.parse import urlparse
  from http import client as httplib
except ImportError:
  from urlparse import urlparse
  import httplib


class HmacPlugin( object ):
  """
  Bottle plugin for hmac request authentication
  http://bottlepy.org/docs/dev/plugindev.html
  """
  name = 'hmac'
  api = 2


  def __init__( self ):
    self._logger = logging.getLogger( __name__ )


  def setup( self, app ):
    hmac_secret = app.config[ 'jedihttp.hmac_secret' ]
    self._hmachelper = hmaclib.JediHTTPHmacHelper( hmac_secret )


  def __call__( self, callback ):
    def wrapper( *args, **kwargs ):
      if not IsLocalRequest():
        self._logger.info( 'Dropping request with bad Host header.' )
        abort( httplib.UNAUTHORIZED,
               'Unauthorized, received request from non-local Host.' )
        return

      if not self.IsRequestAuthenticated():
        self._logger.info( 'Dropping request with bad HMAC.' )
        abort( httplib.UNAUTHORIZED, 'Unauthorized, received bad HMAC.' )
        return

      body = callback( *args, **kwargs )
      self.SignResponseHeaders( response.headers, body )
      return body
    return wrapper


  def IsRequestAuthenticated( self ):
    return self._hmachelper.IsRequestAuthenticated( request.headers,
                                                    request.method,
                                                    request.path,
                                                    request.body.read() )


  def SignResponseHeaders( self, headers, body ):
    self._hmachelper.SignResponseHeaders( headers, body )


def IsLocalRequest():
  host = urlparse( 'http://' + request.headers[ 'host' ] ).hostname
  return host == '127.0.0.1' or host == 'localhost'
