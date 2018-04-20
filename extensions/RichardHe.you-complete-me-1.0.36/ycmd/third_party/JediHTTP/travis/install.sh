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

#!/bin/bash
# Adapted from:
# https://github.com/pyca/cryptography/blob/master/.travis/install.sh

set -e

if [[ ${TRAVIS_OS_NAME} == "osx" ]]; then
  # install pyenv
  git clone --branch=v20151103 --depth=1 https://github.com/yyuu/pyenv.git ~/.pyenv
  PYENV_ROOT="$HOME/.pyenv"
  PATH="$PYENV_ROOT/bin:$PATH"
  eval "$(pyenv init -)"
  pyenv install 3.3.6
  echo "3.3.6" >> .python-version

  case "${TOXENV}" in
    py26)
      curl -O https://bootstrap.pypa.io/get-pip.py
      python get-pip.py --user
      ;;
    py27)
      curl -O https://bootstrap.pypa.io/get-pip.py
      python get-pip.py --user
      ;;
    py33)
      pyenv global 3.3.6
      ;;
  esac
  pyenv rehash
  python -m pip install --user virtualenv
else
  pip install virtualenv
fi

python -m virtualenv ~/.venv
source ~/.venv/bin/activate
pip install tox
