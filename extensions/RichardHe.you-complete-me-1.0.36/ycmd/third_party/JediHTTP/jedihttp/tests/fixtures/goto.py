def f():
  """ Module method docs
      Are dedented, like you might expect"""
  pass

class C:
  """ Class Documentation"""
  pass
        
variable = f if random.choice( [ 0, 1 ] ) else C


def foo():
  print 'foo'

alias = foo
_list = [ 1, None, alias ]
inception = _list[ 2 ]

inception()
