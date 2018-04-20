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


import sys

if sys.version_info[0] >= 3:
  basestring = str
  unicode = str


def encode_string( value ):
  return value.encode('utf-8') if isinstance(value, unicode) else value


def decode_string(value):
  return value if isinstance(value, basestring) else value.decode('utf-8')


# hmac.compare_digest were introduced in python 2.7.7
if sys.version_info >= ( 2, 7, 7 ):
  from hmac import compare_digest as SecureStringsEqual
else:
  # This is the compare_digest function from python 3.4, adapted for 2.6:
  # http://hg.python.org/cpython/file/460407f35aa9/Lib/hmac.py#l16
  #
  # Stolen from https://github.com/Valloric/ycmd
  def SecureStringsEqual( a, b ):
    """Returns the equivalent of 'a == b', but avoids content based short
    circuiting to reduce the vulnerability to timing attacks."""
    # Consistent timing matters more here than data type flexibility
    if not ( isinstance( a, str ) and isinstance( b, str ) ):
      raise TypeError( "inputs must be str instances" )

    # We assume the length of the expected digest is public knowledge,
    # thus this early return isn't leaking anything an attacker wouldn't
    # already know
    if len( a ) != len( b ):
      return False

    # We assume that integers in the bytes range are all cached,
    # thus timing shouldn't vary much due to integer object creation
    result = 0
    for x, y in zip( a, b ):
      result |= ord( x ) ^ ord( y )
    return result == 0


def compare_digest( a, b ):
  return SecureStringsEqual( a, b )
