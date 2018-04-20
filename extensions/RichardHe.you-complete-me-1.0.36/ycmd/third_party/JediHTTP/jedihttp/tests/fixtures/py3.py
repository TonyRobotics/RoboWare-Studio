def make_scoreboard( frame, score = 0 ):
  label = Label( frame )
  label.pack()
  for i in [ -10, -1, 1, 10 ]:
    def increment(step=i):
      nonlocal score
      score = score + step
      label['text'] = score
    button = Button( frame, text='%+d' % i, command=increment )
    button.pack()
  return label

d = {
  'key1': 'value1',
  'key2': 'value2',
  'key3': 'value3'
}

values = d.
