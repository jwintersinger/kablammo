#!/usr/bin/env python2
import os
import json

def main():
  results_dir = os.path.dirname(__file__)

  xml_files = [f for f in os.listdir(results_dir) if
                os.path.isfile(os.path.join(results_dir, f)) and
                f.lower().endswith('.xml')]
  serialized = json.dumps({'blast_results': xml_files})

  with open(os.path.join(results_dir, 'blast_results.json'), 'w') as out:
    out.write(serialized)

if __name__ == '__main__':
  main()
