#!/bin/sh
git pull && \
  git push && \
  git checkout gh-pages && \
  git pull && \
  git merge master && \
  git push && \
  git checkout master
