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


from . import utils
from .utils import with_jedihttp, py2only
import requests
import subprocess
from jedihttp import hmaclib
from os import path
from hamcrest import assert_that, equal_to

try:
  from http import client as httplib
except ImportError:
  import httplib

class HMACAuth( requests.auth.AuthBase ):
  def __init__( self, secret ):
    self._hmachelper = hmaclib.JediHTTPHmacHelper( secret )

  def __call__( self, req ):
    self._hmachelper.SignRequestHeaders( req.headers,
                                         req.method,
                                         req.path_url,
                                         req.body )
    return req


PORT = 50000
SECRET = 'secret'
PATH_TO_JEDIHTTP = path.abspath( path.join( path.dirname( __file__ ),
                                            '..', '..', 'jedihttp.py' ) )


def wait_for_jedihttp_to_start( jedihttp ):
  line = jedihttp.stdout.readline().decode( 'utf8' )
  good_start = line.startswith( 'serving on' )
  reason = jedihttp.stdout.read().decode( 'utf8' ) if not good_start else ''
  return good_start, reason


def setup_jedihttp():
  with hmaclib.TemporaryHmacSecretFile( SECRET ) as hmac_file:
    command = [ utils.python(),
                '-u', # this flag makes stdout non buffered
                PATH_TO_JEDIHTTP,
                '--port', str( PORT ),
                '--hmac-file-secret', hmac_file.name ]
    return utils.SafePopen( command,
                            stderr = subprocess.STDOUT,
                            stdout = subprocess.PIPE )


def teardown_jedihttp( jedihttp ):
  utils.TerminateProcess( jedihttp.pid )


@with_jedihttp( setup_jedihttp, teardown_jedihttp )
def test_client_request_without_parameters( jedihttp ):
  good_start, reason = wait_for_jedihttp_to_start( jedihttp )
  assert_that( good_start, reason )

  response = requests.post( 'http://127.0.0.1:{0}/ready'.format( PORT ),
                            auth = HMACAuth( SECRET ) )

  assert_that( response.status_code, equal_to( httplib.OK ) )

  hmachelper = hmaclib.JediHTTPHmacHelper( SECRET )
  assert_that( hmachelper.IsResponseAuthenticated( response.headers,
                                                   response.content ) )


@with_jedihttp( setup_jedihttp, teardown_jedihttp )
def test_client_request_with_parameters( jedihttp ):
  good_start, reason = wait_for_jedihttp_to_start( jedihttp )
  assert_that( good_start, reason )

  filepath = utils.fixture_filepath( 'goto.py' )
  request_data = {
      'source': open( filepath ).read(),
      'line': 10,
      'col': 3,
      'source_path': filepath
  }

  response = requests.post( 'http://127.0.0.1:{0}/gotodefinition'.format( PORT ),
                            json = request_data,
                            auth = HMACAuth( SECRET ) )

  assert_that( response.status_code, equal_to( httplib.OK ) )

  hmachelper = hmaclib.JediHTTPHmacHelper( SECRET )
  assert_that( hmachelper.IsResponseAuthenticated( response.headers,
                                                   response.content ) )


@with_jedihttp( setup_jedihttp, teardown_jedihttp )
def test_client_bad_request_with_parameters( jedihttp ):
  good_start, reason = wait_for_jedihttp_to_start( jedihttp )
  assert_that( good_start, reason )

  filepath = utils.fixture_filepath( 'goto.py' )
  request_data = {
      'source': open( filepath ).read(),
      'line': 100,
      'col': 1,
      'source_path': filepath
  }

  response = requests.post( 'http://127.0.0.1:{0}/gotodefinition'.format( PORT ),
                            json = request_data,
                            auth = HMACAuth( SECRET ) )

  assert_that( response.status_code, equal_to( httplib.INTERNAL_SERVER_ERROR ) )

  hmachelper = hmaclib.JediHTTPHmacHelper( SECRET )
  assert_that( hmachelper.IsResponseAuthenticated( response.headers,
                                                   response.content ) )


@py2only
@with_jedihttp( setup_jedihttp, teardown_jedihttp )
def test_client_python3_specific_syntax_completion( jedihttp ):
  good_start, reason = wait_for_jedihttp_to_start( jedihttp )
  assert_that( good_start, reason )

  filepath = utils.fixture_filepath( 'py3.py' )
  request_data = {
      'source': open( filepath ).read(),
      'line': 19,
      'col': 11,
      'source_path': filepath
  }

  response = requests.post( 'http://127.0.0.1:{0}/completions'.format( PORT ),
                            json = request_data,
                            auth = HMACAuth( SECRET ) )

  assert_that( response.status_code, equal_to( httplib.OK ) )

  hmachelper = hmaclib.JediHTTPHmacHelper( SECRET )
  assert_that( hmachelper.IsResponseAuthenticated( response.headers,
                                                   response.content ) )
