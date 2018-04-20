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


from __future__ import absolute_import

from .utils import fixture_filepath, py3only
from webtest import TestApp
from jedihttp import handlers
from nose.tools import ok_
from hamcrest import ( assert_that, only_contains, all_of, is_not, has_key,
                       has_item, has_items, has_entry, has_length, equal_to,
                       is_, empty )

import bottle
bottle.debug( True )


def CompletionEntry( name ):
  return has_entry( 'name', name )


def valid_completions():
  return all_of( has_key( 'docstring' ),
                 has_key( 'name' ),
                 has_key( 'description' ) )


def test_healthy():
  app = TestApp( handlers.app )
  ok_( app.post( '/healthy' ) )


def test_ready():
  app = TestApp( handlers.app )
  ok_( app.post( '/ready' ) )


# XXX(vheon): test for unicode, specially for python3
# where encoding must be specified
def test_completion():
  app = TestApp( handlers.app )
  filepath = fixture_filepath( 'basic.py' )
  request_data = {
      'source': open( filepath ).read(),
      'line': 7,
      'col': 2,
      'source_path': filepath
  }

  completions = app.post_json( '/completions',
                               request_data ).json[ 'completions' ]

  assert_that( completions, only_contains( valid_completions() ) )
  assert_that( completions, has_items( CompletionEntry( 'a' ),
                                       CompletionEntry( 'b' ) ) )


def test_good_gotodefinition():
  app = TestApp( handlers.app )
  filepath = fixture_filepath( 'goto.py' )
  request_data = {
      'source': open( filepath ).read(),
      'line': 10,
      'col': 3,
      'source_path': filepath
  }

  definitions = app.post_json( '/gotodefinition',
                               request_data ).json[ 'definitions' ]

  assert_that( definitions, has_length( 2 ) )
  assert_that( definitions, has_items(
                              {
                                'description': 'def f',
                                'line': 1,
                                'in_builtin_module': False,
                                'column': 4,
                                'is_keyword': False,
                                'module_path': filepath,
                                'docstring': 'f()\n\nModule method docs\nAre '
                                             'dedented, like you might expect'
                              },
                              {
                                'description': 'class C',
                                'line': 6,
                                'in_builtin_module': False,
                                'column': 6,
                                'is_keyword': False,
                                'module_path': filepath,
                                'docstring': 'Class Documentation'
                              } ) )


def test_bad_gotodefinitions_blank_line():
  app = TestApp( handlers.app )
  filepath = fixture_filepath( 'goto.py' )
  request_data = {
    'source': open( filepath ).read(),
    'line': 9,
    'col': 1,
    'source_path': filepath
  }
  definitions = app.post_json( '/gotodefinition', request_data ).json[ 'definitions' ]
  assert_that( definitions, is_( empty() ) )


def test_bad_gotodefinitions_not_on_valid_position():
  app = TestApp( handlers.app )
  filepath = fixture_filepath( 'goto.py' )
  request_data = {
    'source': open( filepath ).read(),
    'line': 100,
    'col': 1,
    'source_path': filepath
  }
  response = app.post_json( '/gotodefinition', request_data, expect_errors = True )
  assert_that( response.status_int, equal_to( 500 ) )


def test_good_gotoassignment():
  app = TestApp( handlers.app )
  filepath = fixture_filepath( 'goto.py' )
  request_data = {
      'source': open( filepath ).read(),
      'line': 20,
      'col': 1,
      'source_path': filepath
  }

  definitions = app.post_json( '/gotoassignment',
                               request_data ).json[ 'definitions' ]

  assert_that( definitions, has_length( 1 ) )
  assert_that( definitions, has_item( {
                                'in_builtin_module': False,
                                'is_keyword': False,
                                'module_path': filepath,
                                'column': 0,
                                'line': 18,
                                'description': 'inception = _list[ 2 ]',
                                'docstring': ''
                            } ) )


def test_usages():
  app = TestApp( handlers.app )
  filepath = fixture_filepath( 'usages.py' )
  request_data = {
      'source': open( filepath ).read(),
      'line': 8,
      'col': 5,
      'source_path': filepath
  }

  definitions = app.post_json( '/usages',
                               request_data ).json[ 'definitions' ]

  assert_that( definitions, has_length( 4 ) )
  assert_that( definitions, has_items(
                              {
                                'description': 'def f',
                                'in_builtin_module': False,
                                'is_keyword': False,
                                'module_path': filepath,
                                'column': 4,
                                'line': 1,
                                'docstring': 'f()\n\nModule method docs\nAre dedented, like you might expect'
                              },
                              {
                                'description': 'a = f()',
                                'in_builtin_module': False,
                                'is_keyword': False,
                                'module_path': filepath,
                                'column': 4,
                                'line': 6,
                                'docstring': ''
                              },
                              {
                                'description': 'b = f()',
                                'in_builtin_module': False,
                                'is_keyword': False,
                                'module_path': filepath,
                                'column': 4,
                                'line': 7,
                                'docstring': ''
                              },
  {
                                'description': 'c = f()',
                                'in_builtin_module': False,
                                'is_keyword': False,
                                'module_path': filepath,
                                'column': 4,
                                'line': 8,
                                'docstring': ''
                              } ) )


@py3only
def test_py3():
  app = TestApp( handlers.app )
  filepath = fixture_filepath( 'py3.py' )
  request_data = {
      'source': open( filepath ).read(),
      'line': 19,
      'col': 11,
      'source_path': filepath
  }

  completions = app.post_json( '/completions',
                                request_data ).json[ 'completions' ]

  assert_that( completions, has_item( CompletionEntry( 'values' ) ) )
  assert_that( completions,
               is_not( has_item( CompletionEntry( 'itervalues' ) ) ) )
