#!/usr/bin/env python2
'''
Generate blast_results.json file, used by Kablammo to list all BLAST result
sets available on the server.

Usage: simply run generate_list.py with no arguments. data/blast_results.json
will then list all XML files in the data/ directory.
'''
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
