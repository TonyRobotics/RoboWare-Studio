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

# Almost all the functions are taken from
# https://github.com/Valloric/ycmd/blob/master/ycmd/utils.py


import sys
import os
import signal
import subprocess

# python3 compatibility
try:
  basestring
except NameError:
  basestring = str

try:
  import unittest2 as unittest
except ImportError:
  import unittest

py3only = unittest.skipIf( sys.version_info < ( 3, 0 ), "Python 3.x only test" )
py2only = unittest.skipIf( sys.version_info >= ( 3, 0 ), "Python 2.x only test" )


def python3():
  if OnWindows():
    return os.path.abspath( '/Python33/python' )
  else:
    return 'python3'


def python():
  if sys.version_info < ( 3, 0 ) and 'CROSS_PYTHON_TESTS' in os.environ:
    return python3()
  else:
    return sys.executable


def with_jedihttp( setup, teardown ):
  """Decorator which pass the return value of the setup function to the test
  function and to the teardown function."""
  def decorate( func ):
    class Namespace: pass
    ns = Namespace()
    ns.jedihttp = None

    def test_wrapped(): func( ns.jedihttp )
    def setup_wrapped(): ns.jedihttp = setup()
    def teardown_wrapped(): teardown( ns.jedihttp )

    test_wrapped.__name__ = func.__name__
    test_wrapped.setup = setup_wrapped
    test_wrapped.teardown = teardown_wrapped

    return test_wrapped
  return decorate


def fixture_filepath( filename ):
  dir_of_current_script = os.path.dirname( os.path.abspath( __file__ ) )
  return os.path.join( dir_of_current_script, 'fixtures', filename )


# Creation flag to disable creating a console window on Windows. See
# https://msdn.microsoft.com/en-us/library/windows/desktop/ms684863.aspx
CREATE_NO_WINDOW = 0x08000000


def OnWindows():
  return sys.platform == 'win32'


# Convert paths in arguments command to short path ones
def ConvertArgsToShortPath( args ):
  def ConvertIfPath( arg ):
    if os.path.exists( arg ):
      return GetShortPathName( arg )
    return arg

  if isinstance( args, basestring ):
    return ConvertIfPath( args )
  return [ ConvertIfPath( arg ) for arg in args ]


# Get the Windows short path name.
# Based on http://stackoverflow.com/a/23598461/200291
def GetShortPathName( path ):
  from ctypes import windll, wintypes, create_unicode_buffer

  # Set the GetShortPathNameW prototype
  _GetShortPathNameW = windll.kernel32.GetShortPathNameW
  _GetShortPathNameW.argtypes = [ wintypes.LPCWSTR,
                                  wintypes.LPWSTR,
                                  wintypes.DWORD]
  _GetShortPathNameW.restype = wintypes.DWORD

  output_buf_size = 0

  while True:
    output_buf = create_unicode_buffer( output_buf_size )
    needed = _GetShortPathNameW( path, output_buf, output_buf_size )
    if output_buf_size >= needed:
      return output_buf.value
    else:
      output_buf_size = needed


# A wrapper for subprocess.Popen that fixes quirks on Windows.
def SafePopen( args, **kwargs ):
  if OnWindows():
    # We need this to start the server otherwise bad things happen.
    # See issue #637.
    if kwargs.get( 'stdin_windows' ) is subprocess.PIPE:
      kwargs[ 'stdin' ] = subprocess.PIPE
    # Do not create a console window
    kwargs[ 'creationflags' ] = CREATE_NO_WINDOW
    # Python 2 fails to spawn a process from a command containing unicode
    # characters on Windows.  See https://bugs.python.org/issue19264 and
    # http://bugs.python.org/issue1759845.
    # Since paths are likely to contains such characters, we convert them to
    # short ones to obtain paths with only ascii characters.
    args = ConvertArgsToShortPath( args )

  kwargs.pop( 'stdin_windows', None )
  return subprocess.Popen( args, **kwargs )


# From here: http://stackoverflow.com/a/8536476/1672783
def TerminateProcess( pid ):
  if OnWindows():
    import ctypes
    PROCESS_TERMINATE = 1
    handle = ctypes.windll.kernel32.OpenProcess( PROCESS_TERMINATE,
                                                 False,
                                                 pid )
    ctypes.windll.kernel32.TerminateProcess( handle, -1 )
    ctypes.windll.kernel32.CloseHandle( handle )
  else:
    os.kill( pid, signal.SIGTERM )
