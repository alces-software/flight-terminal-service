#!/bin/bash

cat .env \
    | grep -v '^\s*#' \
    | sed '/^\s*$/d' \
    | sed 's/^\([a-zA-Z0-9_]*=\)/export \1/'
