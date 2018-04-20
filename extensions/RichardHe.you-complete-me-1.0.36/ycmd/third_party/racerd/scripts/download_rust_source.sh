#!/bin/sh

SRC_VERSION=1.4.0
SRC_NAME=rustc-${SRC_VERSION}-src
SRC_PATH=https://static.rust-lang.org/dist/${SRC_NAME}.tar.gz

>&2 echo "Downloading and extracting ${SRC_NAME}"

curl --silent -O ${SRC_PATH}
tar xf ${SRC_NAME}.tar.gz

echo ${PWD}/rustc-${SRC_VERSION}/src
