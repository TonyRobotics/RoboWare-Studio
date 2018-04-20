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


import json
import hmac
import hashlib
import tempfile
from base64 import b64encode, b64decode
from jedihttp.compatibility import encode_string, decode_string, compare_digest


def TemporaryHmacSecretFile( secret ):
  """Helper function for passing the hmac secret when starting a JediHTTP server

    with TemporaryHmacSecretFile( 'mysecret' ) as hmac_file:
      jedihttp = subprocess.Popen( ['python',
                                    'jedihttp',
                                    '--hmac-file-secret', hmac_file.name ] )

    The JediHTTP Server as soon as it reads the hmac secret will remove the file
  """
  hmac_file = tempfile.NamedTemporaryFile( 'w', delete = False )
  json.dump( { 'hmac_secret': secret }, hmac_file )
  return hmac_file


_HMAC_HEADER = 'x-jedihttp-hmac'


class JediHTTPHmacHelper( object ):
  """Helper class to correctly signing requests and validating responses when
  communicating with a JediHTTP server."""
  def __init__( self, secret ):
    self._secret = encode_string( secret )


  def _HasHeader( self, headers ):
    return _HMAC_HEADER in headers


  def _SetHmacHeader( self, headers, hmac ):
    headers[ _HMAC_HEADER ] = decode_string( b64encode( hmac ) )


  def _GetHmacHeader( self, headers ):
    return b64decode( headers[ _HMAC_HEADER ] )


  def _Hmac( self, content ):
    return hmac.new( self._secret,
                     msg = encode_string( content ),
                     digestmod = hashlib.sha256 ).digest()


  def _ComputeRequestHmac( self, method, path, body ):
    if not body:
      body = ''
    return self._Hmac( b''.join( ( self._Hmac( method ),
                                   self._Hmac( path ),
                                   self._Hmac( body ) ) ) )


  def SignRequestHeaders( self, headers, method, path, body ):
    self._SetHmacHeader( headers, self._ComputeRequestHmac( method, path, body ) )


  def IsRequestAuthenticated( self, headers, method, path, body ):
    if not self._HasHeader( headers ):
      return False

    return compare_digest( self._GetHmacHeader( headers ),
                           self._ComputeRequestHmac( method, path, body ) )


  def SignResponseHeaders( self, headers, body ):
    self._SetHmacHeader( headers, self._Hmac( body ) )


  def IsResponseAuthenticated( self, headers, content ):
    if not self._HasHeader( headers ):
      return False

    return compare_digest( self._GetHmacHeader( headers ),
                           self._Hmac( content ) )
